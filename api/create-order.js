import crypto from 'node:crypto';
import { createRazorpayOrder } from './_razorpay.js';
import {
  isAllowedOrigin,
  clientIp,
  checkRateLimit,
  generateOrderToken,
  generateOrderConfirmationToken,
} from './_security.js';
import { BASE_PRODUCT, subtotalForQuantity, codFeeForPincode } from '../shared/products-config-workers.js';
import { isValidEmail } from './_email.js';
import { sendAdminNewOrderEmail } from './_email-dispatch.js';
import { pushOrderToShiprocketNow } from './shiprocket-sync.js';
import { runAfterResponse } from './_background.js';
import { syncSheetsNow } from './sheets-sync.js';
import { orderAttribution } from './_attribution.js';

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

  return { orders: { create: createRazorpayOrder } };
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
    ...(payload.attribution ? { attribution: payload.attribution } : {}),
    ...(payload.payment_attempt_id ? { payment_attempt_id: payload.payment_attempt_id } : {}),
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
    ...(payload.attribution ? { attribution: payload.attribution } : {}),
  };
}

// POST one order row. `attribution` is the newest column (2026-10-20); if the
// database hasn't got it yet, PostgREST answers 400 PGRST204 naming it, and
// the row goes in without it rather than losing the order.
async function postOrderRow(record) {
  const send = (body) => fetch(`${getSupabaseUrl()}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let response = await send(record);
  let data = await readJsonResponse(response);
  if (!response.ok && 'attribution' in record && data?.code === 'PGRST204' && /attribution/.test(String(data?.message || ''))) {
    console.error('[api/create-order] orders.attribution is missing; saving the order without it. Apply supabase/migrations/20261020_order_attribution.sql.');
    const { attribution, ...rest } = record;
    response = await send(rest);
    data = await readJsonResponse(response);
  }
  if (!response.ok) {
    // Log the database's own message; the shopper gets a generic one, so table
    // and constraint names never reach the browser.
    console.error('[api/create-order] order insert failed:', response.status, data?.message || data?.error || '');
    const error = new Error('Order database is temporarily unavailable. Please try again.');
    error.statusCode = 503;
    error.isDuplicate = response.status === 409 || data?.code === '23505';
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) fail('Order database returned an invalid response.');
  return row;
}

async function insertPendingOrder(payload) {
  if (!getServiceKey()) fail('Order database credentials are not configured.');
  return postOrderRow(buildPrepaidOrderRecord(payload));
}

async function insertCodOrder(payload) {
  if (!getServiceKey()) fail('Order database credentials are not configured.');
  return postOrderRow(buildCodOrderRecord(payload));
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

// `prefetched` is the row ownOrderCode() already read for this code, so the
// lookup isn't repeated (one fewer database round trip before Pay opens).
async function ensurePendingLocalOrder(payload, prefetched) {
  let existing = prefetched !== undefined ? prefetched : await fetchOrderByCode(payload.order_code);

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

async function ensureCodLocalOrder(payload, prefetched) {
  let existing = prefetched !== undefined ? prefetched : await fetchOrderByCode(payload.order_code);

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

function newOrderCode() {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `SMF-${date}-${String(crypto.randomInt(10000)).padStart(4, '0')}`;
}

// The browser picks the order number from 9,000 per day, so two customers can
// draw the same one. Keep it if it is free or already this customer's (a
// retry); otherwise pick a fresh one. The browser uses the code we return.
// Returns the row it read too (null when the code is free).
async function ownOrderCode(requested, phone, email) {
  let code = requested || newOrderCode();
  for (let i = 0; i < 5; i++) {
    const existing = await fetchOrderByCode(code);
    if (!existing) return { code, existing: null };
    if (normalizePhone(existing.customer_phone) === phone
      && String(existing.customer_email || '').trim().toLowerCase() === email) return { code, existing };
    code = newOrderCode();
  }
  fail('Could not allocate an order number. Please try again.', 503);
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

  // Every COD order emails the owner and books a Shiprocket shipment, so an
  // unthrottled endpoint lets a script fill the courier queue with fake
  // parcels. A real shopper retries a handful of times at most.
  if (!checkRateLimit(`create-order:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many order attempts. Please wait a few minutes and try again.' });
  }

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

    // Fives at product.fivePackPrice ("5 for ₹899"), pairs at product.pairPrice ("2 for ₹419"); items[].price stays the unit price.
    const subtotalPaise = Math.round(subtotalForQuantity(quantity) * 100);
    // COD pays a shipping charge by delivery pincode (prepaid ships free).
    const feePincode = String((body.address && body.address.pincode) || '').replace(/\D/g, '').slice(-6);
    const codFeePaise = isCod ? Math.round(codFeeForPincode(feePincode) * 100) : 0;
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
    const owned = await ownOrderCode(orderCode, phone, email);
    orderCode = owned.code;

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
    sanitizedPayload.attribution = orderAttribution(body.attribution, { fbc: sanitizedPayload.fbc });

    if (isCod) {
      const localOrder = await ensureCodLocalOrder(sanitizedPayload, owned.existing);
      // A COD order is real the moment it exists: alert the owner, book it
      // in Shiprocket and copy it into the Google Sheet. All run after the
      // response (waitUntil on Workers), so checkout doesn't wait. The alert's
      // idempotency key absorbs retries; the 15-minute cron retries any
      // Shiprocket create or sheet write that fails here.
      await runAfterResponse('create-order', () => Promise.all([
        sendAdminNewOrderEmail(localOrder, { route: '/api/create-order' }),
        pushOrderToShiprocketNow(localOrder, { route: '/api/create-order' })
          .then(() => syncSheetsNow('/api/create-order')),
      ]));
      return res.status(200).json(responseForCod(localOrder));
    }

    const prepaidPayload = { ...sanitizedPayload, amount: subtotalPaise };

    async function openRazorpayOrder() {
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
      return razorpayOrder;
    }

    // A fresh order (the usual case): create the Razorpay order first, then
    // save the row with its id in one write. That is lookup → Razorpay →
    // insert, where it used to be lookup → lookup → insert → Razorpay → link.
    if (!owned.existing) {
      const razorpayOrder = await openRazorpayOrder();
      let inserted = null;
      try {
        inserted = await insertPendingOrder({ ...prepaidPayload, payment_attempt_id: razorpayOrder.id });
      } catch (error) {
        if (!error?.isDuplicate) throw error;
      }
      if (inserted && String(inserted.payment_attempt_id) === String(razorpayOrder.id)) {
        return res.status(200).json(responseForOrder(inserted, razorpayOrder.id));
      }
      // Lost a race for this code (or the insert didn't keep the id): settle
      // on the saved row as a retry would.
      const localOrder = inserted || await ensurePendingLocalOrder(prepaidPayload);
      if (localOrder.payment_attempt_id) {
        return res.status(200).json(responseForOrder(localOrder, localOrder.payment_attempt_id));
      }
      const persisted = await persistRazorpayOrderId(orderCode, razorpayOrder.id);
      return res.status(200).json(responseForOrder(persisted, razorpayOrder.id));
    }

    const localOrder = await ensurePendingLocalOrder(prepaidPayload, owned.existing);
    if (localOrder.payment_attempt_id) {
      return res.status(200).json(responseForOrder(localOrder, localOrder.payment_attempt_id));
    }

    const razorpayOrder = await openRazorpayOrder();
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
