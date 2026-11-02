// The owner dashboard redesign (2026-11-02): order stages, honest KPIs
// (test orders left out, period vs the one before), the work queue, bulk
// updates, and the page's own guardrails.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.ADMIN_PASSWORD = 'correct horse';
const api = await import('../api/admin.js');
const { orderStage, paymentState, decorate, buildDashboard, workQueue, periodBounds, salesSeries, istDay, ORDER_STATUSES, default: handler } = api;
const page = fs.readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');

const NOW = Date.parse('2026-11-02T06:30:00Z'); // 12:00 IST
const ago = (days) => new Date(NOW - days * 86400000).toISOString();
const order = (o) => ({ id: crypto.randomUUID(), order_code: 'SMF-20261102-1000', amount: 22900, cod_fee: 0, payment_method: 'upi', status: 'confirmed', created_at: ago(1), customer_phone: '9876543210', address: { name: 'Asha', city: 'Pune', state: 'Maharashtra' }, items: [{ quantity: 1 }], ...o });

test('payment and fulfilment are read apart from the one status column', () => {
  assert.equal(orderStage(order({ status: 'placed', payment_method: 'cod' })), 'confirm', 'COD waits for the confirmation call');
  assert.equal(orderStage(order({ status: 'placed', payment_method: 'upi' })), 'pack', 'paid online skips it');
  assert.equal(orderStage(order({ status: 'packed' })), 'ship');
  assert.equal(orderStage(order({ status: 'out_for_delivery' })), 'transit');
  assert.equal(orderStage(order({ status: 'upi_pending' })), 'unpaid');
  for (const s of ['cancelled', 'failed', 'returned', 'payment_not_verified']) assert.equal(orderStage(order({ status: s })), 'closed');

  assert.equal(paymentState(order({ status: 'dispatched', payment_method: 'cod' })), 'cod_due');
  assert.equal(paymentState(order({ status: 'delivered', payment_method: 'cod' })), 'collected');
  assert.equal(paymentState(order({ status: 'confirmed' })), 'paid');
  assert.equal(paymentState(order({ status: 'upi_pending' })), 'pending');
  assert.equal(paymentState(order({ status: 'cancelled', status_history: [{ status: 'confirmed' }, { status: 'cancelled' }] })), 'refund_due', 'paid, then cancelled');
  assert.equal(paymentState(order({ status: 'cancelled', status_history: [{ status: 'upi_pending' }] })), 'none');

  const v = decorate(order({ status: 'placed', payment_method: 'upi', items: [{ quantity: 2 }] })).view;
  assert.deepEqual([v.next, v.bottles, v.name, v.test], ['packed', 2, 'Asha', false]);
  assert.equal(decorate(order({ status: 'placed', payment_method: 'cod' })).view.next, 'confirmed');
  assert.equal(decorate(order({ address: { name: 'Test order' } })).view.test, true);
});

test('KPIs leave test orders out and compare with the period before', () => {
  const orders = [
    order({ created_at: ago(1), amount: 22900 }),
    order({ created_at: ago(2), amount: 41900, payment_method: 'cod', status: 'dispatched', cod_fee: 8900 }),
    order({ created_at: ago(3), status: 'upi_pending' }),
    order({ created_at: ago(4), status: 'cancelled' }),
    order({ created_at: ago(2), amount: 99900, address: { name: 'test', city: 'Hyderabad' } }),
    order({ created_at: ago(40), amount: 22900 }),
  ];
  const d = buildDashboard(orders, 30, NOW);
  assert.equal(d.current.orders, 2, 'unpaid, cancelled and test orders are not sales');
  assert.equal(d.current.revenue, 22900 + 41900);
  assert.equal(d.current.collected, 22900, 'COD in transit is not money in hand');
  assert.equal(d.current.codShare, 0.5);
  assert.equal(d.previous.orders, 1);
  assert.equal(d.testOrders, 1);
  assert.equal(d.series.reduce((s, b) => s + b.revenue, 0), 22900 + 41900, 'the chart adds up to the KPI');
  assert.ok(d.series.length >= 30 && d.series.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.key)), 'one zero-filled bucket per day');
  assert.equal(d.latest[0].view.stage !== undefined, true, 'latest orders carry their view');
});

test('"Today" starts at midnight IST, and days bucket in IST', () => {
  const p = periodBounds(1, NOW);
  assert.equal(new Date(p.start).toISOString(), '2026-11-01T18:30:00.000Z');
  assert.equal(p.prevEnd, p.start);
  assert.equal(istDay(Date.parse('2026-11-01T19:00:00Z')), '2026-11-02', '00:30 IST is the next day');
  assert.equal(periodBounds(12345, NOW).days, 30, 'unknown periods fall back to 30 days');
  const hours = salesSeries([order({ created_at: '2026-11-02T04:00:00Z' })], p);
  assert.ok(hours.some((h) => h.key === '2026-11-02T09' && h.orders === 1), 'today is hourly');
});

test('the work queue counts what needs doing, never test orders', () => {
  const q = workQueue([
    order({ status: 'placed', payment_method: 'cod' }),
    order({ status: 'confirmed' }),
    order({ status: 'packed' }),
    order({ status: 'dispatched', created_at: ago(12), status_history: [{ status: 'dispatched', at: ago(10) }] }),
    order({ status: 'upi_pending', created_at: ago(2) }),
    order({ status: 'upi_pending', created_at: ago(20) }),
    order({ status: 'placed', payment_method: 'cod', customer_email: 'me@smelloff.in' }),
  ], NOW);
  assert.deepEqual({ ...q }, { confirm: 1, pack: 1, ship: 1, transit: 1, unpaid: 1, stuck: 1, refunds: 0 });
});

test('every status the database allows has a label and a filter', () => {
  const dbStatuses = ['placed', 'upi_pending', 'verification_pending', 'confirmed', 'payment_not_verified', 'failed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
  for (const s of dbStatuses) {
    assert.ok(ORDER_STATUSES.includes(s), `${s} is an allowed status`);
    assert.match(page, new RegExp(`\\b${s}: '`), `${s} has a label in the dashboard`);
  }
});

function call(body, headers = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    const res = { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, status(c) { out.status = c; return this; }, json(d) { out.body = d; resolve(out); return this; } };
    handler({ method: 'POST', headers: { host: 'smelloff.in', ...headers }, body, socket: {} }, res);
  });
}

test('bulk updates need a session and a valid list', async () => {
  assert.equal((await call({ action: 'bulkUpdateOrders', ids: [crypto.randomUUID()], status: 'packed' })).status, 401);
  const login = await call({ action: 'login', password: 'correct horse' }, { 'cf-connecting-ip': '2.2.2.2' });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const bad = async (body) => (await call({ action: 'bulkUpdateOrders', ...body }, { cookie })).status;
  assert.equal(await bad({ ids: [], status: 'packed' }), 400);
  assert.equal(await bad({ ids: ['1 or 1=1'], status: 'packed' }), 400, 'ids must be UUIDs (they go into the URL)');
  assert.equal(await bad({ ids: Array.from({ length: 101 }, () => crypto.randomUUID()), status: 'packed' }), 400);
  assert.equal(await bad({ ids: [crypto.randomUUID()], status: 'shipped_maybe' }), 400);
});

test('the dashboard page: no third-party code, safe output, phone-first', () => {
  assert.doesNotMatch(page, /<script[^>]+src=/i, 'no external scripts (CSP + nothing to compromise)');
  assert.doesNotMatch(page, /<link[^>]+href="https?:/i, 'fonts and styles are self-hosted');
  assert.match(page, /const esc = /, 'one escape helper');
  assert.match(page, /tip\.replaceChildren\(/, 'chart tooltips are built with textContent, not innerHTML');
  assert.match(page, /\/\^\[=\+\\-@\]\/\.test\(s\)/, 'CSV cells that start with = + - @ are neutralised');
  assert.match(page, /class="tabbar"/, 'a bottom tab bar on phones');
  assert.match(page, /\.col\{min-width:0\}/, 'the content column can shrink (no sideways scroll on phones)');
  assert.match(page, /prefers-color-scheme:light/, 'a light theme for daylight');
  assert.match(page, /prefers-reduced-motion/, 'motion respects the setting');
  assert.match(page, /undo:/, 'status changes can be undone');
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /api\('pulse'\)/, 'new orders show up without a reload');
});
