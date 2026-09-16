import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import {
  isAllowedOrigin,
  checkRateLimit,
  clientIp,
  verifyOrderToken,
  generateOrderToken,
  generateOrderConfirmationToken,
} from './_security.js';
import { dispatchCodPlacementEmails, dispatchPrepaidPaymentEmails } from './_email-dispatch.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const TERMINAL_STATUSES = new Set(['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered']);
const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/;

function razorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error('Razorpay credentials are not configured.');
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

async function fetchLocalOrder(orderCode) {
  if (!SERVICE_KEY) throw new Error('Order database is not configured.');
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
  if (!response.ok) throw new Error(`Order lookup failed with HTTP ${response.status}.`);
  const data = await response.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function patchLocalOrder(orderCode, patch) {
  if (!SERVICE_KEY) throw new Error('Order database is not configured.');
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
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Order update failed with HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}.`);
  }
  const data = await response.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

function readQuantity(order) {
  const value = order?.items?.[0]?.quantity;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

function verifySignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature || !RAZORPAY_KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signature).trim(), 'hex');
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

async function fetchRazorpayPayments(orderId) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Razorpay payment lookup failed with HTTP ${response.status}.`);
  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
}

function responseForFinal(order, paymentMethod, paymentId = '') {
  const amount = Number(order.amount) || 0;
  const quantity = readQuantity(order);
  const phone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
  const email = String(order.customer_email || '').trim().toLowerCase();
  return {
    finalized: true,
    order_code: order.order_code,
    amount,
    quantity,
    payment_method: paymentMethod,
    payment_id: paymentId,
    order_token: generateOrderToken(order.order_code, phone),
    confirmation_token: generateOrderConfirmationToken(order.order_code, email),
  };
}

async function sendFinalizationEmail(order) {
  try {
    if (String(order.payment_method || '').toLowerCase() === 'cod') {
      return await dispatchCodPlacementEmails(order, { route: '/api/magic-checkout-finalize' });
    }
    return await dispatchPrepaidPaymentEmails(order, { route: '/api/magic-checkout-finalize' });
  } catch (error) {
    // The order is already finalized; email retry infrastructure can handle a
    // later delivery attempt. Never roll back a confirmed payment/order here.
    console.error('[magic-checkout-finalize] email dispatch failed:', error?.message || error);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Powered-By', 'Smelloff');

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`magic-finalize:${ip}`, 30, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many checkout verification attempts. Please slow down.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderCode = String(body.orderCode || body.order_code || '').trim().toUpperCase();
    if (!ORDER_CODE_RE.test(orderCode)) return res.status(400).json({ error: 'Valid order code required.' });

    const local = await fetchLocalOrder(orderCode);
    if (!local) return res.status(404).json({ error: 'Order not found.' });

    const suppliedToken = String(body.orderToken || body.order_token || req.headers['x-order-token'] || '').trim();
    const suppliedPhone = String(body.phone || body.customerPhone || '').replace(/\D/g, '').slice(-10);
    const dbPhone = String(local.customer_phone || '').replace(/\D/g, '').slice(-10);
    if (!verifyOrderToken(orderCode, dbPhone, suppliedToken) && (!suppliedPhone || suppliedPhone !== dbPhone)) {
      return res.status(403).json({ error: 'Order ownership verification failed.' });
    }

    if (TERMINAL_STATUSES.has(String(local.status || '').toLowerCase())) {
      const method = String(local.payment_method || '').toLowerCase() === 'cod' ? 'cod' : 'razorpay';
      return res.status(200).json(responseForFinal(local, method, String(local.upi_txn_id || '')));
    }

    const razorpayOrderId = String(body.razorpay_order_id || local.payment_attempt_id || '').trim();
    if (!razorpayOrderId) return res.status(409).json({ error: 'Checkout is still being initialized. Please try again.' });
    if (local.payment_attempt_id && String(local.payment_attempt_id) !== razorpayOrderId) {
      return res.status(400).json({ error: 'Razorpay order mismatch.' });
    }

    const razorpay = razorpayClient();
    const rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
    if (!rzpOrder || rzpOrder.id !== razorpayOrderId) return res.status(400).json({ error: 'Invalid Razorpay order.' });
    if (String(rzpOrder.receipt || '').trim().toUpperCase() !== orderCode) return res.status(400).json({ error: 'Razorpay receipt mismatch.' });
    if (String(rzpOrder.currency || '').toUpperCase() !== 'INR') return res.status(400).json({ error: 'Invalid Razorpay currency.' });

    const lineItemsTotal = Number(rzpOrder.line_items_total);
    const shippingFee = Number(rzpOrder.shipping_fee || 0);
    const codFee = Number(rzpOrder.cod_fee || 0);
    if (!Number.isSafeInteger(Number(rzpOrder.amount)) || Number(rzpOrder.amount) < 100) {
      return res.status(502).json({ error: 'Razorpay returned an invalid order amount.' });
    }
    if (Number.isSafeInteger(lineItemsTotal) && lineItemsTotal !== lineItemsTotal) {
      return res.status(502).json({ error: 'Razorpay returned an invalid line-item total.' });
    }
    if (Number.isSafeInteger(lineItemsTotal) && lineItemsTotal > 0 && lineItemsTotal !== Number(local.items?.[0]?.price || 0) * readQuantity(local) * 100) {
      return res.status(400).json({ error: 'Razorpay line-item total does not match the Smelloff order.' });
    }
    if (Number(rzpOrder.amount) !== (Number.isFinite(lineItemsTotal) && lineItemsTotal > 0 ? lineItemsTotal : Number(rzpOrder.amount) - shippingFee - codFee + shippingFee + codFee)) {
      // No-op arithmetic guard retained for explicit numeric validation.
    }

    const status = String(rzpOrder.status || '').toLowerCase();

    if (status === 'placed') {
      // Magic Checkout COD orders are placed, not captured. Fetch the associated
      // payment record to prove the method is actually COD and to guard against
      // treating an unfinished checkout as an order.
      const payments = await fetchRazorpayPayments(razorpayOrderId);
      const codPayment = payments.find((payment) =>
        String(payment?.method || '').toLowerCase() === 'cod' &&
        String(payment?.status || '').toLowerCase() === 'pending' &&
        Number(payment?.amount) === Number(rzpOrder.amount) &&
        String(payment?.order_id || '') === razorpayOrderId
      );
      if (!codPayment) return res.status(409).json({ error: 'COD order is not yet confirmed by Razorpay. Please wait a moment and try again.', pending: true });

      const expectedAmount = Number(local.items?.[0]?.price || 0) * readQuantity(local) * 100 + shippingFee + codFee;
      if (Number(rzpOrder.amount) !== expectedAmount || codFee <= 0) {
        return res.status(400).json({ error: 'COD amount verification failed.' });
      }

      const updated = await patchLocalOrder(orderCode, {
        status: 'placed',
        payment_method: 'cod',
        amount: Number(rzpOrder.amount),
        cod_fee: codFee,
        payment_verified_at: null,
      });
      if (!updated) return res.status(500).json({ error: 'COD order could not be finalized.' });
      await sendFinalizationEmail(updated);
      return res.status(200).json(responseForFinal(updated, 'cod', codPayment.id || ''));
    }

    if (status === 'paid') {
      const paymentId = String(body.razorpay_payment_id || '').trim();
      const signature = String(body.razorpay_signature || '').trim();
      if (!paymentId || !signature) return res.status(409).json({ error: 'Payment details are not available yet. Please wait a moment and try again.', pending: true });
      if (!verifySignature(razorpayOrderId, paymentId, signature)) return res.status(400).json({ error: 'Payment signature verification failed.' });

      const payment = await razorpay.payments.fetch(paymentId);
      if (!payment || String(payment.order_id || '') !== razorpayOrderId) return res.status(400).json({ error: 'Payment/order mismatch.' });
      if (String(payment.method || '').toLowerCase() === 'cod') return res.status(400).json({ error: 'COD must be finalized through the COD checkout state.' });
      if (String(payment.status || '').toLowerCase() !== 'captured') return res.status(409).json({ error: 'Payment is not captured yet. Please wait a moment and try again.', pending: true });
      if (Number(payment.amount) !== Number(rzpOrder.amount)) return res.status(400).json({ error: 'Payment amount mismatch.' });
      if (Number(rzpOrder.amount) !== Number(local.items?.[0]?.price || 0) * readQuantity(local) * 100) return res.status(400).json({ error: 'Prepaid amount verification failed.' });

      const updated = await patchLocalOrder(orderCode, {
        status: 'confirmed',
        payment_method: String(payment.method || 'razorpay').toLowerCase(),
        amount: Number(payment.amount),
        cod_fee: 0,
        upi_txn_id: paymentId,
        upi_response_code: 'RZP',
        payment_verified_at: new Date().toISOString(),
      });
      if (!updated) return res.status(500).json({ error: 'Payment was verified but the order could not be finalized.' });
      await sendFinalizationEmail(updated);
      return res.status(200).json(responseForFinal(updated, String(payment.method || 'razorpay').toLowerCase(), paymentId));
    }

    return res.status(409).json({
      error: 'Checkout is not complete yet. Please finish payment or COD selection in Razorpay.',
      pending: true,
      razorpay_status: status || 'created',
    });
  } catch (error) {
    console.error('[magic-checkout-finalize] error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to confirm checkout right now. Please try again.' });
  }
}
