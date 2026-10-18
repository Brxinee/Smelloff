import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_PASSWORD = 'correct horse';
const { issueSession, verifySession, summarize, aggregateCustomers, default: handler } = await import('../api/admin.js');

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

test('admin can run the Google Sheets sync on demand (reports when it is not set up)', async () => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const login = await call({ action: 'login', password: 'correct horse' }, { 'cf-connecting-ip': '1.1.1.9' });
  const cookie = login.headers['set-cookie'].split(';')[0];
  assert.equal((await call({ action: 'syncSheets' })).status, 401, 'needs a session');
  const out = await call({ action: 'syncSheets' }, { cookie, 'cf-connecting-ip': '1.1.1.9' });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { sheets: { status: 'not_configured' } });
});
