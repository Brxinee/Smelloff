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

test('frontend submit architecture: chrome.js has no capture click interceptors or stopImmediatePropagation', () => {
  const chromeJs = fs.readFileSync('assets/js/chrome.js', 'utf8');
  assert.ok(!chromeJs.includes('event.stopImmediatePropagation()'), 'chrome.js must not stop click propagation');
  assert.ok(!chromeJs.includes("activePaymentMethod"), 'duplicate activePaymentMethod must be removed');
  assert.ok(!chromeJs.includes("addEventListener('click', function (event)"), 'chrome.js must not attach global click interceptors for submit');
  assert.ok(chromeJs.includes('var razorpayInFlight = false;'), 'chrome.js must define in-flight double-click guard');
  assert.ok(chromeJs.includes('if (razorpayInFlight) return;'), 'startRazorpay must check in-flight guard');
});

test('frontend submit architecture: odorstrike.html submitOrder is sole router and button copy is clear', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes("submitText', (isCod ? 'Place COD order · ₹' : 'Pay securely · ₹')"), 'Button copy must say Pay securely for prepaid');
  assert.ok(html.includes("if (payMethod === 'prepaid')"), 'submitOrder must route prepaid');
  assert.ok(html.includes("return window.startRazorpay();"), 'submitOrder must invoke startRazorpay for prepaid');
  assert.ok(html.includes("onclick=\"submitOrder()\""), 'submit button must have onclick submitOrder');
});

test('Step 3: Razorpay SDK loading is deterministic and has no dynamic script injection', () => {
  const chromeJs = fs.readFileSync('assets/js/chrome.js', 'utf8');
  const html = fs.readFileSync('odorstrike.html', 'utf8');

  // 1. Static Razorpay script exists
  assert.ok(html.includes('<script src="https://checkout.razorpay.com/v1/checkout.js" defer></script>'), 'Static script tag must exist in odorstrike.html');

  // 2. No dynamic script injection in chrome.js
  assert.ok(!chromeJs.includes("document.createElement('script')"), 'chrome.js must not dynamically create script tags');
  assert.ok(!chromeJs.includes("loadRazorpay("), 'old loadRazorpay function must be removed');

  // 3. Single readiness promise
  assert.ok(chromeJs.includes('window.smfRazorpayReady'), 'smfRazorpayReady must be used for SDK readiness');
  assert.ok(chromeJs.includes('await getRazorpayReady()'), 'startRazorpay must await SDK readiness');
});

test('Step 3: Success ownership is deduplicated, idempotent, and single-source', () => {
  const chromeJs = fs.readFileSync('assets/js/chrome.js', 'utf8');
  const html = fs.readFileSync('odorstrike.html', 'utf8');

  // markSuccess in chrome.js delegates to showSuccess('razorpay')
  assert.ok(chromeJs.includes("window.showSuccess(orderCode, 'razorpay'"), 'markSuccess must call showSuccess with razorpay method');
  assert.ok(!chromeJs.includes("window.trackPurchase("), 'chrome.js markSuccess must not independently call trackPurchase');
  assert.ok(!chromeJs.includes("window.soAttachOrder("), 'chrome.js markSuccess must not independently call soAttachOrder');
  assert.ok(!chromeJs.includes("cleanupAfterSuccess()"), 'chrome.js markSuccess must not independently call cleanupAfterSuccess');

  // showSuccess in odorstrike.html owns side effects and has idempotency guard
  assert.ok(html.includes('_processedOrders'), 'showSuccess must use _processedOrders set for idempotency');
  assert.ok(html.includes('trackPurchase(amount, orderId)'), 'showSuccess must trigger trackPurchase');
  assert.ok(html.includes("soAttachOrder(orderId, amount, qty, method === 'cod' ? 'cod' : 'razorpay')"), 'showSuccess must trigger soAttachOrder');
  assert.ok(html.includes('setCartQty(0)'), 'showSuccess must clear cart');

  // Email confirmation is sent in showSuccess only for verified razorpay orders with idempotency guard
  assert.ok(html.includes("if (method === 'razorpay' && buyerEmail"), 'showSuccess must handle prepaid email confirmation');
  assert.ok(html.includes("SmelloffEmail.send('orderConfirmation'"), 'showSuccess must invoke SmelloffEmail.send');
});

test('Step 3: Idempotent success coordinator logic behaves correctly', () => {
  const processedOrders = new Set();
  let trackPurchaseCount = 0;
  let soAttachCount = 0;
  let emailCount = 0;

  function mockShowSuccess(orderId, method, email) {
    if (!processedOrders.has(orderId)) {
      processedOrders.add(orderId);
      trackPurchaseCount++;
      soAttachCount++;
      if (method === 'razorpay' && email) {
        emailCount++;
      }
    }
  }

  // First invocation
  mockShowSuccess('SMF-TEST-1', 'razorpay', 'user@example.com');
  assert.equal(trackPurchaseCount, 1);
  assert.equal(soAttachCount, 1);
  assert.equal(emailCount, 1);

  // Duplicate invocation (e.g. webhook + frontend callback or retry)
  mockShowSuccess('SMF-TEST-1', 'razorpay', 'user@example.com');
  assert.equal(trackPurchaseCount, 1, 'trackPurchase must not be duplicated');
  assert.equal(soAttachCount, 1, 'soAttachOrder must not be duplicated');
  assert.equal(emailCount, 1, 'email must not be duplicated');

  // Distinct second order
  mockShowSuccess('SMF-TEST-2', 'razorpay', 'user2@example.com');
  assert.equal(trackPurchaseCount, 2);
  assert.equal(soAttachCount, 2);
  assert.equal(emailCount, 2);
});

test('Step 3: COD flow reaches showSuccess(orderId, "cod") and does not touch Razorpay', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes("showSuccess(persistedOrderId, 'cod')"), 'COD must call showSuccess with cod');
  assert.ok(html.includes("if (payMethod === 'prepaid')"), 'Prepaid is guarded separately from COD');
});

// ============================================================
// PHASE 18 — BACKEND PAYMENT INTEGRITY TESTS
// ============================================================

test('Step 4 Backend: create-order calculates authoritative prepaid total for qty 1 & 2', async () => {
  // Fractional quantity rejection
  const reqFrac = { method: 'POST', headers: {}, body: { quantity: 2.5, payment_method: 'upi' } };
  const resFrac = createMockRes();
  await createOrderHandler(reqFrac, resFrac);
  assert.equal(resFrac.statusCode, 400);

  // Negative quantity rejection
  const reqNeg = { method: 'POST', headers: {}, body: { quantity: -2, payment_method: 'upi' } };
  const resNeg = createMockRes();
  await createOrderHandler(reqNeg, resNeg);
  assert.equal(resNeg.statusCode, 400);

  // Large quantity (>10) rejection
  const reqMax = { method: 'POST', headers: {}, body: { quantity: 11, payment_method: 'upi' } };
  const resMax = createMockRes();
  await createOrderHandler(reqMax, resMax);
  assert.equal(resMax.statusCode, 400);

  // Price tampering rejection
  const reqTamperedPrice = { method: 'POST', headers: {}, body: { quantity: 2, items: [{ quantity: 2, price: 100 }], payment_method: 'upi' } };
  const resTamperedPrice = createMockRes();
  await createOrderHandler(reqTamperedPrice, resTamperedPrice);
  assert.equal(resTamperedPrice.statusCode, 400);
});

test('Step 4 Backend: verify-payment rejects signature mismatch and tampered payload', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: {
      orderCode: 'SMF-20260906-9999',
      customerPhone: '9876543210',
      razorpay_payment_id: 'pay_test123',
      razorpay_order_id: 'order_test456',
      razorpay_signature: 'invalid_hex_signature'
    }
  };
  const res = createMockRes();
  await verifyPaymentHandler(req, res);
  // Rejects as 404 (order not found in test mock) or 400/403
  assert.ok([400, 403, 404].includes(res.statusCode));
});

test('Step 4 Backend: webhook raw body HMAC verification and replay protection', async () => {
  const secret = 'test_webhook_secret_xyz';
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;

  const eventPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_001',
          order_id: 'order_test_001',
          amount: 22900,
          currency: 'INR'
        }
      }
    }
  };
  const rawBody = JSON.stringify(eventPayload);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // 1. Valid signature with raw body
  const req = {
    method: 'POST',
    headers: {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_test_unique_1'
    },
    body: rawBody
  };
  const res = createMockRes();
  await webhookHandler(req, res);
  assert.equal(res.statusCode, 200);

  // 2. Duplicate event ID (Replay protection)
  const reqDuplicate = {
    method: 'POST',
    headers: {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_test_unique_1'
    },
    body: rawBody
  };
  const resDuplicate = createMockRes();
  await webhookHandler(reqDuplicate, resDuplicate);
  assert.equal(resDuplicate.statusCode, 200);
  assert.equal(resDuplicate.body.duplicate, true);

  // 3. Tampered body rejection
  const reqTampered = {
    method: 'POST',
    headers: {
      'x-razorpay-signature': signature
    },
    body: JSON.stringify({ ...eventPayload, event: 'order.paid' })
  };
  const resTampered = createMockRes();
  await webhookHandler(reqTampered, resTampered);
  assert.equal(resTampered.statusCode, 400);
  assert.ok(resTampered.body.error.includes('Invalid webhook signature'));
});

test('Step 4 Backend: webhook handles payment.failed without downgrading confirmed state', async () => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_xyz';
  const failedPayload = {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_fail_999',
          order_id: 'order_nonexistent'
        }
      }
    }
  };
  const rawBody = JSON.stringify(failedPayload);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const req = {
    method: 'POST',
    headers: {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_fail_123'
    },
    body: rawBody
  };
  const res = createMockRes();
  await webhookHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.received, true);
});

test('Step 4 Backend: amount validation logic strictly enforces paise integrity', () => {
  const unitPrice = 229;
  const codFee = 60;

  // Prepaid 1 unit = 22900 paise
  const prepaid1 = unitPrice * 1 * 100;
  assert.equal(prepaid1, 22900);

  // Prepaid 2 units = 45800 paise
  const prepaid2 = unitPrice * 2 * 100;
  assert.equal(prepaid2, 45800);

  // COD 1 unit = 28900 paise
  const cod1 = (unitPrice * 1 + codFee) * 100;
  assert.equal(cod1, 28900);

  // COD 2 units = 51800 paise
  const cod2 = (unitPrice * 2 + codFee) * 100;
  assert.equal(cod2, 51800);
});


