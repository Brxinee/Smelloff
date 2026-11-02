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
 *   dashboard {days}               → the Home screen in one call: KPIs for the period
 *                                    and the one before it, a sales series, the
 *                                    work queue, channels, states, traffic + funnel
 *   bulkUpdateOrders {ids, status} → one status for up to 100 orders
 *   traffic {days}                 → visitors, funnel, sources, pages, devices,
 *                                    checkout-exit answers (first-party analytics)
 *   pulse                          → newest order + open counts, for the 60 s poll
 *
 * Every order the API returns carries `view`: the customer name, city, bottles,
 * the fulfilment stage, the payment state, the next status and whether it is a
 * test / internal order. The dashboard reads those instead of re-deriving them,
 * so the rules live in one place (here). KPIs leave test orders out.
 */
import crypto from 'node:crypto';
import { checkRateLimit, clientIp } from './_security.js';
import { runAfterResponse } from './_background.js';
import { syncSheets, syncSheetsNow, isTestOrInternal } from './sheets-sync.js';

const COOKIE = 'sf_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;

export const ORDER_STATUSES = [
  'placed', 'upi_pending', 'verification_pending', 'payment_not_verified',
  'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled',
  'failed', 'returned',
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
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
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

const NOT_SALES = new Set(['cancelled', 'payment_not_verified', 'upi_pending', 'verification_pending', 'failed', 'returned']);
const isRevenue = (o) => !NOT_SALES.has(o.status);
const CLOSED_STATUSES = new Set(['cancelled', 'failed', 'payment_not_verified', 'returned']);
const isCod = (o) => String(o?.payment_method || '').toLowerCase() === 'cod';

/* ── one order's state, for every screen ─────────────────────────────── *
 * The `status` column mixes payment and fulfilment. The dashboard shows them
 * apart (the Shopify admin pattern: a payment badge and a fulfilment badge),
 * because "what do I do next" depends on both: a COD order is shipped before
 * it is paid, a prepaid order is never shipped before it is.
 */
export const NEXT_STATUS = {
  placed: 'confirmed', confirmed: 'packed', packed: 'dispatched',
  dispatched: 'out_for_delivery', out_for_delivery: 'delivered',
};

// confirm → pack → ship → transit → delivered, or unpaid / closed.
export function orderStage(o) {
  switch (o?.status) {
    case 'placed': return isCod(o) ? 'confirm' : 'pack';
    case 'confirmed': return 'pack';
    case 'packed': return 'ship';
    case 'dispatched': case 'out_for_delivery': return 'transit';
    case 'delivered': return 'delivered';
    case 'upi_pending': case 'verification_pending': return 'unpaid';
    default: return 'closed';
  }
}

// paid · cod_due · collected · pending · failed · refund_due · none
export function paymentState(o) {
  const st = o?.status;
  const history = Array.isArray(o?.status_history) ? o.status_history : [];
  if (isCod(o)) {
    if (st === 'delivered') return 'collected';
    return CLOSED_STATUSES.has(st) ? 'none' : 'cod_due';
  }
  if (st === 'upi_pending' || st === 'verification_pending') return 'pending';
  if (st === 'failed' || st === 'payment_not_verified') return 'failed';
  if (st === 'cancelled' || st === 'returned') {
    // Money came in (the order was confirmed once) and the order is closed.
    return history.some((h) => h?.status === 'confirmed') ? 'refund_due' : 'none';
  }
  return 'paid';
}

const nameOf = (a = {}) => a.name || a.full_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || '';
const bottlesOf = (o) => (Array.isArray(o?.items) ? o.items : []).reduce((s, i) => s + (Number(i?.quantity ?? i?.qty) || 0), 0) || 1;
const lastChangeAt = (o) => {
  const h = Array.isArray(o?.status_history) ? o.status_history : [];
  return h.length ? h[h.length - 1]?.at || o.created_at : o.created_at;
};

export function decorate(o) {
  const a = o?.address || {};
  return {
    ...o,
    view: {
      name: nameOf(a), city: a.city || '', state: a.state || '', pincode: a.pincode || a.pin || '',
      bottles: bottlesOf(o), stage: orderStage(o), payment: paymentState(o),
      // A paid online order skips the COD confirmation call.
      next: o?.status === 'placed' && !isCod(o) ? 'packed' : NEXT_STATUS[o?.status] || null, test: isTestOrInternal(o), changedAt: lastChangeAt(o),
    },
  };
}

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
      orders: 0, spent: 0, first: o.created_at, last: o.created_at, orderCodes: [], test: false, state: '',
    };
    c.orders += 1;
    c.test ||= isTestOrInternal(o);
    c.state ||= addr.state || '';
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

/* ── the Home screen ─────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;
const IST = 330 * 60 * 1000; // the store keeps Indian time
export const istDay = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
const istMidnight = (ms) => Date.parse(`${istDay(ms)}T00:00:00Z`) - IST;
const PERIODS = [1, 7, 30, 90];

// days = 1 is "today" (since midnight IST); otherwise the last N×24 h. The
// previous period is the same length right before it, so deltas compare like
// with like.
export function periodBounds(days, now = Date.now()) {
  const d = PERIODS.includes(Number(days)) ? Number(days) : 30;
  const start = d === 1 ? istMidnight(now) : now - d * DAY;
  const len = d === 1 ? DAY : now - start;
  return { days: d, start, end: now, prevStart: start - len, prevEnd: start };
}

export function metrics(list) {
  const sales = list.filter(isRevenue);
  const revenue = sales.reduce((s, o) => s + Number(o.amount || 0), 0);
  const collected = list.filter((o) => ['paid', 'collected'].includes(paymentState(o)))
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const cod = sales.filter(isCod).length;
  return {
    orders: sales.length,
    revenue,
    collected,
    aov: sales.length ? Math.round(revenue / sales.length) : 0,
    bottles: sales.reduce((s, o) => s + bottlesOf(o), 0),
    codShare: sales.length ? cod / sales.length : 0,
    unpaid: list.filter((o) => orderStage(o) === 'unpaid').length,
    cancelled: list.filter((o) => o.status === 'cancelled').length,
  };
}

// One bucket per IST day (per IST hour for "today"), zero-filled so the
// chart's x axis is honest about quiet days.
export function salesSeries(list, { days, start, end }) {
  const hourly = days === 1;
  const step = hourly ? 60 * 60 * 1000 : DAY;
  const keyOf = (ms) => (hourly ? new Date(ms + IST).toISOString().slice(0, 13) : istDay(ms));
  const buckets = new Map();
  for (let t = hourly ? start : istMidnight(start); t <= end; t += step) buckets.set(keyOf(t), { key: keyOf(t), revenue: 0, orders: 0 });
  for (const o of list) {
    if (!isRevenue(o)) continue;
    const b = buckets.get(keyOf(Date.parse(o.created_at)));
    if (b) { b.revenue += Number(o.amount || 0); b.orders += 1; }
  }
  return [...buckets.values()];
}

function countBy(list, keyFn, limit = 6) {
  const map = new Map();
  for (const o of list) { const k = keyFn(o) || 'Unknown'; map.set(k, (map.get(k) || 0) + 1); }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

export function workQueue(orders, now = Date.now()) {
  const live = orders.filter((o) => !isTestOrInternal(o));
  const stage = (s) => live.filter((o) => orderStage(o) === s).length;
  return {
    confirm: stage('confirm'),
    pack: stage('pack'),
    ship: stage('ship'),
    transit: stage('transit'),
    // A prepaid checkout that never finished in the last 7 days: worth a
    // WhatsApp. Older ones are noise.
    unpaid: live.filter((o) => orderStage(o) === 'unpaid' && now - Date.parse(o.created_at) < 7 * DAY).length,
    // Shipped more than 7 days ago and still not delivered.
    stuck: live.filter((o) => orderStage(o) === 'transit' && now - Date.parse(lastChangeAt(o)) > 7 * DAY).length,
    refunds: live.filter((o) => paymentState(o) === 'refund_due').length,
  };
}

export function buildDashboard(orders, days, now = Date.now()) {
  const p = periodBounds(days, now);
  const live = orders.filter((o) => !isTestOrInternal(o));
  const inRange = (a, b) => live.filter((o) => { const t = Date.parse(o.created_at); return t >= a && t < b + 1; });
  const cur = inRange(p.start, p.end);
  const prev = inRange(p.prevStart, p.prevEnd - 1);
  const sales = cur.filter(isRevenue);
  return {
    period: { days: p.days, start: new Date(p.start).toISOString(), end: new Date(p.end).toISOString() },
    current: metrics(cur),
    previous: metrics(prev),
    series: salesSeries(live, p),
    queue: workQueue(orders, now),
    channels: countBy(sales, (o) => o.attribution?.channel || 'Direct / unknown'),
    states: countBy(sales, (o) => o.address?.state || ''),
    latest: orders.slice(0, 6).map(decorate),
    testOrders: orders.length - live.length,
    generatedAt: new Date(now).toISOString(),
  };
}

async function rpc(name, args) {
  try { return await db(`rpc/${name}`, { method: 'POST', body: args }); } catch { return null; }
}

// The analytics functions take p_days, or p_start for "today".
function rpcArgs(days, now = Date.now()) {
  const p = periodBounds(days, now);
  return p.days === 1 ? { p_start: new Date(p.start).toISOString() } : { p_days: p.days };
}

const UUID = /^[0-9a-f-]{36}$/i;

/* ── actions ─────────────────────────────────────────────────────────── */

const actions = {
  async overview() {
    const orders = await listOrders({ limit: 1000 });
    return { stats: summarize(orders), latest: orders.slice(0, 8).map(decorate) };
  },
  async dashboard(body) {
    const days = Number(body.days) || 30;
    const [orders, analytics, events, messages] = await Promise.all([
      listOrders({ limit: 1000 }),
      rpc('site_analytics', rpcArgs(days)),
      rpc('site_events', rpcArgs(days)),
      db('contact_messages?select=id&status=eq.new&limit=100').catch(() => []),
    ]);
    const dash = buildDashboard(orders, days);
    dash.traffic = analytics ? {
      visitors: analytics.totals?.visitors ?? 0, visitorsPrev: analytics.totals?.visitorsPrev ?? 0,
      views: analytics.totals?.views ?? 0, engaged: analytics.totals?.engaged ?? 0,
      funnel: events?.funnel || null,
    } : null;
    dash.queue.messages = Array.isArray(messages) ? messages.length : 0;
    return dash;
  },
  async orders(body) {
    return { orders: (await listOrders(body)).map(decorate), statuses: ORDER_STATUSES };
  },
  async pulse() {
    const [latest, open, messages] = await Promise.all([
      db('orders?select=id,created_at,order_code&order=created_at.desc&limit=1'),
      db('orders?select=id,status,payment_method,address,customer_email,customer_phone,created_at,status_history&status=in.(placed,confirmed,packed,dispatched,out_for_delivery,upi_pending,verification_pending)&limit=1000'),
      db('contact_messages?select=id&status=eq.new&limit=100').catch(() => []),
    ]);
    const queue = workQueue(open || []);
    queue.messages = Array.isArray(messages) ? messages.length : 0;
    return { latest: latest?.[0] || null, queue };
  },
  async bulkUpdateOrders(body) {
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))] : [];
    if (!ids.length || ids.length > 100 || !ids.every((id) => UUID.test(id))) throw new HttpError(400, 'Pick between 1 and 100 orders.');
    if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status.');
    const rows = await db(`orders?id=in.(${ids.join(',')})&select=${ORDER_COLUMNS}`, { method: 'PATCH', body: { status: body.status } });
    await runAfterResponse('admin', () => syncSheetsNow('/api/admin'));
    return { orders: (rows || []).map(decorate) };
  },
  async traffic(body) {
    const days = Number(body.days) || 30;
    const args = rpcArgs(days);
    const since = new Date(periodBounds(days).start).toISOString();
    const [analytics, events, segments, exits] = await Promise.all([
      rpc('site_analytics', args),
      rpc('site_events', args),
      rpc('site_analytics_segments', args),
      db(`events?select=label&type=eq.checkout_exit&created_at=gte.${since}&limit=2000`).catch(() => []),
    ]);
    if (!analytics) throw new HttpError(502, 'Analytics are unavailable right now.');
    const exitCounts = {};
    for (const e of exits || []) exitCounts[e.label || 'unknown'] = (exitCounts[e.label || 'unknown'] || 0) + 1;
    return {
      days: periodBounds(days).days,
      totals: analytics.totals || {},
      daily: analytics.daily || [],
      pages: (analytics.topPages || []).slice(0, 10),
      referrers: (analytics.referrers || []).slice(0, 8),
      devices: analytics.devices || [],
      countries: (analytics.countries || []).slice(0, 8),
      funnel: events?.funnel || null,
      clicks: (events?.topClicks || []).slice(0, 10),
      sources: segments?.bySource || [],
      campaigns: (segments?.byCampaign || []).slice(0, 8),
      checkoutExit: Object.entries(exitCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    };
  },
  async updateOrder(body) {
    const id = String(body.id || '');
    if (!UUID.test(id)) throw new HttpError(400, 'Invalid order id.');
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
    return { order: decorate(rows[0]) };
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
    return { reviews: await db('reviews?select=id,created_at,name,city,rating,body,anonymous,order_id,order:orders(status,payment_method)&order=created_at.desc&limit=300') };
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
