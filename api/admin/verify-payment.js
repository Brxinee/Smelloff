import { Resend } from 'resend';
import { orderConfirmation } from '../email-templates.js';
import { isAdminAuthorized, validateAndNormalizeUtr } from '../_security.js';
import { isValidTransition } from '../../shared/products-config.js';

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

async function listPendingVerificationOrders() {
  if (!SERVICE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?status=in.(verification_pending,upi_pending)&order=created_at.desc&limit=100`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!res.ok) return [];
    return await res.json().catch(() => []);
  } catch (err) {
    console.error('[admin-verify] List pending error:', err.message);
    return [];
  }
}

async function updateSupabaseOrderStatus(orderCode, status, upiRef) {
  if (!SERVICE_KEY || !orderCode) return null;
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
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) {
      console.error('[admin-verify] Supabase update failed:', res.status);
      return null;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[admin-verify] Supabase patch error:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Admin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
    return res.status(204).end();
  }

  // Strict Admin Authorization Check
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized. Admin credentials required to perform trusted verification.'
    });
  }

  // Handle GET / List
  if (req.method === 'GET' || (req.method === 'POST' && req.body?.action === 'list_pending')) {
    const orders = await listPendingVerificationOrders();
    return res.status(200).json({
      ok: true,
      count: orders.length,
      orders
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(body.action || 'confirm').toLowerCase();
    const orderCode = String(body.orderCode || body.order_code || '').trim().toUpperCase();
    const explicitUtr = body.upiRef || body.utr ? validateAndNormalizeUtr(body.upiRef || body.utr) : null;

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (SMF-YYYYMMDD-XXXX)' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (action === 'confirm' || action === 'approve') {
      const confirmedOrFulfilled = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
      if (confirmedOrFulfilled.includes(order.status)) {
        return res.status(200).json({
          ok: true,
          action: 'already_confirmed',
          idempotent: true,
          orderId: orderCode,
          status: order.status,
          upiRef: order.upi_ref || null,
          emailSent: false,
          message: `Order is already in state '${order.status}'. No duplicate confirmation or email triggered.`
        });
      }

      if (!isValidTransition(order.status, 'confirmed', order.payment_method)) {
        return res.status(400).json({
          error: `Cannot transition order from status '${order.status}' to 'confirmed'.`
        });
      }

      const isCod = order.payment_method === 'cod';
      const finalUtr = explicitUtr || (order.upi_ref ? validateAndNormalizeUtr(order.upi_ref) : null);

      // Enforce payment evidence for prepaid UPI orders
      if (!isCod && !finalUtr) {
        return res.status(400).json({
          error: 'Cannot confirm prepaid UPI order without valid payment evidence (UTR / UPI reference required).'
        });
      }

      // Check for UTR conflicts if confirming with a UTR
      if (finalUtr) {
        const isConflict = await checkUtrConflict(finalUtr, orderCode);
        if (isConflict) {
          return res.status(409).json({
            error: 'This UPI reference (UTR) has already been associated with another order.'
          });
        }
      }

      const updatedOrder = await updateSupabaseOrderStatus(orderCode, 'confirmed', finalUtr);
      if (!updatedOrder) {
        return res.status(500).json({ error: 'Failed to update order status in database.' });
      }

      // Send confirmed order email via Resend
      let emailSent = false;
      if (process.env.RESEND_API_KEY && order.customer_email) {
        try {
          const addr = order.address || {};
          const addrFormatted = typeof addr === 'string'
            ? addr
            : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

          const amountRupees = String(Math.round((order.amount || 22900) / 100));

          const { subject, html } = orderConfirmation({
            orderId: orderCode,
            customerName: addr.name || 'there',
            amount: amountRupees,
            address: addrFormatted,
            paymentMethod: isCod ? 'Cash on Delivery' : 'UPI Prepaid (Verified)'
          });

          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: FROM,
            to: order.customer_email,
            replyTo: REPLY_TO,
            subject,
            html
          });
          emailSent = true;
        } catch (emailErr) {
          console.error('[admin-verify] Resend email send error:', emailErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        action: 'confirmed',
        orderId: orderCode,
        status: 'confirmed',
        upiRef: finalUtr,
        emailSent
      });
    }

    if (action === 'reject') {
      if (order.status === 'payment_not_verified') {
        return res.status(200).json({
          ok: true,
          action: 'already_rejected',
          idempotent: true,
          orderId: orderCode,
          status: 'payment_not_verified',
          message: 'Order is already marked as payment_not_verified.'
        });
      }

      if (!isValidTransition(order.status, 'payment_not_verified', order.payment_method)) {
        return res.status(400).json({
          error: `Cannot transition order from status '${order.status}' to 'payment_not_verified'.`
        });
      }

      const updatedOrder = await updateSupabaseOrderStatus(orderCode, 'payment_not_verified');
      if (!updatedOrder) {
        return res.status(500).json({ error: 'Failed to update order status in database.' });
      }

      return res.status(200).json({
        ok: true,
        action: 'rejected',
        orderId: orderCode,
        status: 'payment_not_verified',
        reason: body.reason || 'Payment verification failed'
      });
    }

    return res.status(400).json({ error: `Unknown action '${action}'` });

  } catch (err) {
    console.error('[admin-verify] Error:', err);
    return res.status(500).json({ error: 'Internal admin verification error' });
  }
}
