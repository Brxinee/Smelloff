// /api/meta-capi-drain — server-truth Purchase / Refund emitter.
//
// This is the source of truth for revenue events. The DB trigger
// `orders_meta_enqueue` writes a PENDING row into `meta_capi_log` whenever an
// order transitions to `confirmed` (→ Purchase) or to `cancelled`/`returned`
// (→ Refund) — no matter how the status was changed (admin dashboard, edge
// function, or raw SQL). This endpoint drains those pending rows and posts the
// events to Meta with strong Advanced Matching built from the order's stored
// fields (hashed email/phone/name/city/state/zip/country + fbp/fbc/ip/ua).
//
// Because it fires from the order lifecycle rather than the shopper's browser,
// it survives closed tabs, ad-blockers and dropped sessions — the conversions
// the browser Pixel loses. The COD/RTO correction (Refund) is what keeps
// reported ROAS converging toward real margin instead of counting parcels that
// come back to origin.
//
// TRIGGERING: designed for Vercel Cron (see vercel.json). Because Meta accepts
// events up to 7 days old, an hourly (even daily) drain loses no attribution.
// Can also be hit manually. Protected by a bearer secret; Vercel Cron's own
// Authorization header is accepted automatically.
//
// SAFETY: inert until META_CAPI_TOKEN + SUPABASE_SERVICE_ROLE_KEY are set;
// each row is claimed atomically (pending → sending) so overlapping runs never
// double-send; fail-silent per row; Meta additionally dedupes on event_id.
//
// Env: CRON_SECRET (or META_CAPI_DRAIN_SECRET) — bearer token to invoke.

import {
  buildUserData, sendEvent, contentsFromItems,
  fetchPending, claimPending, logUpdate, getOrder,
} from './_meta.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.META_CAPI_DRAIN_SECRET;
  if (!secret) return true; // no secret configured → allow (still inert w/o token)
  const auth = String(req.headers['authorization'] || '');
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.META_CAPI_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: true, inert: true, sent: 0 });
  }

  const pending = await fetchPending(50);
  let sent = 0, failed = 0, skipped = 0;

  for (const row of pending) {
    // Claim so a concurrent run can't send the same event twice.
    if (!(await claimPending(row.id))) { skipped++; continue; }

    const order = row.order_id ? await getOrder(row.order_id) : null;
    if (!order) {
      await logUpdate(row.id, { status: 'failed', response: { body: 'order-not-found' }, attempts: (row.attempts || 0) + 1 });
      failed++; continue;
    }

    const valueRupees = Number(order.amount || 0) / 100;
    const addr = order.address || {};
    const user_data = buildUserData({
      email: order.customer_email, phone: order.customer_phone,
      name: addr.name, city: addr.city, state: addr.state, zip: addr.pincode,
      country: 'in', fbp: order.fbp, fbc: order.fbc,
      ip: order.client_ip, ua: order.client_ua,
    });

    const custom_data = {
      currency: 'INR',
      value: valueRupees,
      ...contentsFromItems(order.items, valueRupees),
      order_id: order.order_code || order.id,
      order_type: order.payment_method === 'cod' ? 'cod' : 'prepaid',
    };

    const event = {
      event_name: row.event_name, // 'Purchase' | 'Refund'
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id: row.event_id,     // 'purchase_<code>' | 'refund_<code>'
      event_source_url: order.event_source_url || 'https://smelloff.in/odorstrike',
      user_data,
      custom_data,
    };

    const r = await sendEvent(event);
    await logUpdate(row.id, {
      status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
      http_status: r.status || null,
      request: event,
      response: { body: r.body },
      attempts: (row.attempts || 0) + 1,
      sent_at: r.ok ? new Date().toISOString() : null,
    });
    if (r.ok) sent++; else if (r.skipped) skipped++; else failed++;
  }

  return res.status(200).json({ ok: true, processed: pending.length, sent, failed, skipped });
}
