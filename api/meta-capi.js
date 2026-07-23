// /api/meta-capi — browser-facing Conversions API mirror.
//
// The browser Pixel posts here (via sendBeacon) with the SAME `eventID` it
// emitted client-side, so Meta DEDUPES the pair and we recover the ~20-40% of
// events the Pixel loses to iOS ITP / ad-blockers / dropped sessions on Indian
// mobile. It mirrors the funnel (ViewContent, AddToCart, InitiateCheckout,
// AddPaymentInfo) and the intent signal `Lead` (fired when an order is PLACED).
//
// It does NOT own `Purchase`. Purchase is confirmed revenue and is emitted
// server-side from the order lifecycle by api/meta-capi-drain.js — never from
// the browser at placement, because an unpaid UPI order or a COD order that
// later RTOs must not be reported as a sale. (A legacy cached page may still
// POST an old Purchase beacon during rollout; it is honoured but shares the
// event_id the server uses, so Meta + our log both dedupe it.)
//
// SAFETY: inert until META_CAPI_TOKEN is set (returns 204); fail-silent on any
// error; never blocks the client. High-value events (Lead/Purchase/Refund) are
// logged to Supabase and de-duplicated on (event_id, event_name); funnel events
// are fire-and-forget and not logged (to avoid table bloat).

import {
  buildUserData, fbcFromFbclid, sendEvent,
  logInsertIfNew, logUpdate, clientIp, SKU,
} from './_meta.js';

const LOGGED = new Set(['Lead', 'Purchase', 'Refund']);
const ID_PREFIX = { Purchase: 'purchase_', Refund: 'refund_', Lead: 'lead_' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.META_CAPI_TOKEN) return res.status(204).end(); // inert until configured

  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const custom = (b.custom && typeof b.custom === 'object') ? b.custom : {};

    const event_name = String(b.event_name || 'Purchase'); // legacy beacons omit it
    const value = Number(custom.value != null ? custom.value : b.value);
    const orderId = b.orderId || b.order_id || null;

    const event_id = b.eventId || b.event_id
      || (orderId && ID_PREFIX[event_name] ? ID_PREFIX[event_name] + orderId : undefined);

    // Value is required for commercial events; Lead may be value-less.
    if (event_name !== 'Lead' && !(value > 0)) return res.status(204).end();

    const ua = String(req.headers['user-agent'] || '');
    const ip = clientIp(req);
    let fbc = b.fbc ? String(b.fbc) : '';
    if (!fbc && b.fbclid) fbc = fbcFromFbclid(b.fbclid);

    const user_data = buildUserData({
      email: b.email, phone: b.phone, name: b.name,
      firstName: b.firstName, lastName: b.lastName,
      city: b.city, state: b.state, zip: b.zip || b.pincode,
      country: b.country, fbp: b.fbp, fbc, ip, ua,
    });

    const custom_data = { currency: custom.currency || b.currency || 'INR' };
    if (value > 0) custom_data.value = value;
    custom_data.content_ids = custom.content_ids || b.content_ids || [SKU];
    custom_data.content_type = custom.content_type || 'product';
    if (custom.contents || b.contents) custom_data.contents = custom.contents || b.contents;
    custom_data.num_items = custom.num_items || b.num_items || 1;
    if (orderId) custom_data.order_id = orderId;
    if (b.order_type || custom.order_type) custom_data.order_type = b.order_type || custom.order_type;

    const event = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id,
      event_source_url: b.eventSourceUrl || b.event_source_url || undefined,
      user_data,
      custom_data,
    };

    // Idempotent log for high-value events; funnel events send fire-and-forget.
    if (LOGGED.has(event_name) && event_id) {
      const row = await logInsertIfNew({
        event_id, event_name, order_id: null, order_code: orderId || null,
        source: 'browser', status: 'sending', request: event,
      });
      if (!row) return res.status(204).end(); // already logged elsewhere → skip
      const r = await sendEvent(event);
      await logUpdate(row.id, {
        status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
        http_status: r.status || null, response: { body: r.body },
        attempts: 1, sent_at: new Date().toISOString(),
      });
    } else {
      await sendEvent(event);
    }

    return res.status(204).end();
  } catch (e) {
    console.error('meta-capi error', e && e.message);
    return res.status(204).end();
  }
}
