// /api/whatsapp-notify.js
// Sends a WhatsApp notification to the merchant whenever a new order is
// submitted. Uses Meta WhatsApp Cloud API (Graph v21.0). All credentials
// come from Vercel env vars — nothing is exposed to the client.
//
// REQUIRED env vars:
//   WA_TOKEN         - Bearer token (system user or temporary test token)
//   WA_PHONE_ID      - Sender phone number ID (numeric)
//   WA_RECIPIENT     - Merchant phone, any format. Auto-normalized to
//                      E.164-without-plus (e.g. "9392974031" -> "919392974031").
//
// OPTIONAL — switches to template mode (recommended for production, since
// free-form text only works inside the 24-hour customer service window):
//   WA_TEMPLATE_NAME - WhatsApp template name (e.g. "new_order"). When set,
//                      this endpoint sends a template message with 6 body
//                      variables in this order: orderId, amount, paymentMethod,
//                      name, phone, address. Create + get the template
//                      approved in WhatsApp Manager → Message Templates first.
//   WA_TEMPLATE_LANG - Language code, default "en". Must match the language
//                      you registered the template under (e.g. "en", "en_US").
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

  const {
    WA_TOKEN,
    WA_PHONE_ID,
    WA_RECIPIENT,
    WA_TEMPLATE_NAME,
    WA_TEMPLATE_LANG,
  } = process.env;

  if (!WA_TOKEN || !WA_PHONE_ID || !WA_RECIPIENT) {
    console.error('[whatsapp-notify] Missing env vars', {
      hasToken: !!WA_TOKEN,
      hasPhoneId: !!WA_PHONE_ID,
      hasRecipient: !!WA_RECIPIENT,
    });
    return res.status(500).json({ error: 'WhatsApp not configured' });
  }

  // Normalize recipient to E.164-without-plus that Meta expects.
  // Strips +, spaces, hyphens. If it ends up as a bare 10-digit Indian
  // mobile (starts 6-9), auto-prepend country code 91. So both
  // "9392974031" and "+91 93929 74031" land at "919392974031".
  const recipient = (function(raw){
    const digits = String(raw).replace(/[^\d]/g, '');
    if (/^[6-9]\d{9}$/.test(digits)) return '91' + digits;
    return digits;
  })(WA_RECIPIENT);

  const body = req.body || {};
  // WhatsApp template parameters cannot contain newlines, tabs, or 4+ spaces.
  // Sanitize each value so a multi-line address doesn't make the API reject
  // the whole message with error 132000.
  const clean = function(v){
    if (v == null) return 'N/A';
    return String(v).replace(/\s+/g, ' ').trim() || 'N/A';
  };

  const name          = clean(body.name);
  const phone         = clean(body.phone);
  const address       = clean(body.address);
  const amount        = clean(body.amount);
  const paymentMethod = clean(body.paymentMethod);
  const orderId       = clean(body.orderId);

  let payload;
  if (WA_TEMPLATE_NAME) {
    // Template mode — works outside the 24-hour window.
    // For our "new_order" template the body uses {{1}}-{{6}} in this order:
    //   {{1}} orderId, {{2}} amount, {{3}} paymentMethod,
    //   {{4}} name,    {{5}} phone,  {{6}} address
    //
    // Special case: Meta's built-in "hello_world" template takes no
    // parameters at all, so we send it without a components block. Useful
    // as a smoke test while a custom template is still pending review.
    const isHelloWorld = WA_TEMPLATE_NAME.toLowerCase() === 'hello_world';
    const template = {
      name: WA_TEMPLATE_NAME,
      language: { code: WA_TEMPLATE_LANG || 'en' },
    };
    if (!isHelloWorld) {
      template.components = [{
        type: 'body',
        parameters: [
          { type: 'text', text: orderId },
          { type: 'text', text: amount },
          { type: 'text', text: paymentMethod },
          { type: 'text', text: name },
          { type: 'text', text: phone },
          { type: 'text', text: address },
        ],
      }];
    }
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template,
    };
  } else {
    // Free-form text mode — only works inside the 24-hour customer service
    // window (the recipient must have messaged the business number in the
    // last 24h). Set WA_TEMPLATE_NAME to switch to template mode.
    const text =
      `\u{1F7E2} NEW ORDER\n\n` +
      `₹${amount}\n` +
      `${paymentMethod}\n` +
      `Order: ${orderId}\n\n` +
      `${name}\n` +
      `${phone}\n` +
      `${address}\n\n` +
      `Verify payment in UPI app`;
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { preview_url: false, body: text },
    };
  }

  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = null;
    try { data = await resp.json(); } catch (_) { /* non-JSON response */ }

    if (!resp.ok) {
      console.error('[whatsapp-notify] Graph API error', resp.status, {
        mode: WA_TEMPLATE_NAME ? 'template:' + WA_TEMPLATE_NAME : 'text',
        recipient,
        error: data?.error,
      });
      return res.status(500).json({
        error: data?.error?.message || `HTTP ${resp.status}`,
        code: data?.error?.code,
        type: data?.error?.type,
        mode: WA_TEMPLATE_NAME ? 'template' : 'text',
      });
    }

    return res.status(200).json({
      ok: true,
      id: data?.messages?.[0]?.id || null,
      mode: WA_TEMPLATE_NAME ? 'template' : 'text',
    });
  } catch (err) {
    console.error('[whatsapp-notify] Fetch failed', err);
    return res.status(500).json({ error: err.message || 'Send failed' });
  }
}
