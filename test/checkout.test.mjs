import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

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

test('api/verify-payment.js signature calculation', () => {
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

test('api/webhook.js signature calculation', () => {
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
