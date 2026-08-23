import { isAllowedOrigin, clientIp, checkRateLimit, isAdminAuthorized, validateAndNormalizeUtr } from '../_security.js';
import { isValidTransition } from '../../shared/products-config.js';
import { orderConfirmation } from '../email-templates.js';
import { Resend } from 'resend';
import { createShiprocketOrder, extractShiprocketIds, isShiprocketConfigured } from '../_shiprocket.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

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
    console.error('[admin-verify] Supabase fetch error:', err.message);
    return null;
  }
}

async function updateOrderStatus(orderCode, patchBody) {
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
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[admin-verify] Supabase update error:', err.message);
    return null;
  }
}

async function persistShiprocketState(orderCode, patchBody) {
  if (!SERVICE_KEY || !orderCode) return false;
  try {
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
    console.error('[admin-verify] Shiprocket state patch error:', err.message);
    return false;
  }
}

async function syncConfirmedOrderToShiprocket(order) {
  if (!isShiprocketConfigured()) return { status: 'not_configured' };
  if (!order) return { status: 'skipped' };
  if (order.shiprocket_order_id) {
    return {
      status: 'already_synced',
      shiprocketOrderId: order.shiprocket_order_id,
      shipmentId: order.shiprocket_shipment_id,
      awb: order.shiprocket_awb
    };
  }

  try {
    const response = await createShiprocketOrder(order);
    const ids = extractShiprocketIds(response);
    const saved = await persistShiprocketState(order.order_code, {
      shiprocket_order_id: ids.orderId ? Number(ids.orderId) : null,
      shiprocket_shipment_id: ids.shipmentId ? Number(ids.shipmentId) : null,
      shiprocket_awb: ids.awb ? String(ids.awb) : null,
      shiprocket_courier: ids.courier ? String(ids.courier) : null,
      shiprocket_status: 'ORDER_CREATED',
      shiprocket_synced_at: new Date().toISOString(),
      shiprocket_error: null
    });

    if (!saved) return { status: 'failed', error: 'Shiprocket order created but local sync state was not saved.' };

    return {
      status: 'synced',
      shiprocketOrderId: ids.orderId,
      shipmentId: ids.shipmentId,
      awb: ids.awb,
      courier: ids.courier
    };
  } catch (err) {
    await persistShiprocketState(order.order_code, {
      shiprocket_error: String(err.message || 'Shiprocket sync failed').slice(0, 1000),
      shiprocket_synced_at: new Date().toISOString()
    });
    console.error('[admin-verify] Shiprocket sync failed:', err.message);
    return { status: 'failed', error: String(err.message || 'Shiprocket sync failed').slice(0, 500) };
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Admin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Admin-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Strictly enforce admin authentication
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Valid admin credentials required.' });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`admin-verify:${ip}`, 100, 60 * 1000)) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderCode = String(body.orderCode || body.orderId || body.order_code || '').trim().toUpperCase();
    const action = String(body.action || 'confirm').trim().toLowerCase();
    const upiRef = body.upiRef || body.utr || null;

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentMethod = order.payment_method || 'upi';

    if (action === 'confirm' || action === 'approve') {
      const alreadyConfirmed = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'].includes(order.status);
      if (alreadyConfirmed) {
        const shippingSync = await syncConfirmedOrderToShiprocket(order);
        return res.status(200).json({
          ok: true,
          orderId: orderCode,
          status: order.status,
          verified: true,
          shippingSync,
          message: 'Order is already confirmed.'
        });
      }

      if (!isValidTransition(order.status, 'confirmed', paymentMethod)) {
        return res.status(400).json({
          error: `Cannot transition order status from '${order.status}' to 'confirmed'.`
        });
      }

      const patchBody = {
        status: 'confirmed',
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (upiRef) {
        const normalized = validateAndNormalizeUtr(upiRef);
        if (normalized) patchBody.upi_ref = normalized;
      }

      const updated = await updateOrderStatus(orderCode, patchBody);
      if (!updated) {
        return res.status(500).json({ error: 'Payment was verified but the order could not be updated.' });
      }

      // Payment is now confirmed, so the order is eligible to enter Shiprocket.
      const shippingSync = await syncConfirmedOrderToShiprocket({
        ...order,
        ...updated,
        status: 'confirmed'
      });

      // Send confirmation email if email present
      if (order.customer_email && process.env.RESEND_API_KEY) {
        try {
          const addr = order.address || {};
          const addrFormatted = typeof addr === 'string' ? addr : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
          const { subject, html } = orderConfirmation({
            orderId: orderCode,
            customerName: (typeof addr === 'object' && addr.name) || 'there',
            amount: String(order.amount ? order.amount / 100 : 229),
            codFee: 0,
            address: addrFormatted,
            paymentMethod: 'UPI'
          });
          const resend = new Resend(process.env.RESEND_API_KEY);
          resend.emails.send({
            from: FROM,
            to: order.customer_email,
            replyTo: REPLY_TO,
            subject,
            html
          }).catch(e => console.error('[admin-verify] Confirmation email failed:', e.message));
        } catch (emailErr) {
          console.error('[admin-verify] Email template exception:', emailErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'confirmed',
        verified: true,
        shippingSync,
        message: 'Payment verified and order confirmed successfully.'
      });
    }

    if (action === 'reject' || action === 'not_verified' || action === 'payment_not_verified') {
      if (!isValidTransition(order.status, 'payment_not_verified', paymentMethod)) {
        return res.status(400).json({
          error: `Cannot transition order status from '${order.status}' to 'payment_not_verified'.`
        });
      }

      const patchBody = {
        status: 'payment_not_verified',
        updated_at: new Date().toISOString()
      };
      await updateOrderStatus(orderCode, patchBody);

      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'payment_not_verified',
        verified: false,
        message: 'Order marked as payment not verified.'
      });
    }

    if (action === 'cancel') {
      if (!isValidTransition(order.status, 'cancelled', paymentMethod)) {
        return res.status(400).json({
          error: `Cannot transition order status from '${order.status}' to 'cancelled'.`
        });
      }

      const patchBody = {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      };
      await updateOrderStatus(orderCode, patchBody);

      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'cancelled',
        message: 'Order cancelled.'
      });
    }

    return res.status(400).json({ error: `Unsupported admin action: ${action}` });
  } catch (err) {
    console.error('[admin-verify] Error:', err);
    return res.status(500).json({ error: 'Admin payment verification failed.' });
  }
}
