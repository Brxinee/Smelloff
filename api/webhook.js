const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function updateOrderStatus(orderCode, status, upiRef) {
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
        status: status || 'confirmed',
        upi_ref: upiRef || null,
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

  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { orderCode, status, upiRef } = body;

    if (orderCode && status) {
      await updateOrderStatus(orderCode, status, upiRef);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[webhook] Error handling event:', err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
}
