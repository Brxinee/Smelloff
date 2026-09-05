import { isAllowedOrigin, clientIp, checkRateLimit, verifyOrderToken, validateAndNormalizeUtr } from './_security.js';
import paymentStatusHandler from './payment-status.js';

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
        }
      }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase UTR collision check error:', err.message);
    return null;
  }
}

async function updateOrderUtr(orderCode, normalizedUtr) {
  if (!SERVICE_KEY || !orderCode || !normalizedUtr) return null;
  try {
    const patchBody = {
      upi_ref: normalizedUtr,
      status: 'verification_pending',
      updated_at: new Date().toISOString()
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase UTR patch error:', err.message);
    return null;
  }
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

  // GET requests delegate to paymentStatusHandler for query status
  if (req.method === 'GET') {
    return paymentStatusHandler(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`verify-utr:${ip}`, 20, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderCode = String(body.orderCode || body.orderId || body.order_code || '').trim().toUpperCase();
    const rawUtr = String(body.upiRef || body.utr || body.upi_ref || body.transactionRef || '').trim();
    const customerPhone = String(body.phone || body.customerPhone || body.customer_phone || '').replace(/\D/g, '').slice(-10);
    const orderToken = String(body.orderToken || body.order_token || req.headers['x-order-token'] || '').trim();

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
    }

    const normalizedUtr = validateAndNormalizeUtr(rawUtr);
    if (!normalizedUtr) {
      return res.status(400).json({ error: 'Valid 10–24 character UPI reference / UTR number required.' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ownership verification
    const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
    const tokenValid = orderToken ? verifyOrderToken(orderCode, dbPhone, orderToken) : false;
    const phoneValid = customerPhone && dbPhone && customerPhone === dbPhone;

    if (!tokenValid && !phoneValid) {
      return res.status(403).json({ error: 'Order ownership verification failed. Valid order token or phone required.' });
    }

    // If order is already confirmed / fulfilled
    const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (terminalConfirmedStates.includes(order.status)) {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: order.status,
        verified: true,
        message: 'Order payment is already verified and confirmed.'
      });
    }

    if (order.status === 'cancelled' || order.status === 'failed') {
      return res.status(400).json({
        error: `Order is currently in '${order.status}' status and cannot accept UTR submission.`
      });
    }

    // Check for duplicate active UTR across other orders
    const collision = await findActiveOrderWithUtr(normalizedUtr, orderCode);
    if (collision) {
      return res.status(409).json({
        error: 'This UPI reference / UTR has already been submitted for another order. Please check and enter the correct UTR from your UPI transaction.'
      });
    }

    // Save normalized UTR and advance status to verification_pending
    const updated = await updateOrderUtr(orderCode, normalizedUtr);

    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      status: 'verification_pending',
      upiRef: normalizedUtr,
      message: 'UTR submitted successfully. Payment verification is pending admin review.'
    });
  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return res.status(500).json({ error: 'Failed to submit UTR. Please try again.' });
  }
}
