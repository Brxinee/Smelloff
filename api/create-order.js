import Razorpay from 'razorpay';
import {
  isAllowedOrigin,
  generateOrderToken,
  generateOrderConfirmationToken,
} from './_security.js';
import { BASE_PRODUCT } from '../shared/products-config.js';
import { isValidEmail } from './_email.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const UNIT_PRICE_RUPEES = Number(BASE_PRODUCT.price);
const MAX_QUANTITY = Number(BASE_PRODUCT.maxQuantity);
const PRODUCT_NAME = String(BASE_PRODUCT.title || BASE_PRODUCT.name || 'ODORSTRIKE Fabric Mist');
const PRODUCT_SIZE = String(BASE_PRODUCT.size || '50ml');
const PRODUCT_SKU = String(BASE_PRODUCT.sku || BASE_PRODUCT.id || 'OS-001-50ML');
const PRODUCT_URL = 'https://smelloff.in/odorstrike';
const PRODUCT_IMAGE = 'https://smelloff.in/assets/odorstrike-bottle.webp';
const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/;
const TERMINAL_STATES = new Set(['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered']);

function fail(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function razorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    fail('Razorpay credentials are not configured.');
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function normalizeOrderCode(value) {
  return String(value || '').trim().toUpperCase();
}

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY) fail('Order database credentials are not configured.');
  if (!orderCode) return null;

  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=id,order_code,customer_email,customer_phone,amount,status,payment_attempt_id`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[api/create-order] order lookup failed:', response.status, text.slice(0, 300));
      fail('Order database is temporarily unavailable. Please try again.', 503);
    }

    const data = await response.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error('[api/create-order] order lookup error:', error?.message || error);
    fail('Order database is temporarily unavailable. Please try again.', 503);
  }
}

async function insertPendingOrder(payload) {
  if (!SERVICE_KEY) fail('Order database credentials are not configured.');

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      customer_email: payload.email,
      customer_phone: payload.phone,
      items: payload.items,
      amount: payload.amount,
      payment_method: 'pending',
      status: 'checkout_pending',
      address: payload.address,
      order_code: payload.order_code,
      cod_fee: 0,
      fbp: payload.fbp || null,
      fbc: payload.fbc || null,
      event_source_url: payload.event_source_url || null,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const text = await response.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(text); } catch { /* handled below */ }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Order database returned HTTP ${response.status}`);
    error.statusCode = response.status;
    error.isDuplicate = response.status === 409 || data?.code === '23505';
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) fail('Order database returned an invalid response.');
  return row;
}

async function updatePendingOrder(orderCode, payload) {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        customer_email: payload.email,
        customer_phone: payload.phone,
        items: payload.items,
        amount: payload.amount,
        payment_method: 'pending',
        status: 'checkout_pending',
        address: payload.address,
        cod_fee: 0,
        fbp: payload.fbp || null,
        fbc: payload.fbc || null,
        event_source_url: payload.event_source_url || null,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    console.error('[api/create-order] pending order update failed:', response.status);
    fail('Order database is temporarily unavailable. Please try again.', 503);
  }

  const data = await response.json().catch(() => []);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) fail('Order database returned an invalid update response.');
  return row;
}

async function persistRazorpayOrderId(orderCode, razorpayOrderId) {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        payment_attempt_id: razorpayOrderId,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[api/create-order] Razorpay mapping failed:', response.status, text.slice(0, 300));
    fail('Payment order was created but could not be linked to your order. Please try again.', 503);
  }

  const data = await response.json().catch(() => []);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.payment_attempt_id || String(row.payment_attempt_id) !== String(razorpayOrderId)) {
    fail('Payment order was created but could not be linked to your order. Please try again.', 503);
  }
  return row;
}

function responseForOrder(localOrder, razorpayOrderId) {
  return {
    id: localOrder.id,
    order_code: localOrder.order_code,
    order_id: razorpayOrderId,
    amount: Number(localOrder.amount),
    currency: 'INR',
    key_id: RAZORPAY_KEY_ID,
    order_token: generateOrderToken(localOrder.order_code, localOrder.customer_phone),
    confirmation_token: generateOrderConfirmationToken(localOrder.order_code, localOrder.customer_email),
  };
}

async function ensurePendingLocalOrder(payload) {
  let existing = await fetchOrderByCode(payload.order_code);

  if (existing) {
    const sameCustomer = normalizePhone(existing.customer_phone) === normalizePhone(payload.phone)
      && String(existing.customer_email || '').trim().toLowerCase() === payload.email;
    if (!sameCustomer || Number(existing.amount) !== Number(payload.amount)) {
      fail('This checkout session is no longer valid. Please refresh and try again.', 409);
    }

    if (TERMINAL_STATES.has(String(existing.status || '').toLowerCase())) {
      fail('This order has already been completed. Please start a new checkout.', 409);
    }

    if (existing.payment_attempt_id) return existing;
    return updatePendingOrder(payload.order_code, payload);
  }

  try {
    return await insertPendingOrder(payload);
  } catch (error) {
    if (!error?.isDuplicate) throw error;
    existing = await fetchOrderByCode(payload.order_code);
    if (!existing) throw error;

    const sameCustomer = normalizePhone(existing.customer_phone) === normalizePhone(payload.phone)
      && String(existing.customer_email || '').trim().toLowerCase() === payload.email;
    if (!sameCustomer || Number(existing.amount) !== Number(payload.amount)) {
      fail('This checkout session is no longer valid. Please refresh and try again.', 409);
    }
    if (TERMINAL_STATES.has(String(existing.status || '').toLowerCase())) {
      fail('This order has already been completed. Please start a new checkout.', 409);
    }
    if (existing.payment_attempt_id) return existing;
    return updatePendingOrder(payload.order_code, payload);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Powered-By', 'Smelloff');

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay is not configured on the server.' });
    }
    if (!SERVICE_KEY) {
      return res.status(500).json({ error: 'Order database is not configured on the server.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const rawQty = body.items && body.items[0] && body.items[0].quantity !== undefined
      ? body.items[0].quantity
      : body.quantity;
    const quantity = typeof rawQty === 'number' && Number.isInteger(rawQty)
      ? rawQty
      : Number.parseInt(String(rawQty ?? ''), 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || String(rawQty).includes('.')) {
      return res.status(400).json({ error: `Quantity must be an integer between 1 and ${MAX_QUANTITY}.` });
    }

    const items = Array.isArray(body.items) && body.items.length === 1 ? body.items : null;
    if (!items) return res.status(400).json({ error: 'Exactly one ODORSTRIKE line item is required.' });

    const firstItem = items[0] && typeof items[0] === 'object' ? items[0] : {};
    if (firstItem.price !== undefined && Number(firstItem.price) !== UNIT_PRICE_RUPEES) {
      return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
    }

    const subtotalPaise = Math.round(UNIT_PRICE_RUPEES * quantity * 100);
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 100) {
      return res.status(400).json({ error: 'Invalid order amount.' });
    }

    const clientAmount = Number(body.amount);
    if (!Number.isSafeInteger(clientAmount) || clientAmount !== subtotalPaise) {
      return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required for your receipt and delivery updates.' });
    }

    const phone = normalizePhone(body.phone);
    if (phone.length !== 10) {
      return res.status(400).json({ error: 'A valid 10-digit phone is required.' });
    }

    const addressIn = body.address && typeof body.address === 'object' ? body.address : null;
    if (!addressIn) return res.status(400).json({ error: 'Delivery address is required.' });

    const address = {
      name: String(addressIn.name || '').trim().slice(0, 80),
      line: String(addressIn.line || '').trim().slice(0, 200),
      city: String(addressIn.city || '').trim().slice(0, 80),
      state: String(addressIn.state || '').trim().slice(0, 80),
      pincode: String(addressIn.pincode || '').replace(/\D/g, '').slice(-6),
    };
    if (!address.name || !address.line || !address.city || !address.state || address.pincode.length !== 6) {
      return res.status(400).json({ error: 'A complete delivery address is required.' });
    }

    let orderCode = normalizeOrderCode(body.order_code || body.orderCode);
    if (orderCode && !ORDER_CODE_RE.test(orderCode)) {
      return res.status(400).json({ error: 'Invalid order code.' });
    }
    if (!orderCode) {
      const now = new Date();
      const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
      orderCode = `SMF-${date}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    }

    const sanitizedPayload = {
      email,
      phone,
      items: [{
        name: PRODUCT_NAME,
        variant: PRODUCT_SIZE,
        quantity,
        price: UNIT_PRICE_RUPEES,
      }],
      amount: subtotalPaise,
      address,
      order_code: orderCode,
      fbp: String(body.fbp || '').trim().slice(0, 128),
      fbc: String(body.fbc || '').trim().slice(0, 256),
      event_source_url: String(body.event_source_url || '').trim().slice(0, 512),
    };

    const localOrder = await ensurePendingLocalOrder(sanitizedPayload);
    if (localOrder.payment_attempt_id) {
      return res.status(200).json(responseForOrder(localOrder, localOrder.payment_attempt_id));
    }

    const razorpay = razorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: subtotalPaise,
      currency: 'INR',
      receipt: orderCode,
      notes: {
        smelloff_order_code: orderCode,
        sku: PRODUCT_SKU,
      },
    });

    if (!razorpayOrder?.id || Number(razorpayOrder.amount) !== subtotalPaise || String(razorpayOrder.currency).toUpperCase() !== 'INR') {
      fail('Razorpay returned an invalid order response.', 502);
    }

    const persisted = await persistRazorpayOrderId(orderCode, razorpayOrder.id);
    return res.status(200).json(responseForOrder(persisted, razorpayOrder.id));
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('[api/create-order] error:', error?.message || error);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.message || 'Unable to start secure checkout. Please try again.',
    });
  }
}
