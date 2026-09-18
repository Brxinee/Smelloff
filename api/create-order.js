import Razorpay from 'razorpay';
import {
  isAllowedOrigin,
  generateOrderToken,
  generateOrderConfirmationToken,
} from './_security.js';
import { BASE_PRODUCT } from '../shared/products-config.js';
import { isValidEmail } from './_email.js';

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || '';
}

function getRazorpayKeySecret() {
  return process.env.RAZORPAY_KEY_SECRET || '';
}

const UNIT_PRICE_RUPEES = Number(BASE_PRODUCT.price);
const COD_FEE_RUPEES = Number(BASE_PRODUCT.codFee);
const MAX_QUANTITY = Number(BASE_PRODUCT.maxQuantity);
const PRODUCT_NAME = String(BASE_PRODUCT.title || BASE_PRODUCT.name || 'ODORSTRIKE Fabric Mist');
const PRODUCT_SIZE = String(BASE_PRODUCT.size || '50ml');
const PRODUCT_SKU = String(BASE_PRODUCT.sku || BASE_PRODUCT.id || 'OS-001-50ML');
const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/;
const TERMINAL_STATES = new Set(['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned']);
const PREPAID_PAYMENT_METHOD = 'upi';
const PREPAID_INITIAL_STATUS = 'upi_pending';
const COD_PAYMENT_METHOD = 'cod';
const COD_INITIAL_STATUS = 'placed';

function fail(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function normalizeOrderCode(value) {
  return String(value || '').trim().toUpperCase();
}

function razorpayClient() {
  if (typeof globalThis.__MOCK_RAZORPAY_ORDER_CREATE__ === 'function') {
    return {
      orders: {
        create: globalThis.__MOCK_RAZORPAY_ORDER_CREATE__,
      },
    };
  }

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    fail('Razorpay credentials are not configured.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function supabaseHeaders() {
  const serviceKey = getServiceKey();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

async function readJsonResponse(response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function fetchOrderByCode(orderCode) {
  if (!getServiceKey()) fail('Order database credentials are not configured.');
  if (!orderCode) return null;

  try {
    const response = await fetch(
      `${getSupabaseUrl()}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=id,order_code,customer_email,customer_phone,amount,status,payment_method,payment_attempt_id,cod_fee`,
      {
        headers: supabaseHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[api/create-order] order lookup failed:', response.status, detail.slice(0, 300));
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

function buildPrepaidOrderRecord(payload) {
  return {
    customer_email: payload.email,
    customer_phone: payload.phone,
    items: payload.items,
    amount: payload.amount,
    payment_method: PREPAID_PAYMENT_METHOD,
    status: PREPAID_INITIAL_STATUS,
    address: payload.address,
    order_code: payload.order_code,
    cod_fee: 0,
    fbp: payload.fbp || null,
    fbc: payload.fbc || null,
    event_source_url: payload.event_source_url || null,
  };
}

function buildCodOrderRecord(payload) {
  return {
    customer_email: payload.email,
    customer_phone: payload.phone,
    items: payload.items,
    amount: payload.amount,
    payment_method: COD_PAYMENT_METHOD,
    status: COD_INITIAL_STATUS,
    address: payload.address,
    order_code: payload.order_code,
    cod_fee: payload.cod_fee,
    upi_ref: null,
    fbp: payload.fbp || null,
    fbc: payload.fbc || null,
    event_source_url: payload.event_source_url || null,
  };
}

async function insertPendingOrder(payload) {
  if (!getServiceKey()) fail('Order database credentials are not configured.');

  const response = await fetch(`${getSupabaseUrl()}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(buildPrepaidOrderRecord(payload)),
    signal: AbortSignal.timeout(10000),
  });

  const data = await readJsonResponse(response);
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

async function insertCodOrder(payload) {
  if (!getServiceKey()) fail('Order database credentials are not configured.');

  const response = await fetch(`${getSupabaseUrl()}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(buildCodOrderRecord(payload)),
    signal: AbortSignal.timeout(10000),
  });

  const data = await readJsonResponse(response);
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
    `${getSupabaseUrl()}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        customer_email: payload.email,
        customer_phone: payload.phone,
        items: payload.items,
        amount: payload.amount,
        payment_method: PREPAID_PAYMENT_METHOD,
        status: PREPAID_INITIAL_STATUS,
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
    const detail = await response.text().catch(() => '');
    console.error('[api/create-order] pending order update failed:', response.status, detail.slice(0, 300));
    fail('Order database is temporarily unavailable. Please try again.', 503);
  }

  const data = await response.json().catch(() => []);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) fail('Order database returned an invalid update response.');
  return row;
}

async function persistRazorpayOrderId(orderCode, razorpayOrderId) {
  const response = await fetch(
    `${getSupabaseUrl()}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(),
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
    const detail = await response.text().catch(() => '');
    console.error('[api/create-order] Razorpay mapping failed:', response.status, detail.slice(0, 300));
    fail('Payment order was created but could not be linked to your order. Please try again.', 503);
  }

  const data = await response.json().catch(() => []);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.payment_attempt_id || String(row.payment_attempt_id) !== String(razorpayOrderId)) {
    fail('Payment order was created but could not be linked to your order. Please try again.', 503);
  }
  return row;
}

function assertSameCheckout(existing, payload) {
  const sameCustomer = normalizePhone(existing.customer_phone) === normalizePhone(payload.phone)
    && String(existing.customer_email || '').trim().toLowerCase() === payload.email;
  if (!sameCustomer || Number(existing.amount) !== Number(payload.amount)) {
    fail('This checkout session is no longer valid. Please refresh and try again.', 409);
  }

  if (String(existing.payment_method || '').toLowerCase() === 'cod') {
    fail('This checkout session is already associated with a COD order. Please start a new checkout.', 409);
  }

  if (TERMINAL_STATES.has(String(existing.status || '').toLowerCase())) {
    fail('This order has already been completed. Please start a new checkout.', 409);
  }
}

function assertSameCodCheckout(existing, payload) {
  const sameCustomer = normalizePhone(existing.customer_phone) === normalizePhone(payload.phone)
    && String(existing.customer_email || '').trim().toLowerCase() === payload.email;
  if (!sameCustomer || Number(existing.amount) !== Number(payload.amount)) {
    fail('This checkout session is no longer valid. Please refresh and try again.', 409);
  }

  if (String(existing.payment_method || '').toLowerCase() !== COD_PAYMENT_METHOD) {
    fail('This checkout session is already associated with a prepaid payment. Please start a new checkout.', 409);
  }

  if (TERMINAL_STATES.has(String(existing.status || '').toLowerCase())) {
    fail('This COD order has already been completed. Please start a new checkout.', 409);
  }
}

async function ensurePendingLocalOrder(payload) {
  let existing = await fetchOrderByCode(payload.order_code);

  if (existing) {
    assertSameCheckout(existing, payload);
    if (existing.payment_attempt_id) return existing;
    return updatePendingOrder(payload.order_code, payload);
  }

  try {
    return await insertPendingOrder(payload);
  } catch (error) {
    if (!error?.isDuplicate) throw error;
    existing = await fetchOrderByCode(payload.order_code);
    if (!existing) throw error;

    assertSameCheckout(existing, payload);
    if (existing.payment_attempt_id) return existing;
    return updatePendingOrder(payload.order_code, payload);
  }
}

async function ensureCodLocalOrder(payload) {
  let existing = await fetchOrderByCode(payload.order_code);

  if (existing) {
    assertSameCodCheckout(existing, payload);
    return existing;
  }

  try {
    return await insertCodOrder(payload);
  } catch (error) {
    if (!error?.isDuplicate) throw error;
    existing = await fetchOrderByCode(payload.order_code);
    if (!existing) throw error;
    assertSameCodCheckout(existing, payload);
    return existing;
  }
}

function responseForOrder(localOrder, razorpayOrderId) {
  return {
    id: localOrder.id,
    order_code: localOrder.order_code,
    order_id: razorpayOrderId,
    amount: Number(localOrder.amount),
    currency: 'INR',
    key_id: getRazorpayKeyId(),
    order_token: generateOrderToken(localOrder.order_code, localOrder.customer_phone),
    confirmation_token: generateOrderConfirmationToken(localOrder.order_code, localOrder.customer_email),
  };
}

function responseForCod(localOrder) {
  return {
    id: localOrder.id,
    order_code: localOrder.order_code,
    amount: Number(localOrder.amount),
    currency: 'INR',
    cod_fee: Number(localOrder.cod_fee || 0),
  };
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
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const requestedPaymentMethod = String(body.payment_method || 'pending').trim().toLowerCase();
    if (!['pending', 'upi', 'cod'].includes(requestedPaymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }
    const isCod = requestedPaymentMethod === COD_PAYMENT_METHOD;
    const paymentMethod = isCod ? COD_PAYMENT_METHOD : PREPAID_PAYMENT_METHOD;

    const RAZORPAY_KEY_ID = getRazorpayKeyId();
    const RAZORPAY_KEY_SECRET = getRazorpayKeySecret();
    const SERVICE_KEY = getServiceKey();

    if (!body.items && body.amount !== undefined && (typeof body.amount !== 'number' || !Number.isInteger(body.amount) || body.amount < 100)) {
      return res.status(400).json({ error: 'Amount must be an integer of at least 100 paise.' });
    }

    const rawQty = body.items && body.items[0] && body.items[0].quantity !== undefined
      ? body.items[0].quantity
      : body.quantity;
    const quantity = typeof rawQty === 'number' && Number.isInteger(rawQty)
      ? rawQty
      : (rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== '' ? Number(rawQty) : 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || String(rawQty ?? '').includes('.')) {
      return res.status(400).json({ error: `Quantity must be an integer between 1 and ${MAX_QUANTITY}.` });
    }

    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length !== 1) {
        return res.status(400).json({ error: 'Exactly one ODORSTRIKE line item is required.' });
      }
      const firstItem = body.items[0] && typeof body.items[0] === 'object' ? body.items[0] : {};
      if (firstItem.price !== undefined && Number(firstItem.price) !== UNIT_PRICE_RUPEES) {
        return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
      }
    }

    const subtotalPaise = Math.round(UNIT_PRICE_RUPEES * quantity * 100);
    const codFeePaise = isCod ? Math.round(COD_FEE_RUPEES * 100) : 0;
    const totalPaise = subtotalPaise + codFeePaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) {
      return res.status(400).json({ error: 'Invalid order amount.' });
    }

    if (body.amount !== undefined) {
      const clientAmount = Number(body.amount);
      if (!Number.isSafeInteger(clientAmount) || clientAmount !== totalPaise) {
        return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
      }
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required for your receipt and delivery updates.' });
    }

    const phone = normalizePhone(body.phone);
    if (phone.length !== 10) {
      return res.status(400).json({ error: 'A valid 10-digit phone is required.' });
    }

    if (!isCod && (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)) {
      return res.status(500).json({ error: 'Razorpay is not configured on the server.' });
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

    if (!SERVICE_KEY) {
      return res.status(500).json({ error: 'Order database is not configured on the server.' });
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
      amount: totalPaise,
      address,
      order_code: orderCode,
      cod_fee: codFeePaise,
      fbp: String(body.fbp || '').trim().slice(0, 128),
      fbc: String(body.fbc || '').trim().slice(0, 256),
      event_source_url: String(body.event_source_url || '').trim().slice(0, 512),
    };

    if (isCod) {
      const localOrder = await ensureCodLocalOrder(sanitizedPayload);
      return res.status(200).json(responseForCod(localOrder));
    }

    const localOrder = await ensurePendingLocalOrder({ ...sanitizedPayload, amount: subtotalPaise });
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
      error: error?.message || 'Order service unavailable. Please try again.',
    });
  }
}
