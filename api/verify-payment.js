import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { isAllowedOrigin, clientIp, checkRateLimit, verifyOrderToken, validateAndNormalizeUtr } from './_security.js';
import paymentStatusHandler from './payment-status.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function razorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error('Razorpay credentials are not configured.');
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase fetch error:', err.message);
    return null;
  }
}

async function patchOrder(orderCode, patchBody) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ ...patchBody, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase update error:', err.message);
    return null;
  }
}

async function findActiveOrderWithUtr(normalizedUtr, currentOrderCode) {
  if (!SERVICE_KEY || !normalizedUtr) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?upi_ref=eq.${encodeURIComponent(normalizedUtr)}&order_code=neq.${encodeURIComponent(currentOrderCode)}&status=in.(confirmed,verification_pending,packed,dispatched,out_for_delivery,delivered)&select=order_code,status`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] UTR collision check error:', err.message);
    return null;
  }
}

async function verifyRazorpayPayment(body, order) {
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const razorpayOrderId = String(body.razorpay_order_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();

  if (!paymentId || !razorpayOrderId || !signature) {
    return { status: 400, body: { error: 'razorpay_payment_id, razorpay_order_id and razorpay_signature are required.' } };
  }

  const storedRazorpayOrderId = String(order.payment_attempt_id || '').trim();
  if (!storedRazorpayOrderId || storedRazorpayOrderId !== razorpayOrderId) {
    return { status: 400, body: { error: 'Razorpay order mismatch.' } };
  }

  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${storedRazorpayOrderId}|${paymentId}`)
    .digest('hex');

  let signatureMatches = false;
  try {
    const expected = Buffer.from(generatedSignature, 'hex');
    const provided = Buffer.from(signature, 'hex');
    signatureMatches = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  } catch {
    signatureMatches = false;
  }

  if (!signatureMatches) {
    return { status: 400, body: { error: 'Payment signature verification failed.' } };
  }

  // The signature proves the checkout response came from Razorpay. Also confirm
  // the payment belongs to the same server-created Razorpay order before marking
  // the Smelloff order paid.
  try {
    const razorpay = razorpayClient();
    const payment = await razorpay.payments.fetch(paymentId);
    if (!payment || payment.order_id !== storedRazorpayOrderId) {
      return { status: 400, body: { error: 'Payment order mismatch.' } };
    }
    if (!['captured', 'authorized'].includes(String(payment.status || '').toLowerCase())) {
      return { status: 400, body: { error: 'Payment has not been successfully authorized.' } };
    }
  } catch (error) {
    console.error('[verify-payment] Razorpay payment fetch failed:', error?.message || error);
    return { status: 502, body: { error: 'Unable to confirm the Razorpay payment status. Please try again.' } };
  }

  const updated = await patchOrder(order.order_code, {
    status: 'confirmed',
    upi_txn_id: paymentId,
    upi_response_code: 'RZP',
    payment_verified_at: new Date().toISOString(),
  });

  if (!updated) {
    return { status: 500, body: { error: 'Payment was verified but the order could not be updated. Please contact support.' } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      verified: true,
      status: 'confirmed',
      orderId: order.order_code,
      razorpayPaymentId: paymentId,
      razorpayOrderId: storedRazorpayOrderId,
      message: 'Payment verified successfully.'
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return paymentStatusHandler(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`verify-payment:${ip}`, 20, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderCode = String(body.orderCode || body.orderId || body.order_code || '').trim().toUpperCase();
    const customerPhone = String(body.phone || body.customerPhone || body.customer_phone || '').replace(/\D/g, '').slice(-10);
    const orderToken = String(body.orderToken || body.order_token || req.headers['x-order-token'] || '').trim();

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
    const tokenValid = orderToken ? verifyOrderToken(orderCode, dbPhone, orderToken) : false;
    const phoneValid = customerPhone && dbPhone && customerPhone === dbPhone;
    if (!tokenValid && !phoneValid) {
      return res.status(403).json({ error: 'Order ownership verification failed. Valid order token or phone required.' });
    }

    // Razorpay Standard Checkout verification path.
    if (body.razorpay_payment_id || body.razorpay_order_id || body.razorpay_signature) {
      if (!RAZORPAY_KEY_SECRET) return res.status(500).json({ error: 'Razorpay verification is not configured on the server.' });
      const result = await verifyRazorpayPayment(body, order);
      return res.status(result.status).json(result.body);
    }

    // Legacy/manual UTR verification is retained for old orders and compatibility.
    const rawUtr = String(body.upiRef || body.utr || body.upi_ref || body.transactionRef || '').trim();
    const normalizedUtr = validateAndNormalizeUtr(rawUtr);
    if (!normalizedUtr) {
      return res.status(400).json({ error: 'Valid 10–24 character UPI reference / UTR number required.' });
    }

    const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (terminalConfirmedStates.includes(order.status)) {
      return res.status(200).json({ ok: true, orderId: orderCode, status: order.status, verified: true, message: 'Order payment is already verified and confirmed.' });
    }

    if (order.status === 'cancelled' || order.status === 'failed') {
      return res.status(400).json({ error: `Order is currently in '${order.status}' status and cannot accept UTR submission.` });
    }

    const collision = await findActiveOrderWithUtr(normalizedUtr, orderCode);
    if (collision) {
      return res.status(409).json({ error: 'This UPI reference / UTR has already been submitted for another order. Please check and enter the correct UTR from your UPI transaction.' });
    }

    const updated = await patchOrder(orderCode, { upi_ref: normalizedUtr, status: 'verification_pending' });
    if (!updated) return res.status(500).json({ error: 'Failed to save UTR. Please try again.' });

    return res.status(200).json({ ok: true, orderId: orderCode, status: 'verification_pending', upiRef: normalizedUtr, message: 'UTR submitted successfully. Payment verification is pending admin review.' });
  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return res.status(500).json({ error: 'Failed to verify payment. Please try again.' });
  }
}
