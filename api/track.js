// /api/track — first-party, cookieless analytics + cart beacon (full funnel).
//
// The client (assets/js/track.js) posts here same-origin. What it records:
//   • pageview        -> a row in `page_views`   (path, device, country, ref, visitor)
//   • any other event -> a row in `events`       (click, product_view, add_to_cart, …)
//   • cart snapshots  -> an upsert into `carts`  (who has what in their basket)
//   • purchase        -> marks the matching cart `converted`
//
// Everything identifying is derived server-side: device from the User-Agent,
// country from Vercel's geo header, and an anonymous `visitor` id that is a
// DAILY-ROTATING one-way hash of (date + ip + ua + secret salt). The raw IP is
// never stored — no cookie, no client storage, no PII at rest. This is the
// privacy-first model (à la Plausible), which is why it needs no consent
// banner. The legacy { p, r } pageview payload is still accepted so cached
// pages keep counting during rollout.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (required), SUPABASE_URL (optional),
//      ANALYTICS_SALT (optional — else derived from the service-role key).

import crypto from 'node:crypto';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|preview|monitor|lighthouse|headless|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http/i;

// Funnel event types that imply the session has a live cart even when no
// snapshot rides along.
const CART_EVENTS = new Set(['add_to_cart', 'remove_from_cart', 'cart', 'cart_update']);

function deviceFrom(ua) {
  if (!ua) return 'other';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(ua)) return 'mobile';
  if (/windows|macintosh|linux|cros|x11/i.test(ua)) return 'desktop';
  return 'other';
}

function refHost(referrer, selfHost) {
  if (!referrer || typeof referrer !== 'string') return null;
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === selfHost || h.endsWith('smelloff.in')) return null; // internal nav
    return h.slice(0, 255);
  } catch {
    return null;
  }
}

// Same derivation the original pageview-only beacon used, so visitor hashes
// stay continuous across the upgrade and identical between page_views/events.
function salt() {
  if (process.env.ANALYTICS_SALT) return process.env.ANALYTICS_SALT;
  return crypto
    .createHash('sha256')
    .update(`smelloff-pv-salt:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`)
    .digest('hex');
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || '';
  return (Array.isArray(fwd) ? fwd[0] : String(fwd).split(',')[0]).trim() || 'unknown';
}

function visitorHash(req, ua) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(`${day}|${clientIp(req)}|${ua}|${salt()}`)
    .digest('base64url')
    .slice(0, 32);
}

const str = (v, max) => (v == null || v === '' ? null : String(v).slice(0, max));
const intOf = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };

function cleanPath(raw) {
  let path = typeof raw === 'string' ? raw : '';
  if (!path.startsWith('/')) path = '/' + path;
  return path.split('#')[0].split('?')[0].slice(0, 512);
}

// Best-effort per-warm-instance rate limit (spam guard on a public route).
const RL_LIMIT = 240; // events per IP per minute
const RL_WINDOW_MS = 60 * 1000;
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return false;
  }
  if (b.count >= RL_LIMIT) return true;
  b.count++;
  return false;
}

async function sbWrite(path, body, { method = 'POST', headers = {} } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // The beacon is same-origin; keep the surface tiny.
  if (req.method !== 'POST') return res.status(405).end();

  // Fail silently on any problem — analytics must never surface an error to a
  // shopper or slow a page down. Always answer 204.
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(204).end();

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT_RE.test(ua)) return res.status(204).end(); // drop bots/monitors
    if (rateLimited(clientIp(req))) return res.status(204).end();

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // Legacy shape { p, r } == a pageview; new shape carries type/path/ref.
    const type = str(body.type, 48) || 'pageview';
    const path = cleanPath(body.path != null ? body.path : body.p);
    // Never record admin/api traffic.
    if (/^\/(admin|api)(\/|$)/.test(path)) return res.status(204).end();

    const visitor = visitorHash(req, ua);
    const device = deviceFrom(ua);
    const country = str(req.headers['x-vercel-ip-country'], 4);
    const referrer = refHost(body.ref != null ? body.ref : body.r, 'smelloff.in');
    const sessionId = str(body.session, 64);

    if (type === 'pageview') {
      await sbWrite('page_views', {
        path, referrer_host: referrer, device, country, visitor,
      });
    } else {
      // Every non-pageview lands in the generic event stream.
      await sbWrite('events', {
        type,
        path,
        label: str(body.label, 200),
        value: body.value == null ? null : Number(body.value),
        visitor,
        session_id: sessionId,
        device,
        country,
        referrer_host: referrer,
        meta: (body.meta && typeof body.meta === 'object') ? body.meta : {},
      });
    }

    // Cart state: upsert on any cart change so the admin sees live baskets.
    // Only the fields actually supplied are written — a contact-only update
    // never blanks previously captured items, and vice versa.
    const cart = body.cart && typeof body.cart === 'object' ? body.cart : null;
    if (sessionId && (cart || CART_EVENTS.has(type))) {
      const contact = (cart && cart.contact) || body.contact || {};
      const row = {
        session_id: sessionId,
        updated_at: new Date().toISOString(),
        visitor,
        device,
        country,
        status: 'active',
      };
      if (cart) {
        if (Array.isArray(cart.items)) {
          row.items = cart.items.slice(0, 50);
          row.item_count = intOf(cart.item_count != null ? cart.item_count : row.items.length);
        }
        if (cart.total != null) row.total = intOf(cart.total);
        if (cart.currency) row.currency = str(cart.currency, 8);
      }
      if (contact.name) row.contact_name = str(contact.name, 120);
      if (contact.email) row.contact_email = str(String(contact.email).toLowerCase(), 200);
      if (contact.phone) row.contact_phone = str(contact.phone, 32);

      await sbWrite('carts?on_conflict=session_id', row, {
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    }

    // Purchase: close out the session's cart as converted.
    if (type === 'purchase' && sessionId) {
      await sbWrite(`carts?session_id=eq.${encodeURIComponent(sessionId)}`, {
        status: 'converted',
        order_code: str(body.order_code || (body.meta && body.meta.order_code), 40),
        updated_at: new Date().toISOString(),
      }, { method: 'PATCH' });
    }

    return res.status(204).end();
  } catch {
    return res.status(204).end();
  }
}
