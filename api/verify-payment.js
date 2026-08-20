import {
  isAllowedOrigin,
  clientIp,
  checkRateLimit,
  verifyOrderToken,
  validateAndNormalizeUtr
} from './_security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase fetch error:', err.message);
    return null;
  }
}

async function checkUtrConflict(utr, currentOrderCode) {
  if (!SERVICE_KEY || !utr) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?upi_ref=eq.${encodeURIComponent(utr)}&order_code=neq.${encodeURIComponent(currentOrderCode)}&status=in.(confirmed,verification_pending)&select=order_code`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function updateOrderToVerificationPending(orderCode, upiRef) {
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
      body: JSON.stringify({
        status: 'verification_pending',
        upi_ref: upiRef,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      console.error('[verify-payment] Supabase update failed:', res.status);
      return null;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase patch error:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`verify-payment:${ip}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderCode = String(body.orderCode || body.order_code || '').trim().toUpperCase();
    const rawUtr = String(body.upiRef || body.utr || body.upi_ref || '').trim();
    const customerPhone = String(body.phone || body.customerPhone || '').replace(/\D/g, '').slice(-10);
    const orderToken = String(body.orderToken || body.order_token || req.headers['x-order-token'] || '').trim();

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
    }

    const normalizedUtr = validateAndNormalizeUtr(rawUtr);
    if (!normalizedUtr) {
      return res.status(400).json({
        error: 'Please enter a valid 12-digit UPI reference / UTR number from your payment app.'
      });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please verify your order code.' });
    }

    // Ownership verification: phone number or cryptographic order token
    const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
    const tokenValid = orderToken ? verifyOrderToken(orderCode, dbPhone, orderToken) : false;
    const phoneValid = customerPhone && dbPhone && customerPhone === dbPhone;

    if (!tokenValid && !phoneValid) {
      return res.status(403).json({
        error: 'Order ownership verification failed. Please provide the phone number used during checkout.'
      });
    }

    if (order.payment_method === 'cod') {
      return res.status(400).json({
        error: 'Cash on Delivery orders do not require UPI verification.'
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        error: 'This order has been cancelled.'
      });
    }

    // If order is already confirmed or further down the pipeline, return current state without mutative overwrite
    const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (terminalConfirmedStates.includes(order.status)) {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: order.status,
        message: 'Order payment has already been verified and confirmed.'
      });
    }

    // Check for duplicate UTR usage across other orders
    const isConflict = await checkUtrConflict(normalizedUtr, orderCode);
    if (isConflict) {
      return res.status(409).json({
        error: 'This UPI reference (UTR) has already been submitted for another order. Please check your transaction details or contact support.'
      });
    }

    // Transition order state to verification_pending
    const updated = await updateOrderToVerificationPending(orderCode, normalizedUtr);
    if (!updated) {
      return res.status(500).json({ error: 'Could not update payment verification status.' });
    }

    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      status: 'verification_pending',
      message: 'Payment reference submitted for manual verification. Our team will verify your transaction shortly.'
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return res.status(500).json({ error: 'Internal verification submission error.' });
  }
}
