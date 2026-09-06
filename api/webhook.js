import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';

async function findOrderByRazorpayOrderId(razorpayOrderId) {
  if (!SERVICE_KEY || !razorpayOrderId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?payment_attempt_id=eq.${encodeURIComponent(razorpayOrderId)}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[webhook] Supabase order query error:', err.message);
    return null;
  }
}

async function updateOrderStatus(orderCode, patch) {
  if (!SERVICE_KEY || !orderCode) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('[webhook] Supabase order patch error:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-razorpay-signature'] || '';
  if (!signature || !WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Missing webhook signature or secret.' });
  }

  // Get raw body for HMAC verification
  let rawBody = '';
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf8');
  } else if (req.body && typeof req.body === 'object') {
    rawBody = JSON.stringify(req.body);
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  let signatureValid = false;
  try {
    const expected = Buffer.from(expectedSignature, 'hex');
    const received = Buffer.from(String(signature), 'hex');
    signatureValid = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  try {
    const event = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);
    const eventType = String(event.event || '');
    const paymentEntity = event.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id || event.payload?.order?.entity?.id || '';
    const paymentId = paymentEntity.id || '';

    if (['payment.captured', 'payment.authorized', 'order.paid'].includes(eventType)) {
      if (!razorpayOrderId) {
        return res.status(200).json({ received: true, note: 'No linked order id.' });
      }

      const order = await findOrderByRazorpayOrderId(razorpayOrderId);
      if (!order) {
        return res.status(200).json({ received: true, note: 'Smelloff order not found for attempt id.' });
      }

      const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
      if (terminalConfirmedStates.includes(order.status)) {
        return res.status(200).json({ received: true, idempotent: true, status: order.status });
      }

      await updateOrderStatus(order.order_code, {
        status: 'confirmed',
        upi_txn_id: paymentId || order.upi_txn_id,
        upi_response_code: 'RZP_WEBHOOK',
        payment_verified_at: new Date().toISOString(),
      });

      return res.status(200).json({ received: true, status: 'confirmed', orderCode: order.order_code });
    }

    if (eventType === 'payment.failed') {
      if (razorpayOrderId) {
        const order = await findOrderByRazorpayOrderId(razorpayOrderId);
        if (order && order.status === 'pending') {
          await updateOrderStatus(order.order_code, {
            status: 'failed',
            upi_response_code: 'RZP_FAILED',
          });
        }
      }
      return res.status(200).json({ received: true, event: 'payment.failed' });
    }

    return res.status(200).json({ received: true, unhandledEvent: eventType });
  } catch (error) {
    console.error('[webhook] Processing error:', error?.message || error);
    return res.status(500).json({ error: 'Webhook processing error.' });
  }
}
