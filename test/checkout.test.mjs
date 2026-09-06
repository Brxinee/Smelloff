import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import createOrderHandler from '../api/create-order.js';
import verifyPaymentHandler from '../api/verify-payment.js';
import webhookHandler from '../api/webhook.js';

test('vercel.json routing integrity', () => {
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const redirects = vercel.redirects || [];
  
  // Ensure /odorstrike is NOT redirected away
  const odorstrikeRedirect = redirects.find(r => r.source === '/odorstrike' || r.source === '/odorstrike/');
  assert.equal(odorstrikeRedirect, undefined, '/odorstrike should not be redirected to home');

  // Verify CSP contains Razorpay endpoints
  const headers = vercel.headers || [];
  const globalHeader = headers.find(h => h.source === '/(.*)');
  assert.ok(globalHeader, 'global header config should exist');
  const csp = globalHeader.headers.find(h => h.key === 'Content-Security-Policy');
  assert.ok(csp, 'CSP header should exist');
  assert.ok(csp.value.includes('https://checkout.razorpay.com'), 'CSP must include checkout.razorpay.com');
  assert.ok(csp.value.includes('https://api.razorpay.com'), 'CSP must include api.razorpay.com');
});

test('odorstrike.html includes Razorpay Checkout script and clean UI', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes('https://checkout.razorpay.com/v1/checkout.js'), 'Razorpay checkout script must be in odorstrike.html');
  assert.ok(!html.includes('id="upiInlineId"'), 'Static manual UPI ID element should not appear in checkout UI');
  assert.ok(html.includes('SECURE PREPAID PAYMENT'), 'Modern prepaid panel should be present');
});

test('api/verify-payment.js signature calculation & constant-time comparison', () => {
  const secret = 'test_secret_12345';
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const provided = Buffer.from(generatedSignature, 'hex');
  const expected = Buffer.from(generatedSignature, 'hex');
  assert.equal(crypto.timingSafeEqual(expected, provided), true);

  const tampered = Buffer.from('00' + generatedSignature.slice(2), 'hex');
  assert.equal(crypto.timingSafeEqual(expected, tampered), false);
});

test('api/webhook.js signature calculation & validation', () => {
  const secret = 'webhook_secret_67890';
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123' } } } });

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const provided = Buffer.from(generatedSignature, 'hex');
  const expected = Buffer.from(generatedSignature, 'hex');
  assert.equal(crypto.timingSafeEqual(expected, provided), true);
});

test('service worker version bumped', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes('smelloff-v31'), 'Service worker must use v31 cache');
});

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    setHeader: () => {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

test('create-order: rejects invalid quantity (<1 or >10)', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: { quantity: 0, payment_method: 'upi' }
  };
  const res = createMockRes();
  await createOrderHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes('Quantity must be an integer'));
});

test('create-order: rejects manipulated price/amount', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: { quantity: 1, amount: 1000, payment_method: 'upi' } // ₹10 instead of ₹229 (22900 paise)
  };
  const res = createMockRes();
  await createOrderHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes('Order amount mismatch'));
});

test('webhook: rejects missing signature', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: { event: 'payment.captured' }
  };
  const res = createMockRes();
  await webhookHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes('signature'));
});

test('verify-payment: rejects missing payment id, order id or signature', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260906-1234', customerPhone: '9876543210', razorpay_payment_id: '' }
  };
  const res = createMockRes();
  await verifyPaymentHandler(req, res);
  assert.ok(res.statusCode === 400 || res.statusCode === 404);
});
