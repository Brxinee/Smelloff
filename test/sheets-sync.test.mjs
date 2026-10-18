import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { planTabSync } from '../api/_google-sheets.js';
import {
  ORDER_COLUMNS, CONTACT_COLUMNS, orderRow, orderKey, contactKey, isTestOrInternal,
  buildContactRows, mergeContact, moneyOf, syncSheets,
} from '../api/sheets-sync.js';

const headers = (cols) => cols.map((c) => c.header);
const order = (over = {}) => ({
  order_code: 'SMF-20261018-4507', created_at: '2026-10-18T07:12:41Z', updated_at: '2026-10-18T07:13:38Z',
  status: 'confirmed', payment_method: 'upi', amount: 22900, cod_fee: 0,
  customer_email: 'Buyer@Example.com', customer_phone: '+91 98497 00666',
  address: { name: 'Anil Kumar M', line: 'House 1\nRam nagar', city: 'Ananthapur', state: 'Andhra Pradesh', pincode: '515812' },
  items: [{ price: 229, quantity: 1 }],
  ...over,
});
const valuesOf = (req) => req.updateCells.rows.map((r) => r.values.map((c) => {
  const v = c.userEnteredValue || {};
  return v.stringValue ?? v.numberValue ?? '';
}));

test('order rows: IST date serial, labels, digits kept as text, address on one line', () => {
  const row = orderRow(order());
  assert.equal(row.length, ORDER_COLUMNS.length);
  // 07:12:41 UTC = 12:42:41 IST on 18 Oct 2026
  assert.ok(Math.abs(row[0] - (46313 + (12 * 3600 + 42 * 60 + 41) / 86400)) < 1e-6);
  assert.equal(row[2], 'Confirmed');
  assert.equal(row[3], 'Prepaid');
  assert.equal(row[5], '9849700666');
  assert.equal(row[6], 'buyer@example.com');
  assert.equal(row[11], 'House 1, Ram nagar');
  assert.equal(row[14], '515812');
  assert.equal(orderKey(row), 'SMF-20261018-4507');
});

test('COD fee is recovered for old rows that folded it into the amount', () => {
  assert.deepEqual(moneyOf(order({ payment_method: 'cod', amount: 28900, cod_fee: 0 })), { subtotal: 229, codFee: 60, total: 289 });
  assert.deepEqual(moneyOf(order({ payment_method: 'cod', amount: 31800, cod_fee: 8900 })), { subtotal: 229, codFee: 89, total: 318 });
  // The pair price is below 2 × 229: a prepaid pair has no fee to recover.
  assert.deepEqual(moneyOf(order({ amount: 41900, items: [{ price: 229, quantity: 2 }] })), { subtotal: 419, codFee: 0, total: 419 });
});

test('test orders and the business phone stay out of the sheets', () => {
  assert.equal(isTestOrInternal(order()), false);
  assert.equal(isTestOrInternal(order({ address: { name: 'TEST ORDER - CANCEL' } })), true);
  assert.equal(isTestOrInternal(order({ customer_email: 'info@smelloff.in' })), true);
  assert.equal(isTestOrInternal(order({ customer_phone: '9000000002' })), true);
  assert.equal(isTestOrInternal(order({ customer_phone: '+91 93929 74031' })), true, 'business WhatsApp number');
});

test('contacts: one row per person, buyers vs subscribers, consent only from a signup', () => {
  const rows = buildContactRows({
    orders: [
      order(),
      order({ order_code: 'SMF-20261019-0001', created_at: '2026-10-19T07:00:00Z', status: 'delivered', items: [{ price: 229, quantity: 2 }], amount: 41900 }),
      order({ order_code: 'SMF-20261012-7863', customer_email: 'j@example.com', customer_phone: '8780939941', status: 'failed', address: { name: 'Jayesh' } }),
      order({ order_code: 'SMF-20260911-5100', customer_email: null, customer_phone: '9868949124', status: 'delivered', address: { name: 'Anish' } }),
    ],
    waitlist: [
      { email: 'Sub@Example.com', source: 'footer', created_at: '2026-07-08T18:17:53Z' },
      { email: 'buyer@example.com', source: 'blog-comment', created_at: '2026-01-01T00:00:00Z' },
      { email: 'owner@example.com', source: 'footer', created_at: '2026-07-08T18:17:53Z' },
    ],
    skipEmails: new Set(['owner@example.com']),
  });
  const by = Object.fromEntries(rows.map((r) => [contactKey(r), r]));
  assert.equal(rows.length, 4);
  const buyer = by['buyer@example.com'];
  assert.equal(buyer[5], 'Customer');
  assert.equal(buyer[6], 2, 'paid orders');
  assert.equal(buyer[7], 3, 'bottles');
  assert.equal(buyer[8], 648, 'order value');
  assert.equal(buyer[10], 'Delivered', 'last order status');
  assert.equal(buyer[11], 'Yes', 'signed up before ordering');
  assert.equal(buyer[13], 'Blog comment', 'source of first contact');
  assert.equal(by['j@example.com'][5], 'Tried to order');
  assert.equal(by['j@example.com'][11], 'No');
  assert.equal(by['9868949124'][0], '', 'phone-only buyer keyed by phone');
  assert.equal(by['sub@example.com'][5], 'Subscriber');
  assert.equal(by['owner@example.com'], undefined);
  assert.equal(mergeContact(CONTACT_COLUMNS[11], 'Yes', 'No'), 'Yes', 'consent is never taken away');
});

test('plan: new rows go in at the top, changed rows update only database columns', () => {
  const existing = [
    headers(ORDER_COLUMNS),
    // Same order, status moved on, owner wrote a COD call result and a note.
    [...orderRow(order({ status: 'placed', payment_method: 'cod' })).slice(0, 19), 'Confirmed on call', 'Called at 5pm'],
    // Unchanged row from the old sheet: never touched.
    [46180.8, 'SMF-20260607-5435', 'Payment pending', 'Prepaid', 'Maria', '9880471175', 'm@example.com', 1, 229, 0, 229, 'x', 'Bangalore', 'Karnataka', '560093', '', '', '', 46180.8, '', 'Old sheet'],
  ];
  const updated = order({ status: 'dispatched', payment_method: 'cod', shiprocket_awb: '14112362963396', courier: 'Xpressbees' });
  const fresh = order({ order_code: 'SMF-20261019-0002', created_at: '2026-10-19T09:00:00Z', address: { name: '=HYPERLINK("http://x","y")' } });
  const plan = planTabSync({ sheetId: 7, columns: ORDER_COLUMNS, existing, rows: [fresh, updated].map(orderRow), keyOf: orderKey });

  assert.equal(plan.inserted, 1);
  assert.equal(plan.updated, 1);
  assert.equal(plan.removed, 0);
  const rowUpdate = plan.requests.find((r) => r.updateCells?.start.rowIndex === 1 && r.updateCells.start.columnIndex === 0 && r.updateCells.rows[0].values.length === 19);
  assert.ok(rowUpdate, 'existing row rewritten over columns A–S only');
  assert.equal(valuesOf(rowUpdate)[0][2], 'Shipped');
  assert.equal(valuesOf(rowUpdate)[0][16], '14112362963396');
  // Insert happens after the updates, at row 2, and leaves owner columns empty.
  const insertAt = plan.requests.findIndex((r) => r.insertDimension);
  assert.ok(insertAt > plan.requests.indexOf(rowUpdate));
  assert.deepEqual(plan.requests[insertAt].insertDimension.range, { sheetId: 7, dimension: 'ROWS', startIndex: 1, endIndex: 2 });
  const inserted = plan.requests[insertAt + 1].updateCells;
  assert.equal(inserted.start.rowIndex, 1);
  const cells = inserted.rows[0].values;
  assert.equal(cells.length, ORDER_COLUMNS.length);
  assert.deepEqual(cells[4], { userEnteredValue: { stringValue: '=HYPERLINK("http://x","y")' } }, 'customer text is never a formula');
  assert.deepEqual(cells[19], {});
  assert.deepEqual(cells[20], {});
  assert.ok(!JSON.stringify(plan.requests).includes('5435'), 'rows the database does not know are left alone');
});

test('plan: nothing changes when the sheet already matches; blanks never erase', () => {
  const row = orderRow(order({ courier: 'Xpressbees' }));
  const existing = [headers(ORDER_COLUMNS), [...row.slice(0, 19), '', '']];
  const again = planTabSync({ sheetId: 1, columns: ORDER_COLUMNS, existing, rows: [row], keyOf: orderKey });
  assert.deepEqual(again.requests, []);
  const lostCourier = orderRow(order());
  const kept = planTabSync({ sheetId: 1, columns: ORDER_COLUMNS, existing, rows: [lostCourier], keyOf: orderKey });
  assert.deepEqual(kept.requests, [], 'a value the database no longer has stays in the sheet');
});

test('plan: duplicate keys from racing inserts are removed, a duplicate with owner notes is kept', () => {
  const row = orderRow(order());
  const existing = [
    headers(ORDER_COLUMNS),
    [...row.slice(0, 19), '', ''],
    [...row.slice(0, 19), '', ''],
    [...row.slice(0, 19), '', 'keep me'],
  ];
  const plan = planTabSync({ sheetId: 3, columns: ORDER_COLUMNS, existing, rows: [row], keyOf: orderKey });
  assert.equal(plan.removed, 1);
  assert.deepEqual(plan.requests.map((r) => r.deleteDimension?.range.startIndex).filter((x) => x !== undefined), [2]);
});

test('plan: refuses to write when the header row is not the expected layout', () => {
  const existing = [['Order ID', 'Timestamp', 'Name']];
  assert.throws(() => planTabSync({ sheetId: 1, columns: ORDER_COLUMNS, existing, rows: [orderRow(order())], keyOf: orderKey }), /Header mismatch/);
});

test('syncSheets signs a service-account JWT and writes both sheets', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'sheets@smelloff.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  const calls = [];
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ u, opts });
    if (u === 'https://oauth2.googleapis.com/token') {
      const assertion = new URLSearchParams(opts.body).get('assertion');
      const [h, c, s] = assertion.split('.');
      const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'));
      assert.ok(ok, 'JWT signature verifies with the service account key');
      const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets');
      return json({ access_token: 'tok', expires_in: 3600 });
    }
    if (u.includes('/rest/v1/orders?')) return json([order(), order({ order_code: 'SMF-20261011-9420', customer_phone: '9392974031', customer_email: 'owner@example.com' })]);
    if (u.includes('/rest/v1/waitlist?')) return json([{ email: 'owner@example.com', source: 'footer', created_at: '2026-07-08T18:17:53Z' }]);
    if (u.includes('/rest/v1/contact_messages?')) return json([]);
    if (u.includes('sheets.googleapis.com')) assert.equal(opts.headers.Authorization, 'Bearer tok');
    if (u.includes('?fields=sheets.properties')) {
      const title = u.includes('1VY0') ? 'Orders' : 'Contacts';
      return json({ sheets: [{ properties: { sheetId: 42, title } }] });
    }
    if (u.includes('/values/')) return json({ values: [u.includes('Orders') ? headers(ORDER_COLUMNS) : headers(CONTACT_COLUMNS)] });
    if (u.endsWith(':batchUpdate')) return json({ replies: [] });
    throw new Error('unexpected fetch ' + u);
  };
  try {
    const result = await syncSheets({ route: 'test' });
    assert.equal(result.status, 'ok', JSON.stringify(result));
    assert.deepEqual(result.orders, { inserted: 1, updated: 0, removed: 0 });
    assert.deepEqual(result.contacts, { inserted: 1, updated: 0, removed: 0 });
    const batches = calls.filter((c) => c.u.endsWith(':batchUpdate')).map((c) => JSON.parse(c.opts.body));
    assert.equal(batches.length, 2);
    const written = JSON.stringify(batches);
    assert.ok(written.includes('SMF-20261018-4507'));
    assert.ok(!written.includes('9420') && !written.includes('owner@example.com'), 'owner checkouts stay out');
    assert.equal(calls.filter((c) => c.u.includes('oauth2')).length, 1, 'one token for the whole run');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test('syncSheets does nothing until the service account is configured', async () => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  assert.deepEqual(await syncSheets(), { status: 'not_configured' });
});

test('the browser no longer posts orders or emails to the old Apps Script', () => {
  for (const file of ['odorstrike.html', 'assets/js/blog-comments.js', 'config/routing.json']) {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('script.google.com'), file);
  }
});
