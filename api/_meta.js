// Shared Meta Conversions API helpers.
import crypto from 'node:crypto';

export const PIXEL_ID = process.env.META_PIXEL_ID || '1455100092891684';
export const API_VERSION = process.env.META_API_VERSION || 'v21.0';
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

export function hashEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e && e.includes('@') ? sha256(e) : null;
}
export function hashPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = '91' + d;
  else if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d.length >= 11 ? sha256(d) : null;
}
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
export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? { first: parts[0], last: parts.length > 1 ? parts.at(-1) : '' } : { first: '', last: '' };
}
export function clientIp(req) {
  const pick = v => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  return pick(req.headers['cf-connecting-ip']) || pick(req.headers['true-client-ip']) || pick(req.headers['x-forwarded-for']) || undefined;
}
export function buildUserData(u = {}) {
  const ud = {};
  if (u.ua) ud.client_user_agent = String(u.ua);
  if (u.ip) ud.client_ip_address = String(u.ip);
  const em = hashEmail(u.email); if (em) ud.em = [em];
  const ph = hashPhone(u.phone); if (ph) ud.ph = [ph];
  let fn = u.firstName, ln = u.lastName;
  if ((!fn && !ln) && u.name) ({ first: fn, last: ln } = splitName(u.name));
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
export function fbcFromFbclid(fbclid, ts) {
  const id = String(fbclid || '').trim();
  return id ? `fb.1.${ts || Date.now()}.${id}` : '';
}
export function dataProcessingOptions() {
  if (!process.env.META_DPO) return null;
  return {
    data_processing_options: ['LDU'],
    data_processing_options_country: Number(process.env.META_DPO_COUNTRY || 0),
    data_processing_options_state: Number(process.env.META_DPO_STATE || 0),
  };
}

export async function sendEvent(event) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { ok: false, status: 0, body: 'inert:no-token', skipped: true };
  const payloadEvent = { ...event };
  const dpo = dataProcessingOptions();
  if (dpo) Object.assign(payloadEvent, dpo);
  const payload = { data: [payloadEvent] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
  let last = { ok: false, status: 0, body: 'unknown failure' };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(7000),
      });
      const body = await r.text().catch(() => '');
      last = { ok: r.ok, status: r.status, body: body.slice(0, 2000) };
      if (r.ok || (r.status !== 429 && r.status < 500) || attempt === 1) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (e) {
      last = { ok: false, status: 0, body: String(e?.message || e).slice(0, 300) };
      if (attempt === 1) break;
    }
  }
  if (!last.ok) console.error('meta-capi send', last.status, last.body);
  return last;
}

function supaHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}
export async function logInsertIfNew(row) {
  if (!SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?on_conflict=event_id,event_name`, {
      method: 'POST', headers: supaHeaders({ Prefer: 'resolution=ignore-duplicates,return=representation' }), body: JSON.stringify(row), signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
export async function logUpdate(id, patch) {
  if (!SERVICE_KEY || !id) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: supaHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch), signal: AbortSignal.timeout(5000)
    });
  } catch {}
}
export async function claimPending(id) {
  if (!SERVICE_KEY || !id) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
      method: 'PATCH', headers: supaHeaders({ Prefer: 'return=representation' }), body: JSON.stringify({ status: 'sending' }), signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length === 1;
  } catch { return false; }
}
export async function fetchPending(limit = 25) {
  if (!SERVICE_KEY) return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_capi_log?status=eq.pending&order=created_at.asc&limit=${Math.max(1, Math.min(100, limit))}`, { headers: supaHeaders(), signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
export async function getOrder(orderId) {
  if (!SERVICE_KEY || !orderId) return null;
  try {
    const cols = 'id,order_code,customer_email,customer_phone,items,amount,payment_method,address,fbp,fbc,client_ip,client_ua,event_source_url';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=${cols}`, { headers: supaHeaders(), signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
export const SKU = 'OS-001-50ML';
export const SKU_NAME = 'ODORSTRIKE Fabric Odor Mist';
export function contentsFromItems(items, valueRupees) {
  const qty = Array.isArray(items) ? items.reduce((n, it) => n + (Number(it?.quantity) || 0), 0) || 1 : 1;
  const value = Number(valueRupees) || 0;
  return { content_ids: [SKU], content_type: 'product', contents: [{ id: SKU, quantity: qty, item_price: qty ? value / qty : value }], num_items: qty };
}
