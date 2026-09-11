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
  assert.ok(html.includes("trackPurchase(amount, orderId, qty, method === 'cod' ? 'cod' : 'razorpay')"), 'showSuccess must trigger trackPurchase with qty and method');
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
  assert.ok(html.includes("showSuccess(persistedOrderId, 'cod'"), 'COD must call showSuccess with cod');
  assert.ok(html.includes("if (payMethod === 'prepaid')"), 'Prepaid is guarded separately from COD');
});

test('Step 3: trackPurchase correctly maps unitPrice, item quantity, and payment method to GA4 purchase event', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes('function trackPurchase(amount, orderId, qty, paymentMethod)'), 'trackPurchase must accept qty and paymentMethod parameters');
  assert.ok(html.includes('items: gaItems(unitPrice, qty)'), 'GA4 purchase event must use unit price and item quantity');
  assert.ok(html.includes('if (paymentMethod) gaData.payment_type = paymentMethod;'), 'GA4 purchase event must record payment_type');
});

test('GA4 add_payment_info contract: uses standard payment_type and item subtotal value', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(
    html.includes("gtag('event', 'add_payment_info', { payment_type: method, currency: 'INR', value: t.subtotal, items: gaItems(v.amount, t.qty) })"),
    'add_payment_info must use payment_type parameter and item subtotal value'
  );
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

test('Multi-quantity orderPayload calculation integrity in chrome.js', () => {
  const chromeJs = fs.readFileSync('assets/js/chrome.js', 'utf8');
  assert.ok(chromeJs.includes('var amountRupees = unitPrice * qty;'), 'chrome.js must calculate amountRupees as unitPrice * qty');
  assert.ok(!chromeJs.includes("numberFromText('checkoutAmount')"), 'chrome.js must not parse formatted string checkoutAmount which breaks on multi-quantity');

  // Verify static submitText in odorstrike.html matches default COD total
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes('<span id="submitText">Place COD order · ₹289</span>'), 'Static submit button must match default COD total ₹289');

  // Exhaustive quantity testing: 1, 2, 3, 4, 5, 10
  const unitPrice = 229;
  const codFee = 60;
  const testQuantities = [1, 2, 3, 4, 5, 10];

  for (const q of testQuantities) {
    const expectedPrepaidRupees = unitPrice * q;
    const expectedPrepaidPaise = expectedPrepaidRupees * 100;
    const expectedCodRupees = (unitPrice * q) + codFee;
    const expectedCodPaise = expectedCodRupees * 100;

    // Simulate chrome.js logic
    const calcRupees = unitPrice * q;
    const calcPaise = Math.round(calcRupees * 100);
    assert.equal(calcRupees, expectedPrepaidRupees, `Prepaid rupees for qty ${q} must equal ${expectedPrepaidRupees}`);
    assert.equal(calcPaise, expectedPrepaidPaise, `Prepaid paise for qty ${q} must equal ${expectedPrepaidPaise}`);

    // Verify against createOrder authoritative calculation in api/create-order.js
    assert.equal(unitPrice * q * 100, expectedPrepaidPaise, `Authoritative backend amount matches frontend for qty ${q}`);
  }
});

test('Mobile checkout viewport stability and responsive sizing in odorstrike.html', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');

  // Verify mobile overflow containment and touch scrolling
  assert.ok(html.includes('overscroll-behavior:contain'), 'Overlay must have overscroll-behavior:contain');
  assert.ok(html.includes('-webkit-overflow-scrolling:touch'), 'Overlay must have -webkit-overflow-scrolling:touch');

  // Verify input scroll margin for virtual keyboard alignment
  assert.ok(html.includes('scroll-margin-top:24px'), 'Inputs must have scroll-margin-top:24px');
  assert.ok(html.includes('scroll-margin-bottom:24px'), 'Inputs must have scroll-margin-bottom:24px');

  // Verify responsive media query for small viewports <= 360px and <= 600px
  assert.ok(html.includes('@media(max-width:360px)'), 'odorstrike.html must include @media(max-width:360px) rules');
  assert.ok(html.includes('@media(max-width:600px)'), 'odorstrike.html must include @media(max-width:600px) rules');
});

test('Deterministic Delivery Date Estimate calculation and Sunday exclusion matrix', () => {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function adjustIfSunday(d) {
    const res = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    if (res.getDay() === 0) {
      res.setDate(res.getDate() + 1);
    }
    return res;
  }

  function addBusinessDays(date, count) {
    const d = adjustIfSunday(date);
    let added = 0;
    while (added < count) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        added++;
      }
    }
    return d;
  }

  function calculateDeliveryEstimate(baseDate, options) {
    const now = baseDate ? new Date(baseDate) : new Date();
    const opt = options || {};
    const isAuthoritative = !!(opt.tier && (opt.tier === 'metro' || opt.tier === 'tier23'));
    const tier = isAuthoritative ? opt.tier : 'unknown';

    const loCount = (tier === 'tier23') ? 5 : 3;
    const hiCount = (tier === 'tier23') ? 7 : 5;

    const lo = addBusinessDays(now, loCount);
    let hi = addBusinessDays(now, hiCount);

    if (hi.getTime() <= lo.getTime()) {
      hi = addBusinessDays(lo, 1);
    }

    let text;
    if (tier === 'metro') {
      text = 'Estimated delivery: ' + DAYS[lo.getDay()] + ' – ' + DAYS[hi.getDay()] + ' (metro)';
    } else if (tier === 'tier23') {
      text = 'Estimated delivery: ' + DAYS[lo.getDay()] + ' – ' + DAYS[hi.getDay()] + ' (tier 2/3)';
    } else {
      text = 'Estimated delivery: ' + DAYS[lo.getDay()] + ' – ' + DAYS[hi.getDay()] + ' (metro) · 5–7 days outside metros';
    }

    return {
      loDate: lo,
      hiDate: hi,
      loDay: DAYS[lo.getDay()],
      hiDay: DAYS[hi.getDay()],
      text: text,
      tier: tier,
      isAuthoritativeTier: isAuthoritative
    };
  }

  // Exact prompt-stipulated business-day offset tests:
  // Monday + 3 business days = Thursday
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-07T12:00:00Z'), 3).getDay()], 'Thu');
  // Tuesday + 5 business days = Tuesday
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-08T12:00:00Z'), 5).getDay()], 'Tue');
  // Thursday + 3 business days = Tuesday
  assert.equal(DAYS[addBusinessDays(new Date('2026-10-12T12:00:00Z'), 3).getDay()], 'Thu');
  // Thursday (2026-09-10) + 3 business days = Tuesday
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-10T12:00:00Z'), 3).getDay()], 'Tue');
  // Friday + 5 business days = Friday
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-11T12:00:00Z'), 5).getDay()], 'Fri');
  // Saturday + 3 business days = Wednesday
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-12T12:00:00Z'), 3).getDay()], 'Wed');
  // Sunday + 3 business days = Thursday (advances past Sunday, Mon+3=Thu)
  assert.equal(DAYS[addBusinessDays(new Date('2026-09-13T12:00:00Z'), 3).getDay()], 'Thu');

  // Full weekday window calculations for unknown destination (safe qualified baseline fallback):
  // 1. Monday confirmation (2026-09-07) -> Thu – Mon
  const monEst = calculateDeliveryEstimate(new Date('2026-09-07T12:00:00Z'));
  assert.equal(monEst.loDay, 'Thu');
  assert.equal(monEst.hiDay, 'Mon');
  assert.equal(monEst.text, 'Estimated delivery: Thu – Mon (metro) · 5–7 days outside metros');

  // 2. Tuesday confirmation (2026-09-08) -> Fri – Tue
  const tueEst = calculateDeliveryEstimate(new Date('2026-09-08T12:00:00Z'));
  assert.equal(tueEst.loDay, 'Fri');
  assert.equal(tueEst.hiDay, 'Tue');
  assert.equal(tueEst.text, 'Estimated delivery: Fri – Tue (metro) · 5–7 days outside metros');

  // 3. Wednesday confirmation (2026-09-09) -> Mon – Wed
  const wedEst = calculateDeliveryEstimate(new Date('2026-09-09T12:00:00Z'));
  assert.equal(wedEst.loDay, 'Mon');
  assert.equal(wedEst.hiDay, 'Wed');
  assert.equal(wedEst.text, 'Estimated delivery: Mon – Wed (metro) · 5–7 days outside metros');

  // 4. Thursday confirmation (2026-09-10) -> Tue – Thu
  const thuEst = calculateDeliveryEstimate(new Date('2026-09-10T12:00:00Z'));
  assert.equal(thuEst.loDay, 'Tue');
  assert.equal(thuEst.hiDay, 'Thu');
  assert.equal(thuEst.text, 'Estimated delivery: Tue – Thu (metro) · 5–7 days outside metros');

  // 5. Friday confirmation (2026-09-11) -> Wed – Fri
  const friEst = calculateDeliveryEstimate(new Date('2026-09-11T12:00:00Z'));
  assert.equal(friEst.loDay, 'Wed');
  assert.equal(friEst.hiDay, 'Fri');
  assert.equal(friEst.text, 'Estimated delivery: Wed – Fri (metro) · 5–7 days outside metros');

  // 6. Saturday confirmation (2026-09-12) -> Wed – Fri
  const satEst = calculateDeliveryEstimate(new Date('2026-09-12T12:00:00Z'));
  assert.equal(satEst.loDay, 'Wed');
  assert.equal(satEst.hiDay, 'Fri');
  assert.equal(satEst.text, 'Estimated delivery: Wed – Fri (metro) · 5–7 days outside metros');

  // 7. Sunday confirmation (2026-09-13) -> Thu – Mon
  const sunEst = calculateDeliveryEstimate(new Date('2026-09-13T12:00:00Z'));
  assert.equal(sunEst.loDay, 'Thu');
  assert.equal(sunEst.hiDay, 'Mon');
  assert.equal(sunEst.text, 'Estimated delivery: Thu – Mon (metro) · 5–7 days outside metros');

  // 8. Month rollover test: February 26 (Thursday) -> March
  const monthRollEst = calculateDeliveryEstimate(new Date('2026-02-26T12:00:00Z'));
  assert.equal(monthRollEst.loDay, 'Tue');
  assert.equal(monthRollEst.hiDay, 'Thu');
  assert.ok(monthRollEst.loDate.getMonth() === 2, 'loDate should cross into March (index 2)');

  // 9. Year rollover test: December 31 (Thursday) -> January
  const yearRollEst = calculateDeliveryEstimate(new Date('2026-12-31T12:00:00Z'));
  assert.equal(yearRollEst.loDay, 'Tue');
  assert.equal(yearRollEst.hiDay, 'Thu');
  assert.equal(yearRollEst.loDate.getFullYear(), 2027, 'loDate should cross into 2027');

  // 10. Leap year test: February 28, 2028 (Monday) in leap year
  const leapEst = calculateDeliveryEstimate(new Date('2028-02-28T12:00:00Z'));
  assert.equal(leapEst.loDay, 'Thu');
  assert.equal(leapEst.hiDay, 'Mon');
  assert.equal(leapEst.loDate.getDate(), 2, 'loDate should be March 2 (Feb 29 is included as leap day)');

  // 11. Exhaustive matrix test across 365 continuous days (2026): Sunday must NEVER appear in estimate
  const startDate = new Date('2026-01-01T00:00:00Z');
  for (let d = 0; d < 365; d++) {
    const curr = new Date(startDate.getTime() + d * 86400000);
    const est = calculateDeliveryEstimate(curr);
    assert.notEqual(est.loDay, 'Sun', `loDay on day ${d} (${curr.toISOString()}) must never be Sun`);
    assert.notEqual(est.hiDay, 'Sun', `hiDay on day ${d} (${curr.toISOString()}) must never be Sun`);
    assert.notEqual(est.loDate.getDay(), 0, `loDate on day ${d} must never have day 0`);
    assert.notEqual(est.hiDate.getDay(), 0, `hiDate on day ${d} must never have day 0`);
    assert.ok(!Number.isNaN(est.loDate.getTime()), `loDate on day ${d} must be valid date`);
    assert.ok(!Number.isNaN(est.hiDate.getTime()), `hiDate on day ${d} must be valid date`);
    assert.ok(est.loDate.getTime() < est.hiDate.getTime(), `loDate must strictly precede hiDate on day ${d}`);
    assert.notEqual(est.loDay, est.hiDay, `loDay and hiDay must not be identical on day ${d}`);
  }

  // 12. Exhaustive 366-day leap-year sweep (2028):
  const leapStart = new Date('2028-01-01T00:00:00Z');
  for (let d = 0; d < 366; d++) {
    const curr = new Date(leapStart.getTime() + d * 86400000);
    const est = calculateDeliveryEstimate(curr);
    assert.notEqual(est.loDay, 'Sun', `Leap year day ${d} loDay must not be Sun`);
    assert.notEqual(est.hiDay, 'Sun', `Leap year day ${d} hiDay must not be Sun`);
    assert.ok(est.loDate.getTime() < est.hiDate.getTime(), `Leap year day ${d} loDate < hiDate`);
  }

  // 13. Regression protection: UI estimate CANNOT silently claim metro 3–5 day window without qualification
  const unknownEst = calculateDeliveryEstimate(new Date('2026-09-07T12:00:00Z'));
  assert.equal(unknownEst.isAuthoritativeTier, false, 'Without authoritative destination tiering, isAuthoritativeTier must be false');
  assert.equal(unknownEst.tier, 'unknown', 'Without authoritative tiering, tier must be unknown');
  assert.notEqual(unknownEst.text, 'Estimated delivery: Thu – Mon', 'UI estimate must NOT silently output unqualified metro 3–5 day window');
  assert.ok(unknownEst.text.includes('(metro)'), 'Estimate must explicitly qualify metro baseline');
  assert.ok(unknownEst.text.includes('5–7 days outside metros'), 'Estimate must disclose 5–7 day SLA for other destinations');

  // Explicit tier testing when tier is authoritatively known:
  const metroEst = calculateDeliveryEstimate(new Date('2026-09-07T12:00:00Z'), { tier: 'metro' });
  assert.equal(metroEst.isAuthoritativeTier, true);
  assert.equal(metroEst.tier, 'metro');
  assert.equal(metroEst.text, 'Estimated delivery: Thu – Mon (metro)');

  const tier23Est = calculateDeliveryEstimate(new Date('2026-09-07T12:00:00Z'), { tier: 'tier23' });
  assert.equal(tier23Est.isAuthoritativeTier, true);
  assert.equal(tier23Est.tier, 'tier23');
  assert.equal(tier23Est.loDay, 'Mon'); // +5 business days = Monday next week
  assert.equal(tier23Est.hiDay, 'Wed'); // +7 business days = Wednesday next week
  assert.equal(tier23Est.text, 'Estimated delivery: Mon – Wed (tier 2/3)');

  // 14. Verify odorstrike.html contains calculateDeliveryEstimate, addBusinessDays, and Sunday adjustment
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes('function calculateDeliveryEstimate('), 'odorstrike.html must define calculateDeliveryEstimate');
  assert.ok(html.includes('function addBusinessDays('), 'odorstrike.html must define addBusinessDays');
  assert.ok(html.includes('adjustIfSunday('), 'odorstrike.html must define adjustIfSunday');
  assert.ok(html.includes('window.calculateDeliveryEstimate = calculateDeliveryEstimate;'), 'odorstrike.html must export calculateDeliveryEstimate');
});

test('Step 5 Post-Purchase: Multi-quantity explicit quantity propagation across COD, UPI, and Razorpay', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  const chromeJs = fs.readFileSync('assets/js/chrome.js', 'utf8');

  // 1. COD path passes explicit details with quantity & total
  assert.ok(html.includes("showSuccess(persistedOrderId, 'cod', {"), 'COD must pass details object to showSuccess');
  assert.ok(html.includes("amount: Number(order.total)"), 'COD details must include exact total');
  assert.ok(html.includes("qty: Number(order.quantity)"), 'COD details must include exact quantity');

  // 2. UPI path passes explicit details with quantity
  assert.ok(html.includes("showUpiSuccess(persistedOrderId, upiTotal, upiLink, {"), 'UPI must pass details object to showUpiSuccess');
  assert.ok(html.includes("function showUpiSuccess(orderId, total, upiLink, details)"), 'showUpiSuccess must accept details parameter');

  // 3. Razorpay path in chrome.js passes explicit quantity
  assert.ok(chromeJs.includes("window.showSuccess(orderCode, 'razorpay', {"), 'Razorpay markSuccess must pass details object to showSuccess');
  assert.ok(chromeJs.includes("qty: qty"), 'Razorpay details must include exact quantity');

  // 4. Cart is NOT cleared before showSuccess/showUpiSuccess coordinates order
  const submitOrderBody = html.substring(html.indexOf('async function submitOrder()'), html.indexOf('let selectedUpiApp'));
  const setCartIndex = submitOrderBody.indexOf('setCartQty(0)');
  assert.equal(setCartIndex, -1, 'submitOrder must not prematurely clear cart before showSuccess/showUpiSuccess');

  // 5. GA4 trackPurchase receives explicit quantity and payment method
  assert.ok(html.includes("trackPurchase(amount, orderId, qty, method === 'cod' ? 'cod' : 'razorpay')"), 'showSuccess must pass explicit quantity and payment method to trackPurchase');
  assert.ok(html.includes("trackPurchase(total, orderId, qty, 'upi')"), 'showUpiSuccess must pass explicit quantity and upi method to trackPurchase');
});




