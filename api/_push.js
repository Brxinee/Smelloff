/*
 * Web Push for the owner's order alerts (/admin installed as an app).
 *
 * Standards only, no library: VAPID (RFC 8292) signs who is sending, and the
 * message is encrypted for each device (RFC 8291, aes128gcm / RFC 8188). Both
 * use WebCrypto, which Cloudflare Workers and Node share.
 *
 * The VAPID key pair is made on first use and kept in `admin_settings`
 * (service role only), so there is no secret to set up. Device subscriptions
 * live in `admin_push_subscriptions`; a push service answering 404/410 means
 * the device unsubscribed, and its row is deleted.
 */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const b64u = {
  encode: (bytes) => Buffer.from(bytes).toString('base64url'),
  decode: (text) => new Uint8Array(Buffer.from(String(text), 'base64url')),
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/* ── VAPID keys ─────────────────────────────────────────────────────────── */

export async function generateVapidKeys() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64u.encode(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
  return { publicKey, privateJwk: { kty: 'EC', crv: 'P-256', x: privateJwk.x, y: privateJwk.y, d: privateJwk.d } };
}

// "vapid t=<JWT>, k=<public key>" for one push service origin.
export async function vapidAuthorization(endpoint, keys, { subject = 'mailto:info@smelloff.in', now = Date.now() } = {}) {
  const header = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.encode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: subject,
  })));
  const key = await subtle.importKey('jwk', { ...keys.privateJwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64u.encode(sig)}, k=${keys.publicKey}`;
}

/* ── RFC 8291 message encryption ────────────────────────────────────────── */

export async function encryptPayload(subscription, payload, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = b64u.decode(subscription.keys.p256dh);
  const authSecret = b64u.decode(subscription.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('Bad subscription keys');

  const as = serverKeys || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle.exportKey('raw', as.publicKey));
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const body = typeof payload === 'string' ? enc.encode(payload) : payload;
  const plain = concat(body, new Uint8Array([2])); // one record: delimiter 0x02, no padding
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/* ── sending ────────────────────────────────────────────────────────────── */

// One push. Resolves { ok, status, gone } — gone = the device unsubscribed.
export async function sendPush(subscription, payload, keys, { ttl = 86400, urgency = 'high', fetchImpl = fetch } = {}) {
  const body = await encryptPayload(subscription, JSON.stringify(payload));
  const res = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
      Topic: String(payload.tag || 'order').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'order',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
