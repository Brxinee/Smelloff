// /api/meta-capi — Meta Conversions API (server-side) for the Purchase event.
//
// WHY: the browser Pixel alone under-reports ~20-40% of conversions (iOS ITP,
// ad-blockers, network drops). This endpoint mirrors each Purchase to Meta
// server-side. It shares the SAME `eventID` the browser Pixel already emits
// (`purchase_<orderId>`), so Meta DEDUPES the pair — you get the recovered
// signal without double-counting.
//
// SAFETY / ROLLOUT:
//   • Inert until configured: if META_CAPI_TOKEN is unset it returns 204 and
//     does nothing, so shipping this before the token is set changes nothing.
//   • Fail-silent: any error returns 204. It never affects checkout or the
//     browser Pixel — it's a passive, additive mirror.
//   • Privacy: email/phone are SHA-256 hashed here, server-side, per Meta's
//     Advanced Matching spec — raw PII is never sent to Meta and never stored.
//
// Env:
//   META_CAPI_TOKEN       (required to activate) — a Meta system-user access
//                         token with `ads_management` for this pixel.
//   META_PIXEL_ID         (optional, default 1455100092891684)
//   META_TEST_EVENT_CODE  (optional) — set while validating in Events Manager →
//                         Test Events; remove for live traffic.
//   META_API_VERSION      (optional, default v21.0)

import crypto from 'node:crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || '1455100092891684';
const API_VERSION = process.env.META_API_VERSION || 'v21.0';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Meta wants normalized-then-hashed values: email lowercased/trimmed; phone as
// digits only in E.164 (no '+'), India-defaulted to +91 for bare 10-digit numbers.
function hashEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e && e.includes('@') ? sha256(e) : null;
}
function hashPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = '91' + d;                 // bare Indian mobile
  else if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return sha256(d);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || '';
  return (Array.isArray(fwd) ? fwd[0] : String(fwd).split(',')[0]).trim() || undefined;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Inert until a token is configured — safe to deploy ahead of setup.
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(204).end();

  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const custom = (b.custom && typeof b.custom === 'object') ? b.custom : {};
    const value = Number(custom.value != null ? custom.value : b.value);
    if (!(value > 0)) return res.status(204).end();   // nothing worth sending

    // Advanced Matching — send only the fields we actually have.
    const em = hashEmail(b.email);
    const ph = hashPhone(b.phone);
    const user_data = { client_user_agent: String(req.headers['user-agent'] || '') };
    const ip = clientIp(req);
    if (ip) user_data.client_ip_address = ip;
    if (em) user_data.em = [em];
    if (ph) user_data.ph = [ph];
    if (b.fbp) user_data.fbp = String(b.fbp);
    if (b.fbc) user_data.fbc = String(b.fbc);

    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      // Shared with the browser Pixel so Meta dedupes the pair.
      event_id: b.eventId || (b.orderId ? 'purchase_' + b.orderId : undefined),
      event_source_url: b.eventSourceUrl || undefined,
      user_data,
      custom_data: {
        currency: custom.currency || 'INR',
        value,
        content_type: custom.content_type || 'product',
        content_ids: custom.content_ids || undefined,
        contents: custom.contents || undefined,
        num_items: custom.num_items || 1,
        order_id: b.orderId || undefined,
      },
    };

    const payload = { data: [event] };
    if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Surface Meta's response only in server logs; never leak it to the client.
    if (!r.ok) console.error('meta-capi', r.status, (await r.text().catch(() => '')).slice(0, 300));

    return res.status(204).end();
  } catch (e) {
    console.error('meta-capi error', e && e.message);
    return res.status(204).end();
  }
}
