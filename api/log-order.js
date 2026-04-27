// Smelloff order proxy — sits between the browser and Google Apps Script.
//
// WHY:
//   Before this, the Apps Script URL lived in client JS. Anyone could read
//   it and spam fake orders into the Sheet. This endpoint:
//     - keeps the Apps Script URL out of the public bundle (env var)
//     - rejects requests from origins other than smelloff.in
//     - rate-limits per IP
//     - validates the payload (required fields, sane lengths, amount
//       must match the canonical price for the variant)
//     - forwards a shared secret upstream so the Apps Script can refuse
//       any request that didn't come through this proxy
//
// DEPLOY (one-time setup):
//   1. In the Vercel project settings → Environment Variables, add:
//        SHEETS_ENDPOINT = <your Apps Script /exec URL>
//        SHEETS_SECRET   = <a long random string, e.g. `openssl rand -hex 32`>
//
//   2. In your Google Apps Script `doPost(e)`, gate the function with the
//      same token (paste at the top of the function):
//
//        const REQUIRED_TOKEN = 'PASTE_SAME_VALUE_AS_SHEETS_SECRET_HERE';
//        function doPost(e) {
//          if (!e || !e.parameter || e.parameter.token !== REQUIRED_TOKEN) {
//            return ContentService
//              .createTextOutput(JSON.stringify({ ok:false, error:'forbidden' }))
//              .setMimeType(ContentService.MimeType.JSON);
//          }
//          // ... your existing logic, unchanged
//        }
//
//      Then redeploy the web app (Deploy → Manage deployments → Edit → New
//      version → Deploy). Anyone hitting the Apps Script URL without the
//      token now gets rejected.

const CANONICAL_AMOUNT = { solo: 229, duo: 399, trio: 549 };
const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 8;
const PAYLOAD_MAX_BYTES = 8 * 1024;

// Per-instance in-memory rate limiter. Vercel cold-starts often, so a
// determined attacker spread across many invocations can still slip
// through — but casual scripted abuse is killed at the door.
const rateLimitMap = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || [];
  const fresh = entry.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX) return false;
  fresh.push(now);
  rateLimitMap.set(ip, fresh);
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) {
      if (v[v.length - 1] < now - RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(k);
    }
  }
  return true;
}

const reject = (res, code, error) => res.status(code).json({ ok: false, error });

const asString = (v, max) =>
  typeof v === 'string' ? v.slice(0, max).trim() : '';

function validate(order) {
  const errors = [];

  if (!/^OS\d{6}-[A-Z0-9]{4}$/.test(asString(order.orderId, 32))) errors.push('bad orderId');
  if (!['solo', 'duo', 'trio', 'cart'].includes(order.variant)) errors.push('bad variant');

  const amt = Number(order.amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > 10000) errors.push('bad amount');
  if (CANONICAL_AMOUNT[order.variant] && amt !== CANONICAL_AMOUNT[order.variant]) {
    errors.push('amount does not match variant');
  }

  if (!/^[6-9]\d{9}$/.test(asString(order.phone, 10))) errors.push('bad phone');
  if (!/^\d{6}$/.test(asString(order.pincode, 6))) errors.push('bad pincode');
  if (!asString(order.name, 80))    errors.push('missing name');
  if (!asString(order.address, 400)) errors.push('missing address');
  if (!asString(order.city, 80))    errors.push('missing city');
  if (!asString(order.state, 80))   errors.push('missing state');

  if (!['prepaid', 'cod'].includes(order.paymentMethod)) errors.push('bad paymentMethod');

  if (order.email) {
    const e = asString(order.email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errors.push('bad email');
  }

  return errors;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return reject(res, 405, 'method not allowed');
  if (!ALLOWED_ORIGINS.has(origin)) return reject(res, 403, 'origin not allowed');

  const upstream = process.env.SHEETS_ENDPOINT;
  const secret   = process.env.SHEETS_SECRET;
  if (!upstream || !secret) {
    console.error('log-order: SHEETS_ENDPOINT or SHEETS_SECRET missing');
    return reject(res, 500, 'server not configured');
  }

  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown')
    .toString().split(',')[0].trim();
  if (!rateLimit(ip)) return reject(res, 429, 'too many requests');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return reject(res, 400, 'bad json'); }
  }
  if (!body || typeof body !== 'object') return reject(res, 400, 'missing body');

  if (JSON.stringify(body).length > PAYLOAD_MAX_BYTES) {
    return reject(res, 413, 'payload too large');
  }

  const errors = validate(body);
  if (errors.length) return reject(res, 400, errors.join('; '));

  const params = new URLSearchParams();
  params.append('token', secret);
  Object.keys(body).forEach((k) => {
    const v = body[k];
    params.append(k, v == null ? '' : String(v));
  });

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!upstreamRes.ok) {
      console.error('Apps Script returned', upstreamRes.status);
      return reject(res, 502, 'upstream error');
    }
    return res.status(200).json({ ok: true, orderId: body.orderId });
  } catch (e) {
    console.error('Apps Script fetch failed:', e);
    return reject(res, 502, 'upstream unreachable');
  }
}
