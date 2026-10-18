import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { planTabSync } from '../api/_google-sheets.js';
import {
  ORDER_COLUMNS, CONTACT_COLUMNS, orderRow, orderKey, contactKey, isTestOrInternal,
  buildContactRows, mergeContact, moneyOf, syncSheets, link, humanize, orderSource, stampText,
} from '../api/sheets-sync.js';

const col = (name) => ORDER_COLUMNS.findIndex((c) => c.header === name);

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
  assert.deepEqual(row[col('WhatsApp')], { formula: '=HYPERLINK("https://wa.me/919849700666","Chat")' });
  assert.equal(row[col('Email')], 'buyer@example.com');
  assert.equal(row[col('Address')], 'House 1, Ram nagar');
  assert.equal(row[col('Pincode')], '515812');
  assert.equal(orderKey(row), 'SMF-20261018-4507');
});

test('order rows: COD confirmation link, tracking link, courier status, dates, review, source', () => {
  const cod = orderRow(order({
    id: 'u1', payment_method: 'cod', status: 'placed', amount: 31800, cod_fee: 8900,
    address: { name: 'Ravi "R" Kumar', city: 'Pune' },
  }));
  const wa = cod[col('WhatsApp')].formula;
  assert.match(wa, /^=HYPERLINK\("https:\/\/wa\.me\/919849700666\?text=Hi%20Ravi%2C%20this%20is%20Smelloff\./);
  assert.match(wa, /SMF-20261018-4507%20for%20%E2%82%B9318%2C%20delivering%20to%20Pune/);
  assert.match(wa, /","Confirm COD"\)$/);
  assert.equal((wa.match(/"/g) || []).length, 4, 'customer text never adds a quote to the formula');
  const apostrophe = orderRow(order({ payment_method: 'cod', status: 'placed', address: { name: "D'Souza (Mumbai)" } }))[col('WhatsApp')];
  assert.match(apostrophe.formula, /text=Hi%20D%27Souza%2C/, 'names with apostrophes still get a link');

  const shipped = orderRow(order({
    id: 'u2', status: 'delivered', shiprocket_awb: '14112362963396', shiprocket_status: 'PICKUP_EXCEPTION',
    status_history: [
      { status: 'confirmed', at: '2026-10-18T07:13:38Z' },
      { status: 'dispatched', at: '2026-10-19T10:00:00Z' },
      { status: 'dispatched', at: '2026-10-20T10:00:00Z' },
      { status: 'delivered', at: '2026-10-22T10:00:00Z' },
    ],
    refund_status: 'processed', event_source_url: 'https://smelloff.in/odorstrike?utm_source=www.chatgpt.com',
  }), { ratings: new Map([['u2', 5]]) });
  assert.deepEqual(shipped[col('Tracking')], { formula: '=HYPERLINK("https://www.shiprocket.co/tracking/14112362963396","Track")' });
  assert.equal(shipped[col('Courier status')], 'Pickup exception');
  assert.ok(Math.abs(shipped[col('Shipped on')] - (46314 + 15.5 / 24)) < 1e-6, 'first dispatch');
  assert.ok(Math.abs(shipped[col('Delivered on')] - (46317 + 15.5 / 24)) < 1e-6);
  assert.equal(shipped[col('Refund')], 'Processed');
  assert.equal(shipped[col('Review (stars)')], 5);
  assert.equal(shipped[col('Source')], 'chatgpt.com');
  assert.deepEqual(shipped[col('WhatsApp')], { formula: '=HYPERLINK("https://wa.me/919849700666","Chat")' }, 'plain chat once confirmed');

  assert.equal(orderSource({ event_source_url: 'https://smelloff.in/odorstrike?ref=ABC12' }), 'Partner ABC12');
  assert.equal(orderSource({ event_source_url: 'https://smelloff.in/odorstrike?buy=1', fbc: 'fb.1.x' }), 'Meta ad');
  assert.equal(orderSource({ event_source_url: 'https://smelloff.in/odorstrike?buy=1' }), 'Website');
  assert.equal(orderSource({}), '');
  assert.equal(humanize('RTO_INITIATED'), 'RTO initiated');
  assert.equal(link('https://x.example/a"),IMPORTXML("b', 'Track'), '', 'a URL that could break out of the formula is dropped');
  assert.equal(orderRow(order({ customer_phone: '12345' }))[col('WhatsApp')], '', 'no link without a 10-digit number');
});

test('sync status line is in IST', () => {
  assert.equal(stampText({ inserted: 1, updated: 2 }, new Date('2026-10-18T21:45:00Z')),
    'Last synced by the website: 19 Oct 2026, 03:15 IST (1 new, 2 updated). Syncs after every order and every 15 minutes.');
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
  const c = (name) => CONTACT_COLUMNS.findIndex((x) => x.header === name);
  const buyer = by['buyer@example.com'];
  assert.equal(buyer.length, CONTACT_COLUMNS.length);
  assert.equal(buyer[c('Type')], 'Customer');
  assert.equal(buyer[c('Paid orders')], 2);
  assert.equal(buyer[c('Bottles')], 3);
  assert.equal(buyer[c('Order value (₹)')], 648);
  assert.equal(buyer[c('Last order status')], 'Delivered');
  assert.equal(buyer[c('Email offers')], 'Yes', 'signed up before ordering');
  assert.equal(buyer[c('Source')], 'Blog comment', 'source of first contact');
  assert.deepEqual(buyer[c('WhatsApp')], { formula: '=HYPERLINK("https://wa.me/919849700666","Chat")' });
  assert.equal(by['j@example.com'][c('Type')], 'Tried to order');
  assert.equal(by['j@example.com'][c('Email offers')], 'No');
  assert.equal(by['9868949124'][0], '', 'phone-only buyer keyed by phone');
  assert.equal(by['sub@example.com'][c('Type')], 'Subscriber');
  assert.equal(by['sub@example.com'][c('WhatsApp')], '');
  assert.equal(by['owner@example.com'], undefined);
  assert.equal(mergeContact(CONTACT_COLUMNS[c('Email offers')], 'Yes', 'No'), 'Yes', 'consent is never taken away');
});

// What the values API returns for a row the sync wrote (FORMULA render).
const asSheet = (row, owner = ['', '']) => [
  ...row.slice(0, -2).map((v) => (v && typeof v === 'object' ? v.formula : v)), ...owner,
];

test('plan: new rows go in at the top with copied formats; changed rows write only changed cells', () => {
  const existing = [
    headers(ORDER_COLUMNS),
    // Same order, now shipped; the owner wrote a COD call result and a note.
    asSheet(orderRow(order({ status: 'placed', payment_method: 'cod' })), ['Confirmed on call', 'Called at 5pm']),
    // A row from the old sheet the database doesn't know: never touched.
    ['46180.8', 'SMF-20260607-5435', 'Payment pending', 'Prepaid', 'Maria'],
  ];
  const updated = order({ status: 'dispatched', payment_method: 'cod', shiprocket_awb: '14112362963396' });
  const fresh = order({ order_code: 'SMF-20261019-0002', created_at: '2026-10-19T09:00:00Z', address: { name: '=HYPERLINK("http://x","y")' } });
  const plan = planTabSync({ sheetId: 7, rowCount: 1000, columns: ORDER_COLUMNS, existing, rows: [fresh, updated].map((o) => orderRow(o)), keyOf: orderKey });

  assert.equal(plan.inserted, 1);
  assert.equal(plan.updated, 1);
  assert.equal(plan.removed, 0);
  const insertAt = plan.requests.findIndex((r) => r.insertDimension);
  const writes = plan.requests.slice(0, insertAt).filter((r) => r.updateCells?.start.rowIndex === 1);
  const cols = writes.map((r) => r.updateCells.start.columnIndex);
  // Status, the WhatsApp link (Confirm COD → Chat), AWB + tracking link: nothing else.
  assert.deepEqual(cols, [col('Status'), col('WhatsApp'), col('AWB')]);
  assert.deepEqual(valuesOf(writes[0]), [['Shipped']]);
  assert.deepEqual(writes[1].updateCells.rows[0].values, [{ userEnteredValue: { formulaValue: '=HYPERLINK("https://wa.me/919849700666","Chat")' } }]);
  assert.deepEqual(valuesOf(writes[2]), [['14112362963396', '']]);
  assert.equal(writes[2].updateCells.rows[0].values[1].userEnteredValue.formulaValue,
    '=HYPERLINK("https://www.shiprocket.co/tracking/14112362963396","Track")');
  assert.ok(writes.every((r) => r.updateCells.start.columnIndex + r.updateCells.rows[0].values.length <= col('COD call')), 'owner columns untouched');

  // Insert at row 2 after the updates (they use row numbers from before the
  // insert), formats copied from the grid's last (empty) row, then values.
  assert.deepEqual(plan.requests[insertAt].insertDimension.range, { sheetId: 7, dimension: 'ROWS', startIndex: 1, endIndex: 2 });
  const copy = plan.requests[insertAt + 1].copyPaste;
  assert.equal(copy.pasteType, 'PASTE_FORMAT');
  assert.deepEqual([copy.source.startRowIndex, copy.destination.startRowIndex, copy.destination.endRowIndex], [1000, 1, 2]);
  const cells = plan.requests[insertAt + 2].updateCells.rows[0].values;
  assert.equal(cells.length, ORDER_COLUMNS.length);
  assert.deepEqual(cells[col('Name')], { userEnteredValue: { stringValue: '=HYPERLINK("http://x","y")' } }, 'customer text is never a formula');
  assert.deepEqual(cells[col('COD call')], {});
  assert.deepEqual(cells[col('Notes')], {});
  assert.ok(!JSON.stringify(plan.requests).includes('5435'), 'rows the database does not know are left alone');
});

test('plan: nothing changes when the sheet already matches; blanks never erase', () => {
  const row = orderRow(order({ courier: 'Xpressbees', shiprocket_awb: '1411' }));
  const existing = [headers(ORDER_COLUMNS), asSheet(row)];
  assert.deepEqual(planTabSync({ sheetId: 1, columns: ORDER_COLUMNS, existing, rows: [row], keyOf: orderKey }).requests, []);
  const lost = orderRow(order());
  assert.deepEqual(planTabSync({ sheetId: 1, columns: ORDER_COLUMNS, existing, rows: [lost], keyOf: orderKey }).requests, [],
    'courier, AWB and tracking link the database no longer has stay in the sheet');
});

test('plan: duplicate keys from racing inserts are removed, a duplicate with owner notes is kept', () => {
  const row = orderRow(order());
  const existing = [headers(ORDER_COLUMNS), asSheet(row), asSheet(row), asSheet(row, ['', 'keep me'])];
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
    if (u.includes('/rest/v1/orders?')) return json([order({ id: 'o1' }), order({ order_code: 'SMF-20261011-9420', customer_phone: '9392974031', customer_email: 'owner@example.com' })]);
    if (u.includes('/rest/v1/waitlist?')) return json([{ email: 'owner@example.com', source: 'footer', created_at: '2026-07-08T18:17:53Z' }]);
    if (u.includes('/rest/v1/contact_messages?')) return json([]);
    if (u.includes('/rest/v1/reviews?')) return json([{ order_id: 'o1', rating: 4 }]);
    if (u.includes('/values/SyncStatus')) return json({});
    if (u.includes('sheets.googleapis.com')) assert.equal(opts.headers.Authorization, 'Bearer tok');
    if (u.includes('?fields=sheets.properties')) {
      const title = u.includes('1VY0') ? 'Orders' : 'Contacts';
      return json({ sheets: [{ properties: { sheetId: 42, title, gridProperties: { rowCount: 1000 } } }] });
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
    assert.ok(written.includes('"numberValue":4'), 'review rating written');
    assert.ok(calls.some((c) => c.u.includes('valueRenderOption=FORMULA')), 'reads formulas to compare links');
    const stamps = calls.filter((c) => c.u.includes('/values/SyncStatus'));
    assert.equal(stamps.length, 2, 'status line in both spreadsheets');
    assert.match(JSON.parse(stamps[0].opts.body).values[0][0], /^Last synced by the website: .* \(1 new, 0 updated\)/);
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
