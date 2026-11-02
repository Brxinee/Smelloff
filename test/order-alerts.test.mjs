// Order alerts (2026-11-02, owner: "make it an app … if I get a new order it
// should notify me and ring"): Web Push from the Worker to the owner's phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const push = await import('../api/_push.js');
const alerts = await import('../api/_order-alerts.js');
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Decrypt the way a browser does (RFC 8291 receiver side), with WebCrypto.
async function browserDecrypt(body, uaKeys, authSecret) {
  const s = crypto.webcrypto.subtle;
  const salt = body.slice(0, 16), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const asKey = await s.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await s.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256));
  const uaPublic = new Uint8Array(await s.exportKey('raw', uaKeys.publicKey));
  const h = async (salt, ikm, info, n) => new Uint8Array(await s.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await s.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const te = new TextEncoder();
  const ikm = await h(authSecret, shared, new Uint8Array([...te.encode('WebPush: info\0'), ...uaPublic, ...asPublic]), 32);
  const cek = await h(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await h(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv: nonce }, await s.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function fakeBrowser() {
  const keys = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.randomBytes(16);
  const p256dh = Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', keys.publicKey)).toString('base64url');
  return { keys, auth, sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1', keys: { p256dh, auth: auth.toString('base64url') } } };
}

test('a push decrypts on the phone and carries a VAPID signature the push service can check', async () => {
  const b = await fakeBrowser();
  const body = await push.encryptPayload(b.sub, '{"title":"New order · ₹318 COD"}');
  assert.equal(await browserDecrypt(body, b.keys, b.auth), '{"title":"New order · ₹318 COD"}');
  const keys = await push.generateVapidKeys();
  const [, jwt, k] = (await push.vapidAuthorization(b.sub.endpoint, keys)).match(/^vapid t=([^,]+), k=(.+)$/);
  const [h, c, sig] = jwt.split('.');
  const pub = await crypto.webcrypto.subtle.importKey('raw', Buffer.from(k, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(sig, 'base64url'), Buffer.from(`${h}.${c}`)));
  assert.equal(JSON.parse(Buffer.from(c, 'base64url')).aud, 'https://fcm.googleapis.com');
});

test('the alert names the order without a COD amount guess', () => {
  const a = alerts.orderAlert({ order_code: 'SMF-20261102-1234', amount: 31800, payment_method: 'cod', items: [{ quantity: 2 }], address: { name: 'Asha', city: 'Pune' } });
  assert.equal(a.title, 'New order · ₹318 COD');
  assert.equal(a.body, 'Asha · Pune · 2 bottles · SMF-20261102-1234');
  assert.equal(a.url, '/admin#orders/SMF-20261102-1234');
  assert.equal(a.tag, 'SMF-20261102-1234', 'Android replaces, never duplicates, one order\'s notification');
  assert.match(alerts.orderAlert({ order_code: 'X', amount: 22900, address: { name: 'Test order', line: '[TEST · do not ship]' } }).title, /^Test order · ₹229 paid$/);
});

test('one order rings once, gone devices are removed, and nothing breaks without devices', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const b = await fakeBrowser();
  const vapid = await push.generateVapidKeys();
  const claims = new Set(); const calls = []; let devices = [{ id: 'd1', endpoint: b.sub.endpoint, p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth, failures: 0 }, { id: 'd2', endpoint: 'https://fcm.googleapis.com/fcm/send/old', p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth, failures: 0 }];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); calls.push(`${init.method || 'GET'} ${u}`);
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status });
    if (u.startsWith('https://fcm.googleapis.com/')) {
      assert.match(init.headers.Authorization, /^vapid t=/); assert.equal(init.headers['Content-Encoding'], 'aes128gcm'); assert.equal(init.headers.Urgency, 'high');
      return new Response('', { status: u.endsWith('/old') ? 410 : 201 });
    }
    if (u.includes('admin_push_subscriptions') && (init.method || 'GET') === 'GET') return json(devices);
    if (u.includes('admin_push_subscriptions') && init.method === 'DELETE') { devices = devices.filter((d) => !u.includes(d.id)); return json([]); }
    if (u.includes('admin_push_subscriptions')) return json([]);
    if (u.includes('admin_settings?key=eq.vapid')) return json([{ value: vapid }]);
    if (u.endsWith('/admin_settings') && init.method === 'POST') { const k = JSON.parse(init.body).key; if (claims.has(k)) return json([]); claims.add(k); return json([{ key: k }]); }
    return json([]);
  };
  try {
    const order = { order_code: 'SMF-20261102-1234', amount: 22900, payment_method: 'upi', address: { name: 'Asha' } };
    const first = await alerts.alertNewOrder(order);
    assert.deepEqual({ sent: first.sent, removed: first.removed }, { sent: 1, removed: 1 });
    assert.equal(devices.length, 1, 'the unsubscribed phone (410) is deleted');
    const again = await alerts.alertNewOrder(order);
    assert.equal(again.reason, 'already alerted', 'webhook + verify-payment confirming the same order ring once');
    devices = [];
    assert.equal((await alerts.alertNewOrder({ ...order, order_code: 'SMF-20261102-9999' })).reason, 'no devices');
  } finally { globalThis.fetch = real; }
});

test('every new-order path rings: it rides on the owner\'s new-order email', () => {
  const src = read('api/_email-dispatch.js');
  assert.match(src, /export async function sendAdminNewOrderEmail[\s\S]{0,300}alertNewOrder\(order\)/);
  assert.match(read('api/create-order.js'), /sendAdminNewOrderEmail\(localOrder/, 'COD');
  assert.match(src, /dispatchPrepaidPaymentEmails[\s\S]{0,400}sendAdminNewOrderEmail/, 'prepaid confirmation');
});

test('the dashboard is an installable app that rings', () => {
  const page = read('admin/index.html');
  const manifest = JSON.parse(read('admin/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/admin');
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of manifest.icons) assert.ok(fs.existsSync(new URL(`..${i.src}`, import.meta.url)), i.src);
  assert.match(page, /<link rel="manifest" href="\/admin\/manifest\.webmanifest">/);
  assert.match(page, /serviceWorker\.register\('\/admin-sw\.js', \{ scope: '\/admin' \}\)/, 'its own worker, scoped to /admin (the shop\'s sw.js is untouched)');
  const sw = read('admin-sw.js');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /requireInteraction: true/);
  assert.match(sw, /vibrate: \[/);
  assert.doesNotMatch(sw, /caches\./, 'the admin worker never caches dashboard data');
  assert.match(read('scripts/prepare-public.mjs'), /'admin-sw\.js'/);
  assert.match(page, /function ringAlert/);
  assert.match(page, /stopRing\(\)/);
  assert.match(page, /ring\.seen/, 'push + pulse never ring twice for one order');
});

test('alert tables are service-role only', () => {
  const sql = read('supabase/migrations/20261102_admin_push.sql');
  assert.match(sql, /admin_push_subscriptions[\s\S]*enable row level security[\s\S]*revoke all on public\.admin_push_subscriptions from anon, authenticated/);
  assert.match(sql, /admin_settings[\s\S]*enable row level security[\s\S]*revoke all on public\.admin_settings from anon, authenticated/);
});
