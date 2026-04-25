// /api/whatsapp-notify.js
// Sends a WhatsApp text notification to the merchant whenever a new order
// is submitted. Uses Meta WhatsApp Cloud API (Graph v21.0). All credentials
// come from Vercel env vars — nothing is exposed to the client.
//
// Required env vars:
//   WA_TOKEN     - Bearer token (system user or temporary test token)
//   WA_PHONE_ID  - Sender phone number ID (numeric)
//   WA_RECIPIENT - Merchant's phone in E.164-without-plus form, e.g. 9392974031
//
// POST body (JSON): { name, phone, address, amount, paymentMethod, orderId }
// All fields optional — missing values fall back to "N/A".

const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { WA_TOKEN, WA_PHONE_ID, WA_RECIPIENT } = process.env;
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_RECIPIENT) {
    console.error('[whatsapp-notify] Missing env vars', {
      hasToken: !!WA_TOKEN,
      hasPhoneId: !!WA_PHONE_ID,
      hasRecipient: !!WA_RECIPIENT,
    });
    return res.status(500).json({ error: 'WhatsApp not configured' });
  }

  const body = req.body || {};
  const name          = body.name          || 'N/A';
  const phone         = body.phone         || 'N/A';
  const address       = body.address       || 'N/A';
  const amount        = body.amount != null ? String(body.amount) : 'N/A';
  const paymentMethod = body.paymentMethod || 'N/A';
  const orderId       = body.orderId       || 'N/A';

  const text =
    `\u{1F7E2} NEW ORDER\n\n` +
    `₹${amount}\n` +
    `${paymentMethod}\n` +
    `Order: ${orderId}\n\n` +
    `${name}\n` +
    `${phone}\n` +
    `${address}\n\n` +
    `Verify payment in UPI app`;

  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: WA_RECIPIENT,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    let data = null;
    try { data = await resp.json(); } catch (_) { /* non-JSON response */ }

    if (!resp.ok) {
      console.error('[whatsapp-notify] Graph API error', resp.status, data);
      return res.status(500).json({
        error: data?.error?.message || `HTTP ${resp.status}`,
        code: data?.error?.code,
        type: data?.error?.type,
      });
    }

    return res.status(200).json({
      ok: true,
      id: data?.messages?.[0]?.id || null,
    });
  } catch (err) {
    console.error('[whatsapp-notify] Fetch failed', err);
    return res.status(500).json({ error: err.message || 'Send failed' });
  }
}
