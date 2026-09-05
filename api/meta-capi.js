import { isAllowedOrigin, checkRateLimit } from './_security.js';
import { buildUserData, fbcFromFbclid, sendEvent, logInsertIfNew, logUpdate, clientIp, SKU } from './_meta.js';

const LOGGED = new Set(['Lead', 'Purchase', 'Refund']);
const ALLOWED_EVENTS = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Lead', 'Purchase', 'Refund']);
const ID_PREFIX = { Purchase: 'purchase_', Refund: 'refund_', Lead: 'lead_' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.META_CAPI_TOKEN) return res.status(204).end();

  const ip = clientIp(req) || 'unknown';
  if (!checkRateLimit(`meta-capi:${ip}`, 120, 10 * 60 * 1000)) return res.status(429).end();

  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const custom = b.custom && typeof b.custom === 'object' ? b.custom : {};
    const eventName = String(b.event_name || '');
    if (!ALLOWED_EVENTS.has(eventName)) return res.status(204).end();

    const value = Number(custom.value != null ? custom.value : b.value);
    const orderId = b.orderId || b.order_id || null;
    const eventId = b.eventId || b.event_id || (orderId && ID_PREFIX[eventName] ? ID_PREFIX[eventName] + orderId : undefined);
    if (LOGGED.has(eventName) && !eventId) return res.status(204).end();
    if (eventName !== 'Lead' && !(value > 0)) return res.status(204).end();

    let fbc = b.fbc ? String(b.fbc).slice(0, 256) : '';
    if (!fbc && b.fbclid) fbc = fbcFromFbclid(String(b.fbclid).slice(0, 256));

    const user_data = buildUserData({
      email: b.email, phone: b.phone, name: b.name,
      firstName: b.firstName, lastName: b.lastName,
      city: b.city, state: b.state, zip: b.zip || b.pincode,
      country: b.country, fbp: b.fbp, fbc,
      ip, ua: String(req.headers['user-agent'] || '').slice(0, 512),
    });

    const custom_data = {
      currency: String(custom.currency || b.currency || 'INR').slice(0, 8),
      content_ids: custom.content_ids || b.content_ids || [SKU],
      content_type: 'product',
      num_items: Math.min(100, Math.max(1, Number(custom.num_items || b.num_items || 1))),
    };
    if (value > 0) custom_data.value = value;
    if (custom.contents || b.contents) custom_data.contents = custom.contents || b.contents;
    if (orderId) custom_data.order_id = String(orderId).slice(0, 128);

    const event = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      ...(eventId ? { event_id: String(eventId).slice(0, 128) } : {}),
      event_source_url: String(b.eventSourceUrl || b.event_source_url || '').slice(0, 512) || undefined,
      user_data,
      custom_data,
    };

    if (LOGGED.has(eventName)) {
      const row = await logInsertIfNew({
        event_id: String(eventId), event_name: eventName, order_id: null,
        order_code: orderId || null, source: 'browser', status: 'sending', request: event,
      });
      if (!row) return res.status(204).end();
      const result = await sendEvent(event);
      await logUpdate(row.id, {
        status: result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed'),
        http_status: result.status || null,
        response: { body: result.body },
        attempts: 1,
        sent_at: result.ok ? new Date().toISOString() : null,
      });
    } else {
      await sendEvent(event);
    }
    return res.status(204).end();
  } catch (e) {
    console.error('meta-capi error', e?.message || e);
    return res.status(204).end();
  }
}
