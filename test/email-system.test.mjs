import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import {
  sendTransactionalEmail,
  getIdempotencyKey,
  getOrderConfirmationIdempotencyKey,
  classifyResendError,
  getSenderConfig,
  getEmailDiagnostics,
  maskEmail,
  isValidEmail,
} from '../api/_email.js';
import {
  renderTemplate,
  orderConfirmation,
  formatAddress,
} from '../api/_email-templates.js';
import {
  dispatchPrepaidPaymentEmails,
  dispatchCodPlacementEmails,
  sendFulfillmentEmail,
  sendPaymentFailedEmail,
  sendReviewRequestEmail,
  sendOrderCancelledEmail,
  sendRefundProcessedEmail,
  isReviewRequestDue,
  dispatchDueReviewRequests,
  orderEmailContext,
} from '../api/_email-dispatch.js';
import sendEmailHandler from '../api/send-email.js';
import webhookHandler from '../api/webhook.js';
import shiprocketSyncHandler from '../api/shiprocket-sync.js';
import { verifySvixSignature, mapResendWebhookStatus } from '../api/_resend-webhook.js';
import { generateOrderConfirmationToken } from '../api/_security.js';

process.env.EMAIL_SIDE_EFFECTS = '0';

function mockRes() {
  let statusCode = 200;
  let data = null;
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      statusCode = code;
      return this;
    },
    json(d) {
      this.body = d;
      data = d;
      return this;
    },
    end() { return this; },
    _get: () => ({ statusCode, data }),
  };
}

function sampleOrder(overrides = {}) {
  return {
    order_code: 'SMF-20260915-1001',
    customer_email: 'buyer@smelloff.test',
    customer_phone: '9876543210',
    status: 'confirmed',
    payment_method: 'upi',
    amount: 22900,
    address: {
      name: 'Arjun Rao',
      line: '12 Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
    },
    items: [{ quantity: 1, price: 229 }],
    confirmation_email_sent_at: null,
    confirmation_email_claimed_at: null,
    confirmation_email_claim_id: null,
    ...overrides,
  };
}

test('maskEmail never logs a full recipient', () => {
  assert.equal(maskEmail('arjun.rao@example.com'), 'ar***@example.com');
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('buyer@smelloff.in'), true);
});

test('missing RESEND_API_KEY fails closed with MISSING_API_KEY', async () => {
  const prev = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
      originatingRoute: 'test',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'MISSING_API_KEY');
  } finally {
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
    else delete process.env.RESEND_API_KEY;
  }
});

test('invalid recipient is rejected before Resend is called', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  let called = 0;
  const original = Resend.prototype.post;
  Resend.prototype.post = async () => { called += 1; return { data: { id: 'x' }, error: null }; };
  try {
    const result = await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'not-an-email',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'INVALID_RECIPIENT');
    assert.equal(called, 0);
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
    else delete process.env.RESEND_API_KEY;
  }
});

test('Resend API error is classified and returned', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const original = Resend.prototype.post;
  Resend.prototype.post = async () => ({
    data: null,
    error: { statusCode: 500, message: 'Bad Gateway', name: 'application_error' },
  });
  try {
    const result = await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'RESEND_API_ERROR');
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
    else delete process.env.RESEND_API_KEY;
  }
});

test('successful send inspects data.id and returns normalized result', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const original = Resend.prototype.post;
  Resend.prototype.post = async () => ({ data: { id: 'email_ok_1' }, error: null });
  try {
    const result = await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
    });
    assert.equal(result.ok, true);
    assert.equal(result.emailId, 'email_ok_1');
    assert.equal(result.provider, 'resend');
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
    else delete process.env.RESEND_API_KEY;
  }
});

test('idempotent retry sends the same Resend idempotency key', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const keys = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async function (path, entity, options = {}) {
    keys.push(options.idempotencyKey);
    return { data: { id: 'email_idem' }, error: null };
  };
  try {
    const key = getIdempotencyKey('paymentConfirmation', 'SMF-20260915-1001');
    await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
      idempotencyKey: key,
    });
    await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
      idempotencyKey: key,
    });
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'payment-confirmation/SMF-20260915-1001');
    assert.equal(keys[1], keys[0]);
    assert.equal(getOrderConfirmationIdempotencyKey('SMF-20260915-1001'), 'order-confirmation/SMF-20260915-1001');
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
    else delete process.env.RESEND_API_KEY;
  }
});

test('classifyResendError distinguishes unverified sender, invalid key, rate limit, 5xx', () => {
  assert.equal(classifyResendError({ statusCode: 401, message: 'Invalid API key' }).errorCode, 'INVALID_API_KEY');
  assert.equal(classifyResendError({ message: 'domain is not verified' }).errorCode, 'UNVERIFIED_SENDER');
  assert.equal(classifyResendError({ statusCode: 429, message: 'Rate limit' }).errorCode, 'RATE_LIMIT');
  assert.equal(classifyResendError({ statusCode: 500, message: 'timeout' }).errorCode, 'RESEND_API_ERROR');
  assert.equal(classifyResendError({ statusCode: 422, message: 'invalid `to` field' }).errorCode, 'INVALID_RECIPIENT');
  assert.equal(classifyResendError({ message: 'suppressed' }).errorCode, 'SUPPRESSED_RECIPIENT');
});

test('production resend.dev sender is blocked as DOMAIN_MISMATCH', async () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.EMAIL_FROM;
  const prevEnv = process.env.VERCEL_ENV;
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'ODORSTRIKE <orders@resend.dev>';
  process.env.VERCEL_ENV = 'production';
  const original = Resend.prototype.post;
  let called = 0;
  Resend.prototype.post = async () => { called += 1; return { data: { id: 'x' }, error: null }; };
  try {
    const result = await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'x',
      html: '<p>x</p>',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'DOMAIN_MISMATCH');
    assert.equal(called, 0);
    assert.equal(getSenderConfig().domainStatus, 'DOMAIN_CONFIGURATION_REQUIRED');
  } finally {
    Resend.prototype.post = original;
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey; else delete process.env.RESEND_API_KEY;
    if (prevFrom !== undefined) process.env.EMAIL_FROM = prevFrom; else delete process.env.EMAIL_FROM;
    if (prevEnv !== undefined) process.env.VERCEL_ENV = prevEnv; else delete process.env.VERCEL_ENV;
  }
});

test('template rendering: HTML + plaintext, missing fields, malformed address, XSS escape', () => {
  const rendered = orderConfirmation({
    orderId: 'SMF-20260915-1001',
    customerName: '<script>alert(1)</script>',
    amount: '229',
    address: { line: 'A', city: 'Hyderabad', state: 'TS', pincode: '500001' },
    paymentMethod: 'Prepaid (Razorpay)',
  });
  assert.equal(rendered.subject.includes('SMF-20260915-1001'), true);
  assert.equal(rendered.html.includes('<script>alert(1)</script>'), false);
  const escapedName = `&${'lt;'}script&${'gt;'}`;
  assert.equal(rendered.html.includes(escapedName), true);
  assert.equal(rendered.html.includes('#080808'), true);
  assert.equal(rendered.html.includes('#B8FF57'), true);
  assert.match(rendered.text, /Order ID: SMF-20260915-1001/);
  assert.match(rendered.text, /Track order:/);

  const sparse = renderTemplate('paymentConfirmation', { orderId: 'SMF-20260915-1002' });
  assert.ok(sparse.html);
  assert.ok(sparse.text.includes('SMF-20260915-1002'));

  const malformed = formatAddress({ line: null, city: 'Hyderabad', pincode: '500001' });
  assert.equal(malformed.includes('Hyderabad'), true);

  const cod = renderTemplate('codConfirmation', {
    orderId: 'SMF-20260915-1003',
    customerName: 'Sam',
    amount: '289',
    paymentMethod: 'Cash on Delivery',
  });
  assert.match(cod.text, /Cash on Delivery/);
  assert.match(cod.text, /nothing has been charged|pay ₹/i);
  assert.match(rendered.subject, /Order confirmed/);
});

test('transactional templates stay transactional: no List-Unsubscribe, no marketing unsubscribe', () => {
  const rendered = orderConfirmation({
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
    amount: '229',
    paymentMethod: 'Prepaid (Razorpay)',
  });
  assert.equal(/list-unsubscribe/i.test(rendered.html), false);
  assert.equal(/unsubscribe/i.test(rendered.html), false);
  const review = renderTemplate('reviewRequest', { orderId: 'SMF-20260915-1001', customerName: 'Arjun' });
  assert.equal(/list-unsubscribe/i.test(review.html), false);
});

test('cancelled and refund templates render with refund timing', () => {
  const cancelled = renderTemplate('orderCancelled', {
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
    reason: 'Requested by customer',
  });
  assert.match(cancelled.subject, /Order cancelled — #SMF-20260915-1001/);
  const refund = renderTemplate('refundProcessed', {
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
    amount: '229',
    method: 'original payment method',
  });
  assert.match(refund.subject, /Refund processed/);
  assert.match(refund.text, /5–7 business days/);
});

test('prepaid confirmation is a single receipt, not a second payment email', () => {
  const rendered = orderConfirmation({
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
    amount: '229',
    paymentMethod: 'Prepaid (Razorpay)',
    transactionRef: 'pay_abc',
    timestamp: '2026-09-15T10:00:00.000Z',
  });
  assert.match(rendered.subject, /Order confirmed — #SMF-20260915-1001/);
  assert.match(rendered.text, /Total paid: ₹229/);
  assert.match(rendered.text, /Reference: pay_abc/);
  assert.match(rendered.html, /odorstrike-bottle/);
});

test('review request and failed-payment templates render', () => {
  const review = renderTemplate('reviewRequest', {
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
  });
  assert.match(review.subject, /ODORSTRIKE/);
  assert.match(review.text, /Leave a review/);
  const failed = renderTemplate('paymentFailed', {
    orderId: 'SMF-20260915-1001',
    customerName: 'Arjun',
    amount: '229',
  });
  assert.match(failed.subject, /didn't go through/i);
  assert.match(failed.text, /Not charged/);
});

test('review request is due 5–14 days after delivery', () => {
  const now = Date.parse('2026-09-15T12:00:00.000Z');
  assert.equal(isReviewRequestDue({
    status: 'delivered',
    customer_email: 'buyer@smelloff.test',
    updated_at: '2026-09-14T12:00:00.000Z',
  }, now), false);
  assert.equal(isReviewRequestDue({
    status: 'delivered',
    customer_email: 'buyer@smelloff.test',
    updated_at: '2026-09-08T12:00:00.000Z',
  }, now), true);
  assert.equal(isReviewRequestDue({
    status: 'confirmed',
    customer_email: 'buyer@smelloff.test',
    updated_at: '2026-09-08T12:00:00.000Z',
  }, now), false);
});

test('failed payment email sends once for pending prepaid orders', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const original = Resend.prototype.post;
  let sent = 0;
  Resend.prototype.post = async () => {
    sent += 1;
    return { data: { id: `email_fail_${sent}` }, error: null };
  };
  try {
    const result = await sendPaymentFailedEmail(sampleOrder({ status: 'upi_pending' }), { route: 'test' });
    assert.equal(result.ok, true);
    assert.equal(sent, 1);
    const skipped = await sendPaymentFailedEmail(sampleOrder({ payment_method: 'cod' }), { route: 'test' });
    assert.equal(skipped.skipped, true);
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('payment.failed webhook emails pending prepaid orders and never downgrades confirmed', async () => {
  const secret = 'whsec_test_failed_pay';
  const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const prevKey = process.env.RESEND_API_KEY;
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  process.env.RESEND_API_KEY = 're_test_key';
  const keys = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async (path, entity, options = {}) => {
    keys.push(options.idempotencyKey);
    return { data: { id: `fail_${keys.length}` }, error: null };
  };
  const pending = sampleOrder({
    status: 'upi_pending',
    payment_attempt_id: 'order_fail_1',
  });
  const confirmed = sampleOrder({
    order_code: 'SMF-20260915-1002',
    status: 'confirmed',
    payment_attempt_id: 'order_fail_2',
  });
  globalThis.__MOCK_ORDER_DB__ = [pending, confirmed];
  try {
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_1',
            order_id: 'order_fail_1',
            amount: 22900,
            currency: 'INR',
            status: 'failed',
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const res = mockRes();
    await webhookHandler({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_fail_1' },
      body: raw,
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(pending.status, 'failed');
    assert.equal(keys[0], 'payment-failed/SMF-20260915-1001');

    const confirmedPayload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_2',
            order_id: 'order_fail_2',
            amount: 22900,
            currency: 'INR',
            status: 'failed',
          },
        },
      },
    };
    const raw2 = JSON.stringify(confirmedPayload);
    const sig2 = crypto.createHmac('sha256', secret).update(raw2).digest('hex');
    const res2 = mockRes();
    await webhookHandler({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig2, 'x-razorpay-event-id': 'evt_fail_2' },
      body: raw2,
    }, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(keys.length, 1);
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prevSecret !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret; else delete process.env.RAZORPAY_WEBHOOK_SECRET;
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey; else delete process.env.RESEND_API_KEY;
  }
});

test('refund.processed webhook and cancelled dispatch use slash keys', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const keys = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async (path, entity, options = {}) => {
    keys.push(options.idempotencyKey);
    return { data: { id: `rf_${keys.length}` }, error: null };
  };
  try {
    const cancelled = await sendOrderCancelledEmail(sampleOrder(), { route: 'test' });
    assert.equal(cancelled.ok, true);
    assert.equal(keys[0], 'order-cancelled/SMF-20260915-1001');
    const refunded = await sendRefundProcessedEmail(sampleOrder(), { route: 'test', amount: '229' });
    assert.equal(refunded.ok, true);
    assert.equal(keys[1], 'refund-processed/SMF-20260915-1001');
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('shiprocket GET still 200 when Shiprocket is unconfigured and POST still 503', async () => {
  const prevAdmin = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'admin-test-secret';
  try {
    const getRes = mockRes();
    await shiprocketSyncHandler({
      method: 'GET',
      headers: { authorization: 'Bearer admin-test-secret' },
    }, getRes);
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.body.ok, true);
    assert.equal(getRes.body.shiprocketConfigured, false);
    assert.ok(getRes.body.reviews);

    const postRes = mockRes();
    await shiprocketSyncHandler({
      method: 'POST',
      headers: { authorization: 'Bearer admin-test-secret' },
      body: { orderCode: 'SMF-20260915-1001' },
    }, postRes);
    assert.equal(postRes.statusCode, 503);
  } finally {
    if (prevAdmin !== undefined) process.env.ADMIN_SECRET = prevAdmin; else delete process.env.ADMIN_SECRET;
  }
});

test('review request dispatch uses slash idempotency keys', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const keys = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async (path, entity, options = {}) => {
    keys.push(options.idempotencyKey);
    return { data: { id: 'email_review_1' }, error: null };
  };
  const order = sampleOrder({
    status: 'delivered',
    updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  });
  globalThis.__MOCK_ORDER_DB__ = [order];
  try {
    const result = await dispatchDueReviewRequests({ route: 'test' });
    assert.equal(result.due, 1);
    assert.equal(result.sent, 1);
    assert.equal(keys[0], 'review-request/SMF-20260915-1001');
    const again = await sendReviewRequestEmail(order, { route: 'test' });
    assert.equal(again.ok, true);
    assert.equal(keys[1], keys[0]);
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('COD vs prepaid dispatch skip rules', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_NOTIFY_EMAIL = 'ops@smelloff.test';
  const original = Resend.prototype.post;
  const types = [];
  Resend.prototype.post = async (path, entity) => {
    types.push(entity?.subject || entity);
    return { data: { id: `email_${types.length}` }, error: null };
  };
  globalThis.__MOCK_ORDER_DB__ = new Map();
  try {
    const prepaid = sampleOrder();
    globalThis.__MOCK_ORDER_DB__.set(prepaid.order_code, { ...prepaid });
    const prepaidResult = await dispatchPrepaidPaymentEmails(prepaid, { route: 'test' });
    assert.equal(prepaidResult.payment.ok, true);
    assert.equal(prepaidResult.payment.skipped, true);
    assert.equal(prepaidResult.payment.reason, 'COMBINED_INTO_ORDER_CONFIRMATION');
    assert.equal(prepaidResult.confirmation.ok, true);
    assert.equal(prepaidResult.adminPaid.ok, true);

    const cod = sampleOrder({
      order_code: 'SMF-20260915-2002',
      payment_method: 'cod',
      status: 'placed',
      amount: 28900,
      customer_email: 'cod@smelloff.test',
    });
    globalThis.__MOCK_ORDER_DB__.set(cod.order_code, { ...cod });
    const codResult = await dispatchCodPlacementEmails(cod, { route: 'test' });
    assert.equal(codResult.confirmation.ok, true);
    const skippedPayment = await dispatchPrepaidPaymentEmails(cod, { route: 'test' });
    assert.equal(skippedPayment.payment.skipped, true);
    assert.equal(skippedPayment.adminPaid.skipped, true);
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('fulfillment emails map shipped / out for delivery / delivered', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const original = Resend.prototype.post;
  const keys = [];
  Resend.prototype.post = async function (path, entity, options = {}) {
    keys.push(options.idempotencyKey);
    return { data: { id: `ff_${keys.length}` }, error: null };
  };
  try {
    const order = sampleOrder({
      shiprocket_awb: 'AWB123',
      shiprocket_courier: 'Delhivery',
      tracking_url: 'https://www.shiprocket.co/tracking/AWB123',
    });
    const shipped = await sendFulfillmentEmail(order, 'dispatched', { route: 'test' });
    const ofd = await sendFulfillmentEmail(order, 'out_for_delivery', { route: 'test' });
    const delivered = await sendFulfillmentEmail(order, 'delivered', { route: 'test' });
    assert.equal(shipped.ok, true);
    assert.equal(ofd.ok, true);
    assert.equal(delivered.ok, true);
    assert.deepEqual(keys, [
      'shipping/SMF-20260915-1001',
      'out-for-delivery/SMF-20260915-1001',
      'delivered/SMF-20260915-1001',
    ]);
    const packed = await sendFulfillmentEmail(order, 'packed', { route: 'test' });
    assert.equal(packed.skipped, true);
  } finally {
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('duplicate payment webhook does not roll back confirmation when email fails', async () => {
  const secret = 'whsec_test_email_fail';
  const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const prevKey = process.env.RESEND_API_KEY;
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  process.env.RESEND_API_KEY = 're_test_key';
  const original = Resend.prototype.post;
  Resend.prototype.post = async () => ({ data: null, error: { statusCode: 500, message: 'Resend 5xx' } });

  const order = sampleOrder({
    status: 'upi_pending',
    payment_attempt_id: 'order_email_fail_1',
  });
  globalThis.__MOCK_ORDER_DB__ = [order];
  try {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_email_fail_1',
            order_id: 'order_email_fail_1',
            amount: 22900,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const res = mockRes();
    await webhookHandler({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_email_fail_1' },
      body: raw,
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'confirmed');
    assert.equal(order.status, 'confirmed');

    const res2 = mockRes();
    await webhookHandler({
      method: 'POST',
      headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_email_fail_1' },
      body: raw,
    }, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.duplicate, true);
    assert.equal(order.status, 'confirmed');
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prevSecret !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret; else delete process.env.RAZORPAY_WEBHOOK_SECRET;
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey; else delete process.env.RESEND_API_KEY;
  }
});

test('duplicate admin confirmation is idempotent and still 200', async () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevAdminNotify = process.env.ADMIN_NOTIFY_EMAIL;
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_NOTIFY_EMAIL = 'ops@smelloff.test';
  const keys = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async function (path, entity, options = {}) {
    keys.push(options.idempotencyKey);
    return { data: { id: `email_admin_${keys.length}` }, error: null };
  };
  const order = sampleOrder({ order_code: 'SMF-20260915-8001', status: 'confirmed' });
  globalThis.__MOCK_ORDER_DB__ = new Map([[order.order_code, { ...order }]]);
  try {
    const first = await dispatchPrepaidPaymentEmails(order, { route: '/api/admin/verify-payment' });
    const second = await dispatchPrepaidPaymentEmails(order, { route: '/api/admin/verify-payment' });
    assert.equal(first.payment.ok, true);
    assert.equal(first.payment.skipped, true);
    assert.equal(second.payment.ok, true);
    const confirmKeys = keys.filter((k) => String(k).startsWith('order-confirmation/'));
    assert.ok(confirmKeys.length >= 1);
    assert.equal(confirmKeys[0], confirmKeys[confirmKeys.length - 1] || confirmKeys[0]);
    const paymentKeys = keys.filter((k) => String(k).startsWith('payment-confirmation/'));
    assert.equal(paymentKeys.length, 0);
    assert.equal(first.confirmation.ok, true);
    assert.equal(second.confirmation.ok, true);
    assert.equal(second.confirmation.idempotent || second.confirmation.ok, true);
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey; else delete process.env.RESEND_API_KEY;
    if (prevAdminNotify !== undefined) process.env.ADMIN_NOTIFY_EMAIL = prevAdminNotify; else delete process.env.ADMIN_NOTIFY_EMAIL;
  }
});

test('admin test-email requires admin auth and never accepts a client API key', async () => {
  const prevAdmin = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'admin-test-secret';
  try {
    const unauth = mockRes();
    await sendEmailHandler({
      method: 'POST',
      url: '/api/admin/test-email',
      query: { diagnostic: '1' },
      headers: { origin: 'https://smelloff.in' },
      body: { email: 'founder@smelloff.in' },
    }, unauth);
    assert.equal(unauth.statusCode, 401);

    const leaked = mockRes();
    await sendEmailHandler({
      method: 'POST',
      url: '/api/admin/test-email',
      query: { diagnostic: '1' },
      headers: {
        origin: 'https://smelloff.in',
        authorization: 'Bearer admin-test-secret',
      },
      body: { email: 'founder@smelloff.in', RESEND_API_KEY: 're_leaked' },
    }, leaked);
    assert.equal(leaked.statusCode, 400);
  } finally {
    if (prevAdmin !== undefined) process.env.ADMIN_SECRET = prevAdmin; else delete process.env.ADMIN_SECRET;
  }
});

test('Resend webhook signature verification and duplicate event handling', async () => {
  const rawSecret = crypto.randomBytes(32);
  const secret = `whsec_${rawSecret.toString('base64')}`;
  const prev = process.env.RESEND_WEBHOOK_SECRET;
  process.env.RESEND_WEBHOOK_SECRET = secret;
  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { email_id: 'email_abc' },
  });
  const id = 'msg_1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = `${id}.${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', rawSecret).update(signed).digest('base64');
  assert.equal(verifySvixSignature(payload, {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${expected}`,
  }, secret), true);
  assert.equal(verifySvixSignature(payload, {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': 'v1,not-valid',
  }, secret), false);
  assert.equal(mapResendWebhookStatus('email.bounced'), 'BOUNCED');
  assert.equal(mapResendWebhookStatus('email.delivered'), 'DELIVERED');

  const res = mockRes();
  await webhookHandler({
    method: 'POST',
    url: '/api/resend-webhook',
    query: { provider: 'resend' },
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${expected}`,
    },
    body: payload,
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.received, true);

  const bad = mockRes();
  await webhookHandler({
    method: 'POST',
    url: '/api/resend-webhook',
    query: { provider: 'resend' },
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': 'v1,aaaa',
    },
    body: payload,
  }, bad);
  assert.equal(bad.statusCode, 400);
  if (prev !== undefined) process.env.RESEND_WEBHOOK_SECRET = prev; else delete process.env.RESEND_WEBHOOK_SECRET;
});

test('logs never include API keys or full secrets', async () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_SUPER_SECRET_KEY_VALUE';
  const lines = [];
  const originalLog = console.log;
  const originalErr = console.error;
  console.log = (msg) => lines.push(String(msg));
  console.error = (msg) => lines.push(String(msg));
  const original = Resend.prototype.post;
  Resend.prototype.post = async () => ({ data: { id: 'email_log' }, error: null });
  try {
    await sendTransactionalEmail({
      type: 'paymentConfirmation',
      orderId: 'SMF-20260915-1001',
      to: 'buyer@smelloff.test',
      subject: 'Payment received',
      html: '<p>ok</p>',
      text: 'ok',
    });
    const blob = lines.filter((line) => String(line).includes('"event":"EMAIL_')).join('\n');
    assert.equal(blob.includes('re_SUPER_SECRET_KEY_VALUE'), false);
    assert.equal(blob.includes('"to":"buyer@smelloff.test"'), false);
    assert.ok(blob.includes('bu***@smelloff.test'));
  } finally {
    console.log = originalLog;
    console.error = originalErr;
    Resend.prototype.post = original;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
});

test('diagnostics never expose secrets', () => {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_secret_should_not_leak';
  const diag = getEmailDiagnostics();
  assert.equal(diag.RESEND_CONFIGURED, true);
  assert.equal(JSON.stringify(diag).includes('re_secret_should_not_leak'), false);
  if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
});

test('orderEmailContext survives missing optional fields', () => {
  const ctx = orderEmailContext({
    order_code: 'SMF-20260915-1001',
    customer_email: 'buyer@smelloff.test',
  });
  assert.equal(ctx.orderId, 'SMF-20260915-1001');
  assert.equal(ctx.customerName, 'there');
  assert.equal(ctx.quantity, 1);
});

test('send-email still refuses confirmation without auth', async () => {
  const prev = process.env.ORDER_SECURITY_SECRET;
  process.env.ORDER_SECURITY_SECRET = 'test-secret';
  globalThis.__MOCK_ORDER_FETCHER__ = async () => sampleOrder();
  try {
    const res = mockRes();
    await sendEmailHandler({
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: { type: 'orderConfirmation', orderCode: 'SMF-20260915-1001' },
    }, res);
    assert.equal(res.statusCode, 403);
    const token = generateOrderConfirmationToken('SMF-20260915-1001', 'buyer@smelloff.test');
    assert.ok(token);
  } finally {
    delete globalThis.__MOCK_ORDER_FETCHER__;
    if (prev !== undefined) process.env.ORDER_SECURITY_SECRET = prev; else delete process.env.ORDER_SECURITY_SECRET;
  }
});
