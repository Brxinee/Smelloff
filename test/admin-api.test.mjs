import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_PASSWORD = 'correct horse';
const { issueSession, verifySession, summarize, aggregateCustomers, newInviteCode, default: handler } = await import('../api/admin.js');

function call(body, headers = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    const res = {
      setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
      status(code) { out.status = code; return this; },
      json(data) { out.body = data; resolve(out); return this; },
    };
    handler({ method: 'POST', headers: { host: 'smelloff.in', ...headers }, body, socket: {} }, res);
  });
}

test('sessions are signed and expire', () => {
  const now = Date.now();
  const token = issueSession(now);
  assert.equal(verifySession(token, now + 1000), true);
  assert.equal(verifySession(token, now + 13 * 3600 * 1000), false, 'expires after 12h');
  assert.equal(verifySession(token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), now), false, 'tampered MAC rejected');
  assert.equal(verifySession('', now), false);
});

test('login sets an HttpOnly cookie only for the right password', async () => {
  const bad = await call({ action: 'login', password: 'nope' }, { 'cf-connecting-ip': '1.1.1.1' });
  assert.equal(bad.status, 401);
  const good = await call({ action: 'login', password: 'correct horse' }, { 'cf-connecting-ip': '1.1.1.2' });
  assert.equal(good.status, 200);
  assert.match(good.headers['set-cookie'], /^sf_admin=.+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
  const cookie = good.headers['set-cookie'].split(';')[0];
  assert.equal((await call({ action: 'me' }, { cookie })).status, 200);
  assert.equal((await call({ action: 'overview' })).status, 401, 'data needs a session');
  assert.equal((await call({ action: 'me' }, { cookie, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call({ action: 'me' }, { cookie, origin: 'https://smelloff.in' })).status, 200);
});

test('stats count only collected money and group customers by phone', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const orders = [
    { id: '1', created_at: '2026-10-10T10:00:00Z', status: 'placed', amount: 28900, customer_phone: '+91 98765 43210', address: { name: 'Asha', city: 'Pune' } },
    { id: '2', created_at: '2026-10-01T10:00:00Z', status: 'delivered', amount: 22900, customer_phone: '9876543210' },
    { id: '3', created_at: '2026-10-09T10:00:00Z', status: 'cancelled', amount: 22900, customer_phone: '9000000000' },
    { id: '4', created_at: '2026-10-09T11:00:00Z', status: 'upi_pending', amount: 22900, customer_phone: '9111111111' },
  ];
  const s = summarize(orders, now);
  assert.equal(s.today.orders, 1);
  assert.equal(s.month.revenue, 28900 + 22900, 'cancelled and unpaid UPI are not revenue');
  assert.equal(s.needsAction, 2);
  const customers = aggregateCustomers(orders);
  assert.equal(customers.length, 3, '+91 98765 43210 and 9876543210 are one person');
  const asha = customers.find((c) => c.name === 'Asha');
  assert.deepEqual([asha.orders, asha.spent, asha.city], [2, 51800, 'Pune']);
});

test('review invite codes are 8 unambiguous characters', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    const code = newInviteCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    seen.add(code);
  }
  assert.equal(seen.size, 500);
});

test('creating a review invite needs a session and stores only code + note', async () => {
  assert.equal((await call({ action: 'createReviewInvite', note: 'x' })).status, 401);
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify([{ id: 'i1', ...sent.body, used_at: null }]), { status: 201 });
  };
  try {
    const cookie = `sf_admin=${encodeURIComponent(issueSession())}`;
    const out = await call({ action: 'createReviewInvite', note: '  Ravi, college\n' }, { cookie });
    assert.equal(out.status, 200);
    assert.match(sent.url, /\/rest\/v1\/review_invites\?/);
    assert.deepEqual(Object.keys(sent.body).sort(), ['code', 'note']);
    assert.equal(sent.body.note, 'Ravi, college');
    assert.equal(out.body.invite.code, sent.body.code);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
