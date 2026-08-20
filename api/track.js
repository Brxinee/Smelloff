// /api/track — first-party, cookieless analytics + cart beacon (full funnel).
// Privacy-first: daily rotating server-side visitor hash, no raw IP/PII at rest.
import crypto from 'node:crypto';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';

const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

// Public event contract. Unknown event names are dropped instead of becoming
// arbitrary Supabase writes.
const ALLOWED_EVENTS = new Set([
  'pageview', 'click', 'product_view', 'view_content', 'select_content',
  'buy_cta_click', 'add_to_cart', 'remove_from_cart', 'cart', 'cart_update',
  'begin_checkout', 'checkout_start', 'payment_method_select', 'checkout_field_fill',
  'checkout_error', 'add_payment_info', 'purchase', 'purchase_confirmed',
  'refund', 'contact_submit', 'review_submit', 'search', 'error',
]);

const CART_EVENTS = new Set(['add_to_cart', 'remove_from_cart', 'cart', 'cart_update', 'checkout_start']);
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|preview|monitor|lighthouse|headless|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http/i;
const MAX_BODY_BYTES = 24 * 1024;
const MAX_META_KEYS = 24;
const MAX_META_DEPTH = 2;

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
    if (!h || h === selfHost || h.endsWith('smelloff.in')) return null;
    return h.slice(0, 255);
  } catch {
    return null;
  }
}

function salt() {
  if (process.env.ANALYTICS_SALT) return process.env.ANALYTICS_SALT;
  return crypto
    .createHash('sha256')
    .update(`smelloff-pv-salt:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`)
    .digest('hex');
}

function clientIp(req) {
  const pick = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  return pick(req.headers['cf-connecting-ip'])
    || pick(req.headers['true-client-ip'])
    || pick(req.headers['x-forwarded-for'])
    || 'unknown';
}

function countryFrom(req) {
  const pick = (v) => String(Array.isArray(v) ? v[0] : v || '').trim().toUpperCase();
  const c = pick(req.headers['cf-ipcountry']) || pick(req.headers['x-vercel-ip-country']);
  return !c || c === 'XX' || c === 'T1' ? null : c.slice(0, 2);
}

function visitorHash(req, ua) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256')
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

function safeMeta(value, depth = 0) {
  if (depth > MAX_META_DEPTH) return null;
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 240);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => safeMeta(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, MAX_META_KEYS)) {
      const key = String(k).slice(0, 80);
      if (/token|secret|password|authorization|cookie|raw_ip|ip_address|email|phone|address/i.test(key)) continue;
      out[key] = safeMeta(v, depth + 1);
    }
    return out;
  }
  return null;
}

// Best-effort per-warm-instance rate limit.
const RL_LIMIT = 180;
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
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).end();
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(204).end();

  // Fail silently: analytics must never surface an error to shoppers.
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(204).end();

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT_RE.test(ua)) return res.status(204).end();
    if (rateLimited(clientIp(req))) return res.status(204).end();

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // Keep the public write surface bounded even if the platform already parsed JSON.
    if (JSON.stringify(body).length > MAX_BODY_BYTES) return res.status(204).end();

    const type = str(body.type, 48) || 'pageview';
    if (!ALLOWED_EVENTS.has(type)) return res.status(204).end();

    const path = cleanPath(body.path != null ? body.path : body.p);
    if (/^\/(admin|api)(\/|$)/.test(path)) return res.status(204).end();

    const visitor = visitorHash(req, ua);
    const device = deviceFrom(ua);
    const country = countryFrom(req);
    const referrer = refHost(body.ref != null ? body.ref : body.r, 'smelloff.in');
    const sessionId = str(body.session, 64);

    if (type === 'pageview') {
      await sbWrite('page_views', {
        path, referrer_host: referrer, device, country, visitor,
      });
    } else {
      const numericValue = body.value == null ? null : Number(body.value);
      await sbWrite('events', {
        type,
        path,
        label: str(body.label, 200),
        value: Number.isFinite(numericValue) ? numericValue : null,
        visitor,
        session_id: sessionId,
        device,
        country,
        referrer_host: referrer,
        meta: safeMeta(body.meta) || {},
      });
    }

    const cart = body.cart && typeof body.cart === 'object' ? body.cart : null;
    if (sessionId && (cart || CART_EVENTS.has(type))) {
      const contact = (cart && cart.contact) || {};
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
          row.items = cart.items.slice(0, 20).map(item => safeMeta(item));
          row.item_count = intOf(cart.item_count != null ? cart.item_count : row.items.length);
        }
        if (cart.total != null) row.total = Math.max(0, intOf(cart.total));
        if (cart.currency) row.currency = str(cart.currency, 8);
      }
      // Deliberately do not store contact details in the analytics cart table.
      // Checkout/order tables own customer identity.
      if (contact && typeof contact === 'object') row.contact_captured = Boolean(contact.name || contact.email || contact.phone);

      await sbWrite('carts?on_conflict=session_id', row, {
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    }

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