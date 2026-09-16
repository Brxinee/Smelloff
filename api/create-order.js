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

function razorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials are not configured.');
    error.statusCode = 500;
    throw error;
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[api/create-order] Supabase fetch error:', err?.message || err);
    return null;
  }
}

async function persistRazorpayOrderId(orderCode, razorpayOrderId) {
  if (!SERVICE_KEY || !orderCode || !razorpayOrderId) return false;
  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_attempt_id: razorpayOrderId,
          updated_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    return response.ok;
  } catch (err) {
    console.error('[api/create-order] Razorpay mapping failed:', err?.message || err);
    return false;
  }
}

async function createLocalPendingOrder(payload) {
  const target = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-order`;
  const upstream = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const text = await upstream.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* handled below */ }
  if (!upstream.ok) {
    const error = new Error(data.error || `Order service returned HTTP ${upstream.status}`);
    error.statusCode = upstream.status;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length !== 1) return res.status(400).json({ error: 'Exactly one ODORSTRIKE line item is required.' });

    const firstItem = items[0] && typeof items[0] === 'object' ? items[0] : {};
    const rawQty = firstItem.quantity !== undefined ? firstItem.quantity : body.quantity;
    const quantity = typeof rawQty === 'number' && Number.isInteger(rawQty)
      ? rawQty
      : Number.parseInt(String(rawQty ?? 1), 10);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || String(rawQty).includes('.')) {
      return res.status(400).json({ error: `Quantity must be an integer between 1 and ${MAX_QUANTITY}.` });
    }

    if (firstItem.price !== undefined && Number(firstItem.price) !== UNIT_PRICE_RUPEES) {
      return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required for your receipt and delivery updates.' });
    }

    const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) return res.status(400).json({ error: 'A valid 10-digit phone is required.' });

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

    const subtotalPaise = Math.round(UNIT_PRICE_RUPEES * quantity * 100);
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 100) {
      return res.status(400).json({ error: 'Invalid order amount.' });
    }

    // New Magic Checkout orders are payment-method neutral at creation time.
    // COD is selected later inside Razorpay and its fee is returned by the
    // Magic Checkout Shipping Info API. Never accept a client-selected COD fee.
    const clientAmount = body.amount === undefined ? subtotalPaise : Number(body.amount);
    if (!Number.isSafeInteger(clientAmount) || clientAmount !== subtotalPaise) {
      return res.status(400).json({ error: 'Order total mismatch. Please refresh and try again.' });
    }

    const requestedOrderCode = String(body.order_code || body.orderCode || '').trim().toUpperCase();
    if (requestedOrderCode && !/^SMF-\d{8}-\d{4}$/.test(requestedOrderCode)) {
      return res.status(400).json({ error: 'Invalid order code.' });
    }

    let orderCode = requestedOrderCode || '';
    if (orderCode) {
      const existing = await fetchOrderByCode(orderCode);
      if (existing?.payment_attempt_id && Number(existing.amount) === subtotalPaise) {
        return res.status(200).json({
          id: existing.id,
          order_code: existing.order_code,
          order_id: existing.payment_attempt_id,
          amount: subtotalPaise,
          currency: 'INR',
          key_id: RAZORPAY_KEY_ID,
          order_token: generateOrderToken(existing.order_code, phone),
          confirmation_token: generateOrderConfirmationToken(existing.order_code, email),
        });
      }
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
      payment_method: 'pending',
      address,
      order_code: orderCode,
    };

    const existingBeforeCreate = await fetchOrderByCode(orderCode);
    if (existingBeforeCreate?.payment_attempt_id && Number(existingBeforeCreate.amount) === subtotalPaise) {
      return res.status(200).json({
        id: existingBeforeCreate.id,
        order_code: existingBeforeCreate.order_code,
        order_id: existingBeforeCreate.payment_attempt_id,
        amount: subtotalPaise,
        currency: 'INR',
        key_id: RAZORPAY_KEY_ID,
        order_token: generateOrderToken(existingBeforeCreate.order_code, phone),
        confirmation_token: generateOrderConfirmationToken(existingBeforeCreate.order_code, email),
      });
    }

    const localOrder = await createLocalPendingOrder(sanitizedPayload);
    orderCode = String(localOrder.order_code || orderCode).trim().toUpperCase();
    if (!/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      throw new Error('Order service returned an invalid order code.');
    }

    const razorpay = razorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: subtotalPaise,
      currency: 'INR',
      receipt: orderCode,
      line_items_total: subtotalPaise,
      line_items: [{
        sku: PRODUCT_SKU,
        variant_id: PRODUCT_SIZE.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || '50ml',
        price: Math.round(UNIT_PRICE_RUPEES * 100),
        offer_price: Math.round(UNIT_PRICE_RUPEES * 100),
        quantity,
        name: PRODUCT_NAME,
        description: 'Pocket-sized fabric odor-control mist for clothes.',
        image_url: PRODUCT_IMAGE,
        product_url: PRODUCT_URL,
      }],
      notes: {
        smelloff_order_code: orderCode,
        sku: PRODUCT_SKU,
      },
    });

    if (!razorpayOrder?.id || Number(razorpayOrder.amount) !== subtotalPaise || razorpayOrder.currency !== 'INR') {
      throw new Error('Razorpay returned an invalid order response.');
    }

    if (!await persistRazorpayOrderId(orderCode, razorpayOrder.id)) {
      throw new Error('Payment order was created but could not be linked to your order. Please try again.');
    }

    const orderToken = generateOrderToken(orderCode, phone);
    const confirmationToken = generateOrderConfirmationToken(orderCode, email);

    return res.status(200).json({
      id: localOrder.id,
      order_code: orderCode,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: RAZORPAY_KEY_ID,
      order_token: orderToken,
      confirmation_token: confirmationToken,
    });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('[api/create-order] error:', error?.message || error);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.message || 'Order service unavailable. Please try again.',
    });
  }
}
