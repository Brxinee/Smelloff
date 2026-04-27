// Server-side proxy for the Apps Script orders webhook.
// The public Apps Script URL is no longer in client JS — it lives in
// process.env.SHEETS_ENDPOINT on Vercel, plus an HMAC token in
// process.env.SHEETS_TOKEN that the Apps Script verifies before writing.
//
// All pricing is recomputed here from a hard-coded SKU table; the client
// can ask for a variant but cannot dictate the amount.

const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

const PRICES = { solo: 229, duo: 399, trio: 549 };
const MRP    = { solo: 579, duo: 999, trio: 1399 };
const UNITS  = { solo: 1,   duo: 2,   trio: 3   };
const VARIANT_LABEL = {
  solo: { variant: 'starter', label: 'Starter Strike — 1 × 50ml' },
  duo:  { variant: 'duo',     label: 'Duo Strike — 2 × 50ml'     },
  trio: { variant: 'squad',   label: 'Squad Strike — 3 × 50ml'   },
};

const MAX_QTY_PER_ORDER = 6;
const MAX_FIELD_LEN = 200;
const MAX_ADDR_LEN = 400;

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE   = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE = new Map();
function rateLimitOk(ip, max, windowMs) {
  const now = Date.now();
  const entry = RATE.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  RATE.set(ip, entry);
  if (RATE.size > 5000) RATE.clear();
  return entry.count <= max;
}

function clean(s, max = MAX_FIELD_LEN) {
  return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function recompute(body) {
  const isWaitlist = body && body.kind === 'waitlist';
  if (isWaitlist) {
    const email = clean(body.email, 120).toLowerCase();
    if (!EMAIL_RE.test(email)) return null;
    return { kind: 'waitlist', email };
  }

  const v = body && body.variant;
  let amount, units, variantLabel, variantKey;

  if (v === 'cart') {
    if (!Array.isArray(body.items)) return null;
    const seen = new Set();
    let total = 0;
    let count = 0;
    const items = [];
    for (const it of body.items) {
      const id = it && it.id;
      const qty = Math.max(1, Math.min(MAX_QTY_PER_ORDER, parseInt(it && it.qty, 10) || 0));
      if (!PRICES[id] || seen.has(id)) return null;
      seen.add(id);
      total += PRICES[id] * qty;
      count += qty;
      items.push({ id, qty, price: PRICES[id] });
    }
    if (count === 0 || count > MAX_QTY_PER_ORDER) return null;
    amount = total;
    units = count;
    variantKey = 'cart';
    variantLabel = items.map(i => i.qty + ' × ' + i.id).join(', ');
  } else if (PRICES[v]) {
    amount = PRICES[v];
    units = UNITS[v];
    variantKey = VARIANT_LABEL[v].variant;
    variantLabel = VARIANT_LABEL[v].label;
  } else {
    return null;
  }

  const phone = clean(body.phone, 10);
  const pin   = clean(body.pincode, 6);
  if (!PHONE_RE.test(phone)) return null;
  if (!PIN_RE.test(pin))     return null;

  const email = clean(body.email, 120).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return null;

  const paymentMethod = body.paymentMethod === 'COD' ? 'COD' : 'UPI';
  const paymentStatus = paymentMethod === 'COD' ? 'PENDING' : 'PENDING';

  return {
    kind: 'order',
    orderId: clean(body.orderId, 40),
    name:    clean(body.name, 80),
    phone,
    email,
    product: 'ODORSTRIKE Fabric Mist',
    variant: variantKey,
    variantLabel,
    units,
    quantity: 1,
    amount,
    shipping: 0,
    total: amount,
    paymentMethod,
    paymentStatus,
    paymentId: '',
    address: clean(body.address, MAX_ADDR_LEN),
    city:    clean(body.city, 80),
    state:   clean(body.state, 80),
    pincode: pin,
    source:  clean(body.source, 40),
    notes:   '',
    mrp: MRP[v] || '',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'origin' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'method' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimitOk(ip, 30, 60_000)) return res.status(429).json({ error: 'rate' });

  if (!process.env.SHEETS_ENDPOINT) {
    console.error('SHEETS_ENDPOINT missing');
    return res.status(500).json({ error: 'not_configured' });
  }

  const order = recompute(req.body || {});
  if (!order) return res.status(400).json({ error: 'invalid' });

  try {
    const fd = new URLSearchParams();
    Object.keys(order).forEach(k => fd.append(k, order[k] != null ? String(order[k]) : ''));
    if (process.env.SHEETS_TOKEN) fd.append('token', process.env.SHEETS_TOKEN);

    const r = await fetch(process.env.SHEETS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fd.toString(),
    });

    if (!r.ok) {
      console.error('Sheets webhook returned', r.status);
      return res.status(502).json({ error: 'upstream' });
    }
    return res.status(200).json({ ok: true, orderId: order.orderId, total: order.total });
  } catch (err) {
    console.error('log-order error:', err);
    return res.status(502).json({ error: 'upstream' });
  }
}
