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

/* ── Add / edit / delete / test (2026-11-02, second pass) ── */
const { orderFromForm, newOrderCode, TEST_MARK, PRODUCT } = api;
const form = (o = {}) => ({ name: 'Ravi Teja', phone: '+91 98480 22338', email: 'ravi@example.com', line: '4-1, Road 2', city: 'Pune', state: 'Maharashtra', pincode: '411001', bottles: 2, payment: 'cod', ...o });

test('manual orders are priced exactly like checkout', () => {
  const cod = orderFromForm(form());
  assert.equal(cod.amount, (419 + 119) * 100, '2 for ₹419 + South & West COD charges');
  assert.equal(cod.cod_fee, 119 * 100);
  assert.equal(cod.customer_phone, '9848022338');
  assert.deepEqual(cod.items, [{ name: PRODUCT.name, variant: PRODUCT.size, quantity: 2, price: PRODUCT.unit }], 'items[].price stays the unit price');
  const prepaid = orderFromForm(form({ payment: 'upi', bottles: 5 }));
  assert.deepEqual([prepaid.amount, prepaid.cod_fee, prepaid.payment_method], [89900, 0, 'upi'], '5 for ₹899, free shipping');
  const discounted = orderFromForm(form({ customTotal: 400 }));
  assert.equal(discounted.amount, 40000, 'an agreed total replaces the price list');
  assert.ok(discounted.cod_fee <= discounted.amount);
  assert.match(newOrderCode(), /^SMF-\d{8}-\d{4}$/, 'matches the orders_order_code_check constraint');
});

test('the order form says what is wrong', () => {
  const bad = (o, re) => assert.throws(() => orderFromForm(form(o)), re);
  bad({ name: ' ' }, /name/);
  bad({ phone: '12345' }, /mobile/);
  bad({ phone: '5848022338' }, /mobile/, 'Indian mobiles start 6–9');
  bad({ email: 'nope' }, /email/);
  bad({ pincode: '0110' }, /pincode/);
  bad({ bottles: 0 }, /Bottles/);
  bad({ bottles: 11 }, /Bottles/);
  bad({ customTotal: -5 }, /Custom total/);
  assert.equal(orderFromForm(form({ email: '' })).customer_email, null, 'email is optional');
});

test('editing keeps what was not changed', () => {
  const existing = order({ customer_phone: '9876543210', customer_email: 'a@b.in', address: { name: 'Asha', line: '12 MG Rd', city: 'Pune', state: 'MH', pincode: '411001', customer_note: 'gate 2' }, items: [{ quantity: 2 }] });
  const f = orderFromForm({ line: '14 MG Rd' }, existing);
  assert.equal(f.address.line, '14 MG Rd');
  assert.equal(f.address.customer_note, 'gate 2');
  assert.equal(f.customer_phone, '9876543210');
  assert.equal(f.items[0].quantity, 2);
  const t = orderFromForm({}, order({ address: { name: 'Asha', line: `12 MG Rd ${TEST_MARK}`, city: 'Pune', state: 'MH', pincode: '411001' } }));
  assert.match(t.address.line, /do not ship/, 'a test order stays a test order');
});

test('test orders are marked so nothing ships or counts', async () => {
  const t = orderFromForm(form({ test: true }));
  assert.ok(t.address.line.endsWith(TEST_MARK));
  assert.equal(decorate(order(t)).view.test, true, 'left out of KPIs');
  const src = fs.readFileSync(new URL('../api/shiprocket-sync.js', import.meta.url), 'utf8');
  assert.match(src, /if \(isMarkedTest\(order\)\) return \{ status: 'skipped', reason: 'test_order' \}/, 'Shiprocket never books a test order');
  const { isMarkedTest } = await import('../api/sheets-sync.js');
  assert.equal(isMarkedTest(order(t)), true);
  assert.equal(isMarkedTest(order({ customer_email: 'me@smelloff.in' })), false, 'an internal (owner) order still ships');
});

test('deleting needs the order number and never removes a real sale', async () => {
  const login = await call({ action: 'login', password: 'correct horse' }, { 'cf-connecting-ip': '3.3.3.3' });
  const cookie = login.headers['set-cookie'].split(';')[0];
  assert.equal((await call({ action: 'deleteOrder', id: 'x' }, { cookie })).status, 400);
  const src = fs.readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
  assert.match(src, /isTestOrInternal\(o\) \|\| \['cancelled', 'failed', 'payment_not_verified', 'upi_pending'\]\.includes\(o\.status\)/);
  assert.match(src, /Type the order number to confirm/);
  assert.match(page, /Real sales can't be deleted/);
  assert.doesNotMatch(src, /action === 'createReview'|async createReview|async editReview/, 'reviews are never written or edited by the shop');
  assert.match(page, /never a review because it's negative/);
});

test('the dashboard has the tools a store needs', () => {
  for (const a of ['createOrder', 'editOrder', 'deleteOrder', 'notifyCustomer', 'quote', 'deleteMessage', 'deleteReview', 'subscribers', 'addSubscriber', 'deleteSubscriber', 'comments', 'updateComment', 'deleteComment', 'systemCheck', 'sendTestEmail', 'emailPreview']) {
    assert.match(page, new RegExp(`api\\('${a}'`), `${a} is wired into the page`);
  }
  assert.match(page, /sandbox=""/, 'email previews render with scripts off');
  assert.doesNotMatch(fs.readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8'), /apiv2\.shiprocket\.in\/v1\/external\/auth\/login/, 'the system check never logs in to Shiprocket');
});

test('the system check reads real Shiprocket and email activity, never a login', async () => {
  const saved = { ...process.env }; const realFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: 're_send_only', SHIPROCKET_EMAIL: 'api@x.in', SHIPROCKET_PASSWORD: 'p' });
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; delete process.env.RAZORPAY_KEY_ID;
  const hits = [];
  globalThis.fetch = async (url) => {
    const u = String(url); hits.push(u);
    const json = (b) => new Response(JSON.stringify(b), { status: 200 });
    if (u.includes('email_events') && u.includes('FAILED')) return json([]);
    if (u.includes('email_events')) return json([{ created_at: new Date().toISOString(), email_type: 'orderShipped', status: 'DELIVERED' }]);
    if (u.includes('shiprocket_synced_at=not.is.null')) return json([{ order_code: 'SMF-20261029-9689', shiprocket_synced_at: new Date().toISOString(), shiprocket_status: 'In Transit' }]);
    if (u.includes('shiprocket_error=not.is.null')) return json([]);
    if (u.includes('shiprocket_order_id=is.null')) return json([{ order_code: 'SMF-20261102-0001', address: { name: 'Test order', line: 'x [TEST · do not ship]' } }]);
    if (u.includes('rpc/site_realtime')) return json(2);
    return json([{ id: 1 }]);
  };
  try {
    const login = await call({ action: 'login', password: 'correct horse' }, { 'cf-connecting-ip': '4.4.4.4' });
    const cookie = login.headers['set-cookie'].split(';')[0];
    const { body } = await call({ action: 'systemCheck' }, { cookie, 'cf-connecting-ip': '4.4.4.4' });
    const c = body.checks;
    assert.equal(c.shiprocket.ok, true, 'a recent sync and no errors = working');
    assert.match(c.shiprocket.detail, /In Transit/);
    assert.equal(c.email.ok, true, 'a send-only Resend key is fine: judged by delivered emails');
    assert.match(c.email.detail, /delivered/);
    assert.deepEqual([c.sheets.ok, c.sheets.missing], [null, true], 'Sheets shows "Not connected" with setup steps');
    assert.ok(!hits.some((h) => /shiprocket\.in|api\.resend\.com/.test(h)), 'no Shiprocket login, no Resend admin call');
  } finally { globalThis.fetch = realFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
