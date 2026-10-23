/*
 * /api/admin — the whole backend for the owner dashboard (/admin).
 *
 * One password (ADMIN_PASSWORD) → a signed, HttpOnly session cookie (12 h).
 * Every other action needs that cookie and talks to Supabase with the
 * service-role key, which never leaves the server. Writes are limited to an
 * explicit field allow-list per table.
 *
 * Actions (POST JSON { action, ... }):
 *   login {password} · logout · me
 *   overview                       → KPIs + latest orders
 *   orders {q?, status?, limit?}   → order list
 *   updateOrder {id, status?, courier?, tracking_id?, tracking_url?}
 *   customers {q?}                 → customers aggregated from orders
 *   messages                       → contact form inbox
 *   updateMessage {id, status}
 *   reviews                        → every review; only ones with an order show
 *   syncSheets {rebuild?}          → copy orders + contacts into the Google Sheets now
 *                                    (rebuild: redraw the sheets' design too)
 */
import crypto from 'node:crypto';
import { checkRateLimit, clientIp } from './_security.js';
import { runAfterResponse } from './_background.js';
import { syncSheets, syncSheetsNow } from './sheets-sync.js';

const COOKIE = 'sf_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;

export const ORDER_STATUSES = [
  'placed', 'upi_pending', 'verification_pending', 'payment_not_verified',
  'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled',
];
const OPEN_STATUSES = new Set(['placed', 'upi_pending', 'verification_pending', 'confirmed', 'packed']);
const MESSAGE_STATUSES = ['new', 'replied', 'closed'];
const ORDER_EDITABLE = ['status', 'courier', 'tracking_id', 'tracking_url'];

const supabaseUrl = () => (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const password = () => String(process.env.ADMIN_PASSWORD || '');
const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || `${password()}::smelloff-admin`;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ── session ─────────────────────────────────────────────────────────── */

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function issueSession(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token, now = Date.now()) {
  if (!password() || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  let signatureMatches = false;
  try {
    const a = Buffer.from(mac, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      signatureMatches = false;
    } else {
      signatureMatches = crypto.timingSafeEqual(a, b);
    }
  } catch {
    signatureMatches = false;
  }
  if (!signatureMatches) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > now;
  } catch { return false; }
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

function setCookie(res, value, maxAgeMs) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`);
}

function passwordMatches(given) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(password()).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ── supabase ────────────────────────────────────────────────────────── */

async function db(path, { method = 'GET', body } = {}) {
  if (!serviceKey()) throw new HttpError(503, 'Database key (SUPABASE_SERVICE_ROLE_KEY) is not set in Cloudflare.');
  let response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceKey(),
        Authorization: `Bearer ${serviceKey()}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new HttpError(503, `Database unreachable: ${error?.message || error}`);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 502, data?.message || `Database error ${response.status}`);
  return data;
}

const ORDER_COLUMNS = 'id,created_at,order_code,customer_email,customer_phone,items,amount,cod_fee,payment_method,status,upi_ref,courier,tracking_id,tracking_url,address,status_history,shiprocket_awb,shiprocket_courier,shiprocket_status,attribution';

function sanitizeSearch(q) {
  return String(q || '').replace(/[^\w@.+\- ]/g, '').trim().slice(0, 80);
}

async function listOrders({ q, status, limit = 200 } = {}) {
  const params = new URLSearchParams({ select: ORDER_COLUMNS, order: 'created_at.desc', limit: String(Math.min(Number(limit) || 200, 1000)) });
  if (status && ORDER_STATUSES.includes(status)) params.set('status', `eq.${status}`);
  const term = sanitizeSearch(q);
  if (term) params.set('or', `(order_code.ilike.*${term}*,customer_email.ilike.*${term}*,customer_phone.ilike.*${term}*)`);
  return db(`orders?${params}`);
}

/* ── derived views ───────────────────────────────────────────────────── */

const isRevenue = (o) => !['cancelled', 'payment_not_verified', 'upi_pending', 'verification_pending'].includes(o.status);

export function summarize(orders, now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  const since = (days) => orders.filter((o) => now - Date.parse(o.created_at) < days * day);
  const sum = (list) => list.filter(isRevenue).reduce((s, o) => s + Number(o.amount || 0), 0);
  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const last30 = since(30);
  const paid30 = last30.filter(isRevenue);
  return {
    today: { orders: since(1).length, revenue: sum(since(1)) },
    week: { orders: since(7).length, revenue: sum(since(7)) },
    month: { orders: last30.length, revenue: sum(last30), aov: paid30.length ? Math.round(sum(last30) / paid30.length) : 0 },
    allTime: { orders: orders.length, revenue: sum(orders) },
    needsAction: orders.filter((o) => OPEN_STATUSES.has(o.status)).length,
    byStatus,
    customers: aggregateCustomers(orders).length,
  };
}

export function aggregateCustomers(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = String(o.customer_phone || o.customer_email || o.id).replace(/\D/g, '').slice(-10) || o.customer_email || o.id;
    const addr = o.address || {};
    const c = map.get(key) || {
      key, name: '', phone: o.customer_phone || '', email: o.customer_email || '', city: '',
      orders: 0, spent: 0, first: o.created_at, last: o.created_at, orderCodes: [],
    };
    c.orders += 1;
    if (isRevenue(o)) c.spent += Number(o.amount || 0);
    c.name ||= addr.name || addr.full_name || [addr.first_name, addr.last_name].filter(Boolean).join(' ');
    c.city ||= addr.city || '';
    c.email ||= o.customer_email || '';
    if (o.created_at < c.first) c.first = o.created_at;
    if (o.created_at > c.last) c.last = o.created_at;
    c.orderCodes.push(o.order_code);
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

/* ── actions ─────────────────────────────────────────────────────────── */

const actions = {
  async overview() {
    const orders = await listOrders({ limit: 1000 });
    return { stats: summarize(orders), latest: orders.slice(0, 8) };
  },
  async orders(body) {
    return { orders: await listOrders(body), statuses: ORDER_STATUSES };
  },
  async updateOrder(body) {
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid order id.');
    const patch = {};
    for (const field of ORDER_EDITABLE) if (field in body) patch[field] = body[field] === '' ? null : String(body[field]).slice(0, 300);
    if (patch.status && !ORDER_STATUSES.includes(patch.status)) throw new HttpError(400, 'Invalid status.');
    // The link is shown to the customer on /track-order and in emails: only a
    // real https URL, never javascript: or data:.
    if (patch.tracking_url && !/^https:\/\/[^\s"'<>]+$/i.test(patch.tracking_url)) throw new HttpError(400, 'Tracking link must start with https://');
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');
    const rows = await db(`orders?id=eq.${id}&select=${ORDER_COLUMNS}`, { method: 'PATCH', body: patch });
    if (!rows?.length) throw new HttpError(404, 'Order not found.');
    // The new status/courier reaches the Google Sheet now, not at the next cron.
    await runAfterResponse('admin', () => syncSheetsNow('/api/admin'));
    return { order: rows[0] };
  },
  async customers(body) {
    const orders = await listOrders({ limit: 1000 });
    const term = sanitizeSearch(body.q).toLowerCase();
    const all = aggregateCustomers(orders);
    return { customers: term ? all.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.city}`.toLowerCase().includes(term)) : all };
  },
  async messages() {
    return { messages: await db('contact_messages?select=*&order=created_at.desc&limit=300') };
  },
  async updateMessage(body) {
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid message id.');
    if (!MESSAGE_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status.');
    const rows = await db(`contact_messages?id=eq.${id}`, { method: 'PATCH', body: { status: body.status } });
    return { message: rows?.[0] || null };
  },
  async reviews() {
    return { reviews: await db('reviews?select=id,created_at,name,city,rating,body,anonymous,order_id&order=created_at.desc&limit=300') };
  },
  async syncSheets(body, req) {
    if (!checkRateLimit(`admin-sheets:${clientIp(req)}`, 10, 10 * 60 * 1000)) throw new HttpError(429, 'Synced recently. Wait a few minutes.');
    return { sheets: await syncSheets({ route: '/api/admin', rebuild: body.rebuild === true }) };
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Same-origin only: the cookie is SameSite=Strict, this is belt-and-braces.
  const origin = req.headers.origin;
  if (origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === String(req.headers.host || ''); } catch {}
    if (!sameHost) return res.status(403).json({ error: 'Origin not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '');

  try {
    if (action === 'login') {
      if (!password()) throw new HttpError(503, 'ADMIN_PASSWORD is not set in Cloudflare.');
      if (!checkRateLimit(`admin-login:${clientIp(req)}`, 8, 15 * 60 * 1000)) throw new HttpError(429, 'Too many attempts. Wait 15 minutes.');
      if (!passwordMatches(body.password)) throw new HttpError(401, 'Wrong password.');
      setCookie(res, issueSession(), SESSION_MS);
      return res.status(200).json({ ok: true });
    }
    if (action === 'logout') {
      setCookie(res, '', 0);
      return res.status(200).json({ ok: true });
    }
    if (!verifySession(readCookie(req, COOKIE))) throw new HttpError(401, 'Not signed in.');
    if (action === 'me') return res.status(200).json({ ok: true });
    const fn = actions[action];
    if (!fn) throw new HttpError(400, 'Unknown action.');
    return res.status(200).json(await fn(body, req));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[api/admin]', action, error?.message || error);
    return res.status(status).json({ error: error?.message || 'Server error' });
  }
}
