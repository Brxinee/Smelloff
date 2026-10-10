import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRazorpayOrder, fetchRazorpayPayment } from '../api/_razorpay.js';

function withFetch(impl, fn) {
  const realFetch = globalThis.fetch;
  const env = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
  process.env.RAZORPAY_KEY_ID = 'rzp_test_abc';
  process.env.RAZORPAY_KEY_SECRET = 'shh';
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = realFetch;
    if (env.id === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = env.id;
    if (env.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = env.secret;
  });
}

test('checkout never imports the razorpay npm SDK (its axios transport fails on Workers)', () => {
  for (const file of ['api/create-order.js', 'api/verify-payment.js']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from ['"]razorpay['"]/, file);
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies?.razorpay, undefined);
});

test('createRazorpayOrder posts JSON with Basic auth and returns the order', async () => {
  let seen;
  await withFetch(async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: 'order_1', amount: 29900, currency: 'INR' }), { status: 200 });
  }, async () => {
    const order = await createRazorpayOrder({ amount: 29900, currency: 'INR', receipt: 'SMF-20261010-0001' });
    assert.equal(order.id, 'order_1');
  });
  assert.equal(seen.url, 'https://api.razorpay.com/v1/orders');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, `Basic ${btoa('rzp_test_abc:shh')}`);
  assert.deepEqual(JSON.parse(seen.init.body), { amount: 29900, currency: 'INR', receipt: 'SMF-20261010-0001' });
});

test('fetchRazorpayPayment GETs the payment by id', async () => {
  let seenUrl;
  await withFetch(async (url, init) => {
    seenUrl = url;
    assert.equal(init.method, 'GET');
    return new Response(JSON.stringify({ id: 'pay_1', status: 'captured' }), { status: 200 });
  }, async () => {
    const payment = await fetchRazorpayPayment('pay_1');
    assert.equal(payment.status, 'captured');
  });
  assert.equal(seenUrl, 'https://api.razorpay.com/v1/payments/pay_1');
});

test('Razorpay API errors surface their description as a 502, not a TypeError', async () => {
  await withFetch(async () => new Response(
    JSON.stringify({ error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } }),
    { status: 401 },
  ), async () => {
    await assert.rejects(createRazorpayOrder({ amount: 100 }), (error) => {
      assert.equal(error.message, 'Authentication failed');
      assert.equal(error.statusCode, 502);
      return true;
    });
  });
});

test('a network failure becomes a clear 502', async () => {
  await withFetch(async () => { throw new TypeError('fetch failed'); }, async () => {
    await assert.rejects(fetchRazorpayPayment('pay_1'), (error) => {
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /unreachable/);
      return true;
    });
  });
});
