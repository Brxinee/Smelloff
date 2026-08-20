import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function updateOrderPaid(orderCode, paymentId) {
  if (!SERVICE_KEY || !orderCode) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        status: 'confirmed',
        upi_ref: paymentId,
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('[webhook] Order update error:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

  // Signature verification if webhook secret is configured
  if (webhookSecret) {
    if (!signature) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[webhook] Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  try {
    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    const eventType = event.event;

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity || {};
      const orderNotes = paymentEntity.notes || event.payload?.order?.entity?.notes || {};
      const orderCode = orderNotes.order_code || paymentEntity.receipt;
      const paymentId = paymentEntity.id;

      if (orderCode) {
        await updateOrderPaid(orderCode, paymentId);
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[webhook] Error handling event:', err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
}
