import { isAdminAuthorized } from './_security.js';
import { isValidTransition } from '../shared/products-config.js';

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
    console.error('[webhook] Supabase fetch error:', err.message);
    return null;
  }
}

async function updateOrderStatus(orderCode, status, upiRef) {
  if (!SERVICE_KEY || !orderCode) return false;
  try {
    const patchBody = {
      status,
      updated_at: new Date().toISOString()
    };
    if (upiRef) patchBody.upi_ref = upiRef;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(patchBody)
    });
    return res.ok;
  } catch (err) {
    console.error('[webhook] Order update error:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Strict Server-to-Server / Admin Authentication Required
  // In manual UPI system, unauthenticated webhooks are strictly rejected
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized webhook access. Valid server secret required.'
    });
  }

  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const orderCode = String(body.orderCode || body.order_code || '').trim().toUpperCase();
    const targetStatus = String(body.status || '').trim().toLowerCase();
    const upiRef = body.upiRef || body.utr || null;

    if (!orderCode || !targetStatus) {
      return res.status(400).json({ error: 'orderCode and status are required' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!isValidTransition(order.status, targetStatus, order.payment_method)) {
      return res.status(400).json({
        error: `Invalid state transition from '${order.status}' to '${targetStatus}'`
      });
    }

    const ok = await updateOrderStatus(orderCode, targetStatus, upiRef);
    if (!ok) {
      return res.status(500).json({ error: 'Failed to update order status' });
    }

    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      status: targetStatus
    });
  } catch (err) {
    console.error('[webhook] Error handling event:', err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
}
