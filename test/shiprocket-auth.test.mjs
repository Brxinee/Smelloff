import test from 'node:test';
import assert from 'node:assert/strict';

// 2026-11-02: the API user was locked ("User blocked due to too many failed
// login attempts") and every 15-minute run and every new order logged in
// again with the same rejected password, which keeps the lock in place. The
// token and a pause after a rejected login are now kept in admin_settings.

function harness({ loginStatus = 200, loginBody = { token: 'tok-1' }, relayStatus = 502, relayBody = { error: 'User blocked due to too many failed login attempts.' } } = {}) {
  const store = new Map();
  const calls = { login: 0, api: 0, relay: 0, relayReq: null };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const state = { loginStatus, loginBody, relayStatus, relayBody };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    if (u.includes('/rest/v1/admin_settings')) {
      const key = decodeURIComponent((u.match(/key=eq\.([^&]+)/) || [])[1] || '');
      if (method === 'GET') return json(store.has(key) ? [{ value: store.get(key) }] : []);
      if (method === 'POST') { const b = JSON.parse(opts.body); store.set(b.key, b.value); return new Response('', { status: 201 }); }
      if (method === 'DELETE') { store.delete(key); return new Response('', { status: 204 }); }
    }
    if (u.endsWith('/functions/v1/shiprocket-login')) {
      calls.relay += 1;
      calls.relayReq = { headers: opts.headers, body: JSON.parse(opts.body) };
      return json(state.relayBody, state.relayStatus);
    }
    if (u.endsWith('/auth/login')) { calls.login += 1; return json(state.loginBody, state.loginStatus); }
    if (u.includes('apiv2.shiprocket.in')) { calls.api += 1; return json({ data: [] }); }
    throw new Error('unexpected fetch ' + u);
  };
  return { store, calls, state };
}

async function freshModule(tag) {
  process.env.SHIPROCKET_EMAIL = 'api@example.com';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  return import(`../api/_shiprocket.js?${tag}`);
}

test('a rejected login pauses further logins with the same password', async () => {
  const realFetch = globalThis.fetch;
  try {
    process.env.SHIPROCKET_PASSWORD = 'wrong';
    const h = harness({ loginStatus: 403, loginBody: { message: 'User blocked due to too many failed login attempts.' } });
    const sr = await freshModule('pause');
    await assert.rejects(sr.shiprocketRequest('/settings/company/pickup'), /authentication failed: User blocked/i);
    assert.equal(h.calls.login, 1);
    assert.ok(h.store.get('shiprocket-auth-pause'), 'pause is stored');
    // Shorter than an hour, so the hourly cron run after it actually retries.
    const left = Date.parse(h.store.get('shiprocket-auth-pause').until) - Date.now();
    assert.ok(left > 50 * 60 * 1000 && left <= 55 * 60 * 1000, `pause is ~55 min, got ${Math.round(left / 60000)} min`);

    // Next run / next order: no second attempt with the same password, and the
    // error still reads "authentication failed" so the sync loop stops.
    await assert.rejects(sr.shiprocketRequest('/settings/company/pickup'), /authentication failed.*paused until/i);
    assert.equal(h.calls.login, 1, 'paused: Shiprocket is not contacted');

    // The owner saves a new password in Cloudflare: login is tried at once.
    process.env.SHIPROCKET_PASSWORD = 'right';
    h.state.loginStatus = 200;
    h.state.loginBody = { token: 'tok-new' };
    await sr.shiprocketRequest('/settings/company/pickup');
    assert.equal(h.calls.login, 2);
    assert.equal(h.store.has('shiprocket-auth-pause'), false, 'a good login clears the pause');
    assert.equal(h.store.get('shiprocket-token')?.token, 'tok-new');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a saved token is reused by a fresh Worker instance without logging in', async () => {
  const realFetch = globalThis.fetch;
  try {
    process.env.SHIPROCKET_PASSWORD = 'right';
    const h = harness();
    const first = await freshModule('token-a');
    await first.shiprocketRequest('/orders/show/1');
    assert.equal(h.calls.login, 1);
    const second = await freshModule('token-b'); // new isolate: empty memory cache
    await second.shiprocketRequest('/orders/show/1');
    assert.equal(h.calls.login, 1, 'token came from admin_settings');
    assert.equal(h.calls.api, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a Shiprocket outage (5xx) does not pause logins', async () => {
  const realFetch = globalThis.fetch;
  try {
    process.env.SHIPROCKET_PASSWORD = 'right';
    const h = harness({ loginStatus: 502, loginBody: { message: 'Bad gateway' } });
    const sr = await freshModule('outage');
    await assert.rejects(sr.shiprocketRequest('/orders/show/1'), /authentication failed/i);
    assert.equal(h.store.has('shiprocket-auth-pause'), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Shiprocket blocks the shared Cloudflare egress address: a brand-new API user
// was "blocked" on its first login from the Worker and logged in fine from
// another network. The Worker then asks the Supabase relay to log in.
test('a "blocked" login is retried once through the Supabase relay and its token is kept', async () => {
  const realFetch = globalThis.fetch;
  try {
    process.env.SHIPROCKET_PASSWORD = 'right';
    const h = harness({
      loginStatus: 403, loginBody: { message: 'User blocked due to too many failed login attempts.' },
      relayStatus: 200, relayBody: { token: 'tok-relay' },
    });
    const sr = await freshModule('relay-ok');
    await sr.shiprocketRequest('/orders/show/1');
    assert.equal(h.calls.login, 1, 'direct login tried first');
    assert.equal(h.calls.relay, 1, 'relay tried once');
    assert.equal(h.calls.relayReq.headers['x-service-key'], 'svc', 'relay is called with the service key');
    assert.deepEqual(h.calls.relayReq.body, { email: 'api@example.com', password: 'right' });
    assert.equal(h.store.get('shiprocket-token')?.token, 'tok-relay');
    assert.equal(h.store.has('shiprocket-auth-pause'), false, 'no pause after the relay got in');
    assert.equal(h.calls.api, 1, 'the API call went ahead with the relayed token');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a failed relay still pauses, and a wrong password never goes to the relay', async () => {
  const realFetch = globalThis.fetch;
  try {
    process.env.SHIPROCKET_PASSWORD = 'right';
    const h = harness({ loginStatus: 403, loginBody: { message: 'User blocked due to too many failed login attempts.' } });
    const sr = await freshModule('relay-fail');
    await assert.rejects(sr.shiprocketRequest('/orders/show/1'), /authentication failed: User blocked.*relay:/i);
    assert.equal(h.calls.relay, 1);
    assert.ok(h.store.get('shiprocket-auth-pause'), 'pause stored');

    process.env.SHIPROCKET_PASSWORD = 'typo';
    const h2 = harness({ loginStatus: 400, loginBody: { message: 'Invalid email and password combination' } });
    const sr2 = await freshModule('relay-skip');
    await assert.rejects(sr2.shiprocketRequest('/orders/show/1'), /Invalid email and password/);
    assert.equal(h2.calls.relay, 0, 'a plain wrong password is not relayed');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the relay edge function only calls Shiprocket login and checks the service key', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../supabase/functions/shiprocket-login/index.ts', import.meta.url), 'utf8');
  const urls = [...src.matchAll(/https:\/\/[^"'`\s]+/g)].map((m) => m[0]);
  assert.deepEqual(urls, ['https://apiv2.shiprocket.in/v1/external/auth/login'], 'one fixed outbound URL');
  assert.match(src, /callerIsServiceRole/);
  assert.match(src, /x-service-key/);
  assert.doesNotMatch(src, /console\.(log|info)\(/, 'logs nothing');
});
