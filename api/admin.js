// /api/admin — backend for the Smelloff admin dashboard (admin.smelloff.in).
//
// One serverless function, action-dispatched via POST JSON { action, ... }.
// Everything except "login" requires a Bearer session token (HMAC-signed,
// 12h expiry) issued against ADMIN_PASSWORD. Supabase is accessed with the
// SERVICE ROLE key (server-side only — bypasses RLS), GA4 through the Data API
// with a Google service account. No third-party npm deps.
//
// Required env:   ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY
// Optional env:   ADMIN_SESSION_SECRET (else derived from password),
//                 SUPABASE_URL (defaults to the project URL),
//                 GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON (analytics tab)

import crypto from 'node:crypto';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Table registry — the ONLY tables and columns this endpoint will touch.
// `writable` is the whitelist for create/update payloads; `search` columns
// feed the ilike search; `filters` are the eq-filters a client may request.
// ---------------------------------------------------------------------------
const TABLES = {
  orders: {
    select:
      'id,created_at,order_code,customer_email,customer_phone,items,amount,payment_method,status,upi_ref,tracking_id,courier,tracking_url,address',
    writable: [
      'customer_email', 'customer_phone', 'items', 'amount', 'payment_method',
      'status', 'upi_ref', 'tracking_id', 'courier', 'tracking_url', 'address',
      'order_code',
    ],
    search: ['order_code', 'customer_phone', 'customer_email'],
    filters: ['status', 'payment_method'],
  },
  reviews: {
    select: 'id,created_at,name,rating,body,city,anonymous,order_id',
    writable: ['name', 'rating', 'body', 'city', 'anonymous', 'order_id'],
    search: ['name', 'body', 'city'],
    filters: ['rating'],
  },
  contact_messages: {
    select: 'id,created_at,name,email,phone,topic,message,status',
    writable: ['name', 'email', 'phone', 'topic', 'message', 'status'],
    search: ['name', 'email', 'phone', 'message'],
    filters: ['status', 'topic'],
  },
  waitlist: {
    select: 'id,created_at,email,source',
    writable: ['email', 'source'],
    search: ['email'],
    filters: ['source'],
  },
  blog_comments: {
    select: 'id,created_at,post_slug,author_name,body,approved',
    writable: ['post_slug', 'author_name', 'body', 'approved'],
    search: ['author_name', 'body', 'post_slug'],
    filters: ['approved', 'post_slug'],
  },
  products: {
    select:
      'id,created_at,name,slug,description,price,compare_at_price,sku,stock,image_url,active,variants,sort_order',
    writable: [
      'name', 'slug', 'description', 'price', 'compare_at_price', 'sku',
      'stock', 'image_url', 'active', 'variants', 'sort_order',
    ],
    search: ['name', 'slug', 'sku'],
    filters: ['active'],
    // Catalog is hand-ordered (sort_order), newest first as a tiebreak — unlike
    // the other tables which are purely reverse-chronological.
    order: 'sort_order.asc,created_at.desc',
  },
};

// ---------------------------------------------------------------------------
// Sessions — stateless HMAC tokens: "v1.<expiryMs>.<hmac>"
// ---------------------------------------------------------------------------
function sessionSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  return crypto
    .createHash('sha256')
    .update(`smelloff-admin-session:${process.env.ADMIN_PASSWORD}`)
    .digest('hex');
}

function signSession(expMs) {
  const mac = crypto
    .createHmac('sha256', sessionSecret())
    .update(`v1.${expMs}`)
    .digest('base64url');
  return `v1.${expMs}.${mac}`;
}

function verifySession(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expMs = Number(parts[1]);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  const expected = signSession(expMs);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function passwordMatches(candidate) {
  const secret = process.env.ADMIN_PASSWORD || '';
  const a = crypto.createHash('sha256').update(String(candidate)).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return secret.length > 0 && crypto.timingSafeEqual(a, b);
}

// Best-effort per-warm-instance limiter for login attempts (same approach as
// /api/send-email). A cold start resets it; the password is the real gate.
const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const loginBuckets = new Map();

function loginRateLimited(ip) {
  const now = Date.now();
  const b = loginBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    loginBuckets.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    if (loginBuckets.size > 2000) {
      for (const [k, v] of loginBuckets) if (now >= v.resetAt) loginBuckets.delete(k);
    }
    return false;
  }
  if (b.count >= LOGIN_LIMIT) return true;
  b.count++;
  return false;
}

// ---------------------------------------------------------------------------
// Supabase (PostgREST) with the service role key
// ---------------------------------------------------------------------------
async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data && data.message ? data.message : `Supabase error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.expose = true; // PostgREST messages (constraint names etc.) are safe enough for the admin
    throw err;
  }
  return { data, contentRange: res.headers.get('content-range') };
}

// PostgREST filter values ride inside the query string mini-language, so keep
// user search input to a conservative charset (no , ( ) . * backslash).
function sanitizeSearch(s) {
  return String(s).replace(/[^A-Za-z0-9@ _+\-]/g, '').trim().slice(0, 60);
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function pickWritable(table, row) {
  const out = {};
  for (const col of TABLES[table].writable) {
    if (row[col] !== undefined) out[col] = row[col];
  }
  return out;
}

async function listRows({ table, limit, offset, filters, search }) {
  const cfg = TABLES[table];
  const params = new URLSearchParams();
  params.set('select', cfg.select);
  params.set('order', cfg.order || 'created_at.desc');
  params.set('limit', String(Math.min(Math.max(Number(limit) || 50, 1), 500)));
  params.set('offset', String(Math.max(Number(offset) || 0, 0)));
  if (filters && typeof filters === 'object') {
    for (const [k, v] of Object.entries(filters)) {
      if (!cfg.filters.includes(k) || v === '' || v === null || v === undefined) continue;
      params.set(k, `eq.${sanitizeSearch(v)}`);
    }
  }
  if (search) {
    const q = sanitizeSearch(search);
    if (q) params.set('or', `(${cfg.search.map((c) => `${c}.ilike.*${q}*`).join(',')})`);
  }
  const { data, contentRange } = await sb(`${table}?${params}`, {
    headers: { Prefer: 'count=exact' },
  });
  const total = contentRange ? Number(contentRange.split('/')[1]) : data.length;
  return { rows: data, total: Number.isFinite(total) ? total : data.length };
}

// ---------------------------------------------------------------------------
// Business stats, computed from the orders table
// ---------------------------------------------------------------------------
const REVENUE_STATUSES = new Set([
  'placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered',
]);

async function computeStats() {
  const [ordersRes, reviewCount, newMsgCount, waitlistCount, pendingComments, lowStock] =
    await Promise.all([
      sb('orders?select=created_at,amount,status,payment_method,address,customer_phone,items&order=created_at.desc&limit=5000'),
      countRows('reviews'),
      countRows('contact_messages', 'status=eq.new'),
      countRows('waitlist'),
      countRows('blog_comments', 'approved=eq.false'),
      // Active products with tracked stock at or below the low-stock threshold.
      // Wrapped so a missing products table (pre-migration) never breaks stats.
      countRows('products', 'active=eq.true&stock=lte.5').catch(() => 0),
    ]);
  const orders = ordersRes.data;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const daily = new Map(); // yyyy-mm-dd -> {revenue, orders}
  for (let i = 89; i >= 0; i--) {
    daily.set(new Date(now - i * DAY).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }

  let revenue = 0, units = 0, pendingUpi = 0, cancelled = 0;
  let rev30 = 0, revPrev30 = 0, n30 = 0, nPrev30 = 0;
  const statusCounts = {}, paymentCounts = {}, cityRevenue = new Map(), phones = new Map();

  for (const o of orders) {
    const t = Date.parse(o.created_at);
    const rupees = (Number(o.amount) || 0) / 100;
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    if (o.status === 'upi_pending') pendingUpi++;
    if (o.status === 'cancelled') cancelled++;
    if (!REVENUE_STATUSES.has(o.status)) continue;

    revenue += rupees;
    paymentCounts[o.payment_method] = (paymentCounts[o.payment_method] || 0) + 1;
    if (Array.isArray(o.items)) {
      for (const it of o.items) units += Number(it && it.quantity) || 0;
    }
    const city = o.address && o.address.city ? String(o.address.city).trim() : '';
    if (city) cityRevenue.set(city, (cityRevenue.get(city) || 0) + rupees);
    if (o.customer_phone) phones.set(o.customer_phone, (phones.get(o.customer_phone) || 0) + 1);

    const key = new Date(t).toISOString().slice(0, 10);
    const bucket = daily.get(key);
    if (bucket) { bucket.revenue += rupees; bucket.orders += 1; }

    const age = now - t;
    if (age <= 30 * DAY) { rev30 += rupees; n30++; }
    else if (age <= 60 * DAY) { revPrev30 += rupees; nPrev30++; }
  }

  const paidOrders = Object.entries(statusCounts)
    .filter(([s]) => REVENUE_STATUSES.has(s))
    .reduce((a, [, n]) => a + n, 0);
  const repeatCustomers = [...phones.values()].filter((n) => n > 1).length;

  return {
    revenue: Math.round(revenue),
    orders: paidOrders,
    aov: paidOrders ? Math.round(revenue / paidOrders) : 0,
    units,
    pendingUpi,
    cancelled,
    rev30: Math.round(rev30),
    revPrev30: Math.round(revPrev30),
    n30,
    nPrev30,
    statusCounts,
    paymentCounts,
    topCities: [...cityRevenue.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([city, rev]) => ({ city, revenue: Math.round(rev) })),
    uniqueCustomers: phones.size,
    repeatCustomers,
    daily: [...daily.entries()].map(([date, d]) => ({
      date, revenue: Math.round(d.revenue), orders: d.orders,
    })),
    counts: {
      reviews: reviewCount,
      newMessages: newMsgCount,
      waitlist: waitlistCount,
      pendingComments,
      lowStock,
    },
  };
}

async function countRows(table, filter) {
  const { contentRange } = await sb(
    `${table}?select=id${filter ? `&${filter}` : ''}&limit=1`,
    { headers: { Prefer: 'count=exact' } },
  );
  const total = contentRange ? Number(contentRange.split('/')[1]) : 0;
  return Number.isFinite(total) ? total : 0;
}

// ---------------------------------------------------------------------------
// Customer directory — orders rolled up by phone (the primary identifier):
// name, contact, city, what & how much they ordered, spend and recency.
// ---------------------------------------------------------------------------
async function computeCustomers() {
  const { data: orders } = await sb(
    'orders?select=created_at,customer_phone,customer_email,items,amount,status,payment_method,address&order=created_at.desc&limit=5000',
  );
  const map = new Map();
  for (const o of orders) {
    const phone = (o.customer_phone || '').trim() || 'unknown';
    let c = map.get(phone);
    if (!c) {
      c = {
        phone, name: '', email: null, city: '', state: '',
        orders: 0, cancelled: 0, units: 0, spent: 0,
        firstOrder: o.created_at, lastOrder: o.created_at,
        items: {}, payments: {},
      };
      map.set(phone, c);
    }
    c.orders += 1;
    // Orders arrive newest-first, so the first value we see is the most recent.
    if (!c.name && o.address && o.address.name) c.name = String(o.address.name);
    if (!c.email && o.customer_email) c.email = o.customer_email;
    if (!c.city && o.address && o.address.city) c.city = String(o.address.city);
    if (!c.state && o.address && o.address.state) c.state = String(o.address.state);
    if (o.created_at > c.lastOrder) c.lastOrder = o.created_at;
    if (o.created_at < c.firstOrder) c.firstOrder = o.created_at;
    if (o.payment_method) c.payments[o.payment_method] = (c.payments[o.payment_method] || 0) + 1;
    if (o.status === 'cancelled') { c.cancelled += 1; continue; }
    c.spent += (Number(o.amount) || 0) / 100;
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const q = Number(it && it.quantity) || 0;
        c.units += q;
        const label = String((it && (it.label || it.name)) || 'ODORSTRIKE').slice(0, 60)
          + (it && it.variant ? ` ${it.variant}` : '');
        c.items[label] = (c.items[label] || 0) + q;
      }
    }
  }
  const customers = [...map.values()].map((c) => ({
    phone: c.phone,
    name: c.name || '',
    email: c.email || '',
    city: c.city || '',
    state: c.state || '',
    orders: c.orders,
    cancelled: c.cancelled,
    units: c.units,
    spent: Math.round(c.spent),
    firstOrder: c.firstOrder,
    lastOrder: c.lastOrder,
    items: Object.entries(c.items).map(([k, q]) => `${k} ×${q}`).join(', '),
    payment: Object.keys(c.payments).join('/').toUpperCase(),
  })).sort((a, b) => b.spent - a.spent || b.orders - a.orders);
  return { customers, total: customers.length };
}

// ---------------------------------------------------------------------------
// GA4 Data API via service account (no SDK: RS256 JWT + token exchange)
// ---------------------------------------------------------------------------
let gaTokenCache = null;

function ga4Configured() {
  return Boolean(process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_JSON);
}

async function gaAccessToken() {
  if (gaTokenCache && gaTokenCache.exp > Date.now() + 60_000) return gaTokenCache.token;
  const sa = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s) => Buffer.from(s).toString('base64url');
  const unsigned =
    b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    b64u(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const jwt = `${unsigned}.${signature.toString('base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error('GA4 token exchange failed:', data);
    throw new Error('GA4 authentication failed — check the service account.');
  }
  gaTokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return gaTokenCache.token;
}

function gaReportBody(report, days) {
  const d = Math.min(Math.max(Number(days) || 28, 1), 365);
  const dateRanges = [{ startDate: `${d}daysAgo`, endDate: 'today' }];
  switch (report) {
    case 'timeseries':
      return {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 366,
      };
    case 'totals':
      return {
        dateRanges,
        metrics: [
          { name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' },
          { name: 'screenPageViews' }, { name: 'engagementRate' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
        ],
      };
    case 'pages':
      return {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      };
    case 'channels':
      return {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      };
    case 'sources':
      return {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 12,
      };
    case 'devices':
      return {
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      };
    case 'cities':
      return {
        dateRanges,
        dimensions: [{ name: 'city' }, { name: 'region' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 12,
      };
    default:
      return null;
  }
}

async function gaRun(report, days) {
  if (!ga4Configured()) {
    return { configured: false };
  }
  const token = await gaAccessToken();
  const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  let url, body;
  if (report === 'realtime') {
    url = `https://analyticsdata.googleapis.com/v1beta/${property}:runRealtimeReport`;
    body = { metrics: [{ name: 'activeUsers' }], dimensions: [{ name: 'deviceCategory' }] };
  } else {
    body = gaReportBody(report, days);
    if (!body) { const e = new Error('Unknown GA4 report.'); e.status = 400; e.expose = true; throw e; }
    url = `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('GA4 report failed:', report, data);
    const e = new Error((data.error && data.error.message) || 'GA4 report failed.');
    e.status = 502;
    e.expose = true;
    throw e;
  }
  // Flatten the GA4 response into simple rows the dashboard can consume.
  const dims = (data.dimensionHeaders || []).map((h) => h.name);
  const mets = (data.metricHeaders || []).map((h) => h.name);
  const rows = (data.rows || []).map((r) => {
    const out = {};
    dims.forEach((name, i) => { out[name] = r.dimensionValues[i].value; });
    mets.forEach((name, i) => { out[name] = Number(r.metricValues[i].value); });
    return out;
  });
  return { configured: true, report, rows, rowCount: data.rowCount || rows.length };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = typeof body.action === 'string' ? body.action : '';

  try {
    if (action === 'login') {
      const fwd = req.headers['x-forwarded-for'] || '';
      const ip = (Array.isArray(fwd) ? fwd[0] : String(fwd).split(',')[0]).trim() || 'unknown';
      if (loginRateLimited(ip)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
      }
      if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'ADMIN_PASSWORD is not set on the server.' });
      }
      if (!passwordMatches(body.password || '')) {
        return res.status(401).json({ error: 'Wrong password.' });
      }
      const exp = Date.now() + SESSION_TTL_MS;
      return res.status(200).json({ token: signSession(exp), expiresAt: exp });
    }

    // Everything below requires a valid session.
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!verifySession(token)) {
      return res.status(401).json({ error: 'Session expired. Log in again.' });
    }

    switch (action) {
      case 'config':
        return res.status(200).json({
          supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          analytics: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          ga4: ga4Configured(),
          resend: Boolean(process.env.RESEND_API_KEY),
        });

      case 'stats':
        return res.status(200).json(await computeStats());

      case 'customers':
        return res.status(200).json(await computeCustomers());

      case 'ga4':
        return res.status(200).json(await gaRun(String(body.report || ''), body.days));

      case 'analytics': {
        // First-party site analytics — one aggregated report from page_views.
        const days = Math.min(Math.max(Number(body.days) || 28, 1), 365);
        const { data } = await sb('rpc/site_analytics', { method: 'POST', body: { p_days: days } });
        return res.status(200).json(data);
      }

      case 'analytics_realtime': {
        const { data } = await sb('rpc/site_realtime', { method: 'POST', body: {} });
        return res.status(200).json({ active: Number(data) || 0 });
      }

      case 'list': {
        const table = String(body.table || '');
        if (!TABLES[table]) return res.status(400).json({ error: 'Unknown table.' });
        return res.status(200).json(await listRows({
          table,
          limit: body.limit,
          offset: body.offset,
          filters: body.filters,
          search: body.search,
        }));
      }

      case 'create': {
        const table = String(body.table || '');
        if (!TABLES[table]) return res.status(400).json({ error: 'Unknown table.' });
        const row = pickWritable(table, body.row && typeof body.row === 'object' ? body.row : {});
        if (Object.keys(row).length === 0) {
          return res.status(400).json({ error: 'Nothing to insert.' });
        }
        const { data } = await sb(`${table}?select=${TABLES[table].select}`, {
          method: 'POST',
          body: row,
          headers: { Prefer: 'return=representation' },
        });
        return res.status(200).json({ row: data[0] });
      }

      case 'update': {
        const table = String(body.table || '');
        if (!TABLES[table]) return res.status(400).json({ error: 'Unknown table.' });
        if (!isUuid(body.id)) return res.status(400).json({ error: 'Invalid id.' });
        const patch = pickWritable(table, body.patch && typeof body.patch === 'object' ? body.patch : {});
        if (Object.keys(patch).length === 0) {
          return res.status(400).json({ error: 'Nothing to update.' });
        }
        const { data } = await sb(
          `${table}?id=eq.${body.id}&select=${TABLES[table].select}`,
          { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } },
        );
        if (!data || data.length === 0) return res.status(404).json({ error: 'Row not found.' });
        return res.status(200).json({ row: data[0] });
      }

      case 'delete': {
        const table = String(body.table || '');
        if (!TABLES[table]) return res.status(400).json({ error: 'Unknown table.' });
        if (!isUuid(body.id)) return res.status(400).json({ error: 'Invalid id.' });
        await sb(`${table}?id=eq.${body.id}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
  } catch (err) {
    console.error(`admin action "${action}" failed:`, err);
    const status = Number(err && err.status) || 500;
    const message = err && err.expose ? err.message : 'Something went wrong on the server.';
    return res.status(status).json({ error: message });
  }
}
