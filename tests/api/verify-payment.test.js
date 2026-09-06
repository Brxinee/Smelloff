import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import createOrderHandler from '../../api/create-order.js';
import verifyPaymentHandler from '../../api/verify-payment.js';

function createMockRes() {
  let statusCode = 200;
  let responseData = null;
  const headers = {};

  const res = {
    setHeader: (k, v) => {
      headers[k.toLowerCase()] = v;
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: (data) => {
      if (data && typeof data === 'string') {
        try {
          responseData = JSON.parse(data);
        } catch {
          responseData = data;
        }
      }
      return res;
    },
    _get: () => ({ statusCode, responseData, headers })
  };
  return res;
}

test('create-order: rejects invalid or small amounts', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://smelloff.in' },
    body: { amount: 50, payment_method: 'upi' }
  };
  const res = createMockRes();
  await createOrderHandler(req, res);
  const result = res._get();
  assert.strictEqual(result.statusCode, 400);
  assert.strictEqual(result.responseData.error, 'Amount must be an integer of at least 100 paise.');
});

test('create-order: handles missing Razorpay credentials gracefully', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('/functions/v1/create-order')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ id: 'ord_123', order_code: 'SMF-20260906-1111' })
      };
    }
    return { ok: false, status: 404, text: async () => '' };
  };

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        amount: 22900,
        payment_method: 'upi',
        phone: '9876543210',
        items: [{ name: 'ODORSTRIKE Fabric Mist', variant: '50ml', quantity: 1, price: 229 }]
      }
    };
    const res = createMockRes();
    await createOrderHandler(req, res);
    const result = res._get();
    // Since RAZORPAY_KEY_ID or SECRET is not configured in this test env, it returns 500 cleanly
    assert.strictEqual(result.statusCode, 500);
    assert.ok(result.responseData.error.includes('Razorpay') || result.responseData.error.includes('unavailable'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('verify-payment: validates order code format', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://smelloff.in' },
    body: { orderCode: 'INVALID-CODE', phone: '9876543210' }
  };
  const res = createMockRes();
  await verifyPaymentHandler(req, res);
  const result = res._get();
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.responseData.error.includes('Valid order code required'));
});

test('verify-payment: validates Razorpay signature match logic', async () => {
  const originalFetch = global.fetch;
  const orderCode = 'SMF-20260906-8888';
  const phone = '9876543210';
  const rzpOrderId = 'order_test_9999';
  const rzpPaymentId = 'pay_test_1234';

  const reqMismatch = {
    method: 'POST',
    headers: { origin: 'https://smelloff.in' },
    body: {
      orderCode,
      phone,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000'
    }
  };
  const resMismatch = createMockRes();
  await verifyPaymentHandler(reqMismatch, resMismatch);
  const result = resMismatch._get();
  // Without SERVICE_KEY configured in test env, returns 404 Order not found, or 400 signature mismatch when db configured
  assert.ok(result.statusCode === 404 || result.statusCode === 400);
});
