// /api/_meta — shared Meta Conversions API helpers.
//
// Underscore-prefixed so Vercel never routes it; it is imported by
// api/meta-capi.js (browser-facing: Lead + funnel mirror) and
// api/meta-capi-drain.js (server-truth: Purchase / Refund from the outbox).
//
// Everything here is designed to be INERT and FAIL-SILENT: if META_CAPI_TOKEN
// is unset, senders no-op; any thrown error is swallowed by the callers so a
// tracking failure can never affect checkout or the order pipeline.
//
// Env (all optional at deploy; senders stay inert until the token is set):
//   META_CAPI_TOKEN            — Meta system-user token with ads_management.
//   META_PIXEL_ID              — default 1455100092891684.
//   META_API_VERSION           — default v21.0.
//   META_TEST_EVENT_CODE       — set only while validating in Test Events.
//   META_DPO / META_DPO_STATE / META_DPO_COUNTRY — optional Limited Data Use
//                                (data_processing_options). Empty = LDU off.
//   SUPABASE_URL               — default the project URL below.
//   SUPABASE_SERVICE_ROLE_KEY  — required for idempotency + logging + drain.

import crypto from 'node:crypto';

export const PIXEL_ID = process.env.META_PIXEL_ID || '1455100092891684';
export const API_VERSION = process.env.META_API_VERSION || 'v21.0';
export const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- PII normalisation (Meta Advanced Matching spec: normalise, then hash) ----

export function hashEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e && e.includes('@') ? sha256(e) : null;
}

// Indian mobiles → E.164 without '+' (919876543210), then hash. Bare 10-digit
// numbers default to +91; a leading 0 on an 11-digit number is dropped.
export function hashPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = '91' + d;
  else if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d.length >= 11 ? sha256(d) : null;
}

// Names/city/state: lowercase, trim, strip whitespace + punctuation before hash.
export function hashName(v) {
  const s = String(v || '').trim().toLowerCase().replace(/[^a-zÀ-ɏ]+/gi, '');
  return s ? sha256(s) : null;
}
export function hashText(v) {
  const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
  return s ? sha256(s) : null;
}
export function hashZip(v) {
  const s = String(v || '').replace(/\D/g, '').slice(0, 6);
  return s ? sha256(s) : null;
}

// Split a full name into first/last for fn/ln matching.
export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  return { first: parts[0], last: parts.length > 1 ? parts[parts.length - 1] : '' };
}

// Real client IP behind Cloudflare (a POP IP degrades match quality + geo).
export function clientIp(req) {
  const pick = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  return pick(req.headers['cf-connecting-ip'])
    || pick(req.headers['true-client-ip'])
    || pick(req.headers['x-forwarded-for'])
    || undefined;
}

// Build a Meta `user_data` object from whatever identifiers we have. Every PII
// field is hashed here; raw values are never placed in the payload.
export function buildUserData(u = {}) {
  const ud = {};
  if (u.ua) ud.client_user_agent = String(u.ua);
  if (u.ip) ud.client_ip_address = String(u.ip);
  const em = hashEmail(u.email); if (em) ud.em = [em];
  const ph = hashPhone(u.phone); if (ph) ud.ph = [ph];
  let fn = u.firstName, ln = u.lastName;
  if ((!fn && !ln) && u.name) { const s = splitName(u.name); fn = s.first; ln = s.last; }
  const hfn = hashName(fn); if (hfn) ud.fn = [hfn];
  const hln = hashName(ln); if (hln) ud.ln = [hln];
  const ct = hashText(u.city); if (ct) ud.ct = [ct];
  const st = hashText(u.state); if (st) ud.st = [st];
  const zp = hashZip(u.zip); if (zp) ud.zp = [zp];
  const country = hashText(u.country || (u.zip || u.city ? 'in' : '')); if (country) ud.country = [country];
  if (u.fbp) ud.fbp = String(u.fbp);
  if (u.fbc) ud.fbc = String(u.fbc);
  return ud;
}

// Reconstruct an `fbc` from an `fbclid` when the Pixel never set the cookie
// (e.g. consent was delayed). Format: fb.1.<unix-ms>.<fbclid>.
export function fbcFromFbclid(fbclid, ts) {
  const id = String(fbclid || '').trim();
  return id ? `fb.1.${ts || Date.now()}.${id}` : '';
}

// Optional Limited Data Use (data_processing_options). Off unless META_DPO set.
export function dataProcessingOptions() {
  if (!process.env.META_DPO) return null;
  return {
    data_processing_options: ['LDU'],
    data_processing_options_country: Number(process.env.META_DPO_COUNTRY || 0),
    data_processing_options_state: Number(process.env.META_DPO_STATE || 0),
  };
}

// POST one event to the Graph API. Returns {ok, status, body}. Never throws.
export async function sendEvent(event) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { ok: false, status: 0, body: 'inert:no-token', skipped: true };

  const dpo = dataProcessingOptions();
  if (dpo) Object.assign(event, dpo);

  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.text().catch(() => '');
    if (!r.ok) console.error('meta-capi send', r.status, body.slice(0, 300));
    return { ok: r.ok, status: r.status, body: body.slice(0, 2000) };
  } catch (e) {
    console.error('meta-capi send error', e && e.message);
    return { ok: false, status: 0, body: String(e && e.message).slice(0, 300) };
  }
}

// ---- Supabase REST (service role) — logging + outbox drain --------------------

function supaHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Insert a log row, ignoring the (event_id,event_name) unique conflict. Returns
// the created row, or null when the event was already logged (→ idempotent skip)
// or when logging is not configured. Never throws.
export async function logInsertIfNew(row) {
  if (!SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?on_conflict=event_id,event_name`, {
      method: 'POST',
      headers: supaHeaders({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify(row),
    });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null; // [] == conflict ignored
  } catch { return null; }
}

export async function logUpdate(id, patch) {
  if (!SERVICE_KEY || !id) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?id=eq.${id}`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    });
  } catch { /* logging is best-effort */ }
}

// Atomically claim a pending row (pending → sending) so overlapping drain runs
// never send it twice. Returns true if this caller won the claim.
export async function claimPending(id) {
  if (!SERVICE_KEY || !id) return false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/meta_capi_log?id=eq.${id}&status=eq.pending`,
      {
        method: 'PATCH',
        headers: supaHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ status: 'sending' }),
      });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length === 1;
  } catch { return false; }
}

export async function fetchPending(limit = 25) {
  if (!SERVICE_KEY) return [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/meta_capi_log?status=eq.pending&order=created_at.asc&limit=${limit}`,
      { headers: supaHeaders() });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

export async function getOrder(orderId) {
  if (!SERVICE_KEY || !orderId) return null;
  try {
    const cols = 'id,order_code,customer_email,customer_phone,items,amount,payment_method,address,fbp,fbc,client_ip,client_ua,event_source_url';
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=${cols}`,
      { headers: supaHeaders() });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

export const SKU = 'OS-001-50ML';
export const SKU_NAME = 'ODORSTRIKE Fabric Odor Mist';

// Build content_ids / contents / num_items from stored order items.
export function contentsFromItems(items, valueRupees) {
  const qty = Array.isArray(items)
    ? items.reduce((n, it) => n + (Number(it && it.quantity) || 0), 0) || 1
    : 1;
  const v = Number(valueRupees) || 0;
  return {
    content_ids: [SKU],
    content_type: 'product',
    contents: [{ id: SKU, quantity: qty, item_price: qty ? v / qty : v }],
    num_items: qty,
  };
}
