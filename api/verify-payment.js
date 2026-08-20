import {
  isAllowedOrigin,
  clientIp,
  checkRateLimit,
  verifyOrderToken,
  validateAndNormalizeUtr
} from './_security.js';
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return paymentStatusHandler(req, res);
  }

  // Obsolete POST manual UTR flow is permanently retired
  return res.status(410).json({
    error: 'Manual UTR submission is deprecated and disabled. All UPI payments are verified automatically.'
  });
}
