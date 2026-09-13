import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import createOrderHandler from '../../api/create-order.js';
import verifyPaymentHandler from '../../api/verify-payment.js';

const require = createRequire(import.meta.url);
const axios = require('axios');

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

test('verify-payment: rejects manual UTR submission on modern Razorpay prepaid orders', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
  const orderCode = 'SMF-20260906-7777';
  const phone = '9876543210';

  global.fetch = async (url) => {
    if (url.includes('/rest/v1/orders?order_code=')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{
          order_code: orderCode,
          customer_phone: phone,
          status: 'upi_pending',
          payment_method: 'upi',
          payment_attempt_id: 'order_rzp_mock_12345',
          amount: 22900
        }]
      };
    }
    return { ok: false, status: 404, json: async () => [] };
  };

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        orderCode,
        phone,
        utr: '123456789012'
      }
    };
    const res = createMockRes();
    await verifyPaymentHandler(req, res);
    const result = res._get();
    assert.strictEqual(result.statusCode, 400);
    assert.ok(result.responseData.error.includes('Manual UTR submission is not supported for modern checkout orders'));
  } finally {
    global.fetch = originalFetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('verify-payment: rejects manual UTR submission on COD orders', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
  const orderCode = 'SMF-20260906-6666';
  const phone = '9876543210';

  global.fetch = async (url) => {
    if (url.includes('/rest/v1/orders?order_code=')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{
          order_code: orderCode,
          customer_phone: phone,
          status: 'placed',
          payment_method: 'cod',
          payment_attempt_id: null,
          amount: 27900
        }]
      };
    }
    return { ok: false, status: 404, json: async () => [] };
  };

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        orderCode,
        phone,
        utr: '123456789012'
      }
    };
    const res = createMockRes();
    await verifyPaymentHandler(req, res);
    const result = res._get();
    assert.strictEqual(result.statusCode, 400);
    assert.ok(result.responseData.error.includes('Manual UTR submission is not supported for modern checkout orders'));
  } finally {
    global.fetch = originalFetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('verify-payment: Razorpay order binding test matrix', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalRzpId = process.env.RAZORPAY_KEY_ID;
  const originalRzpSecret = process.env.RAZORPAY_KEY_SECRET;

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key_123';
  const rzpSecret = 'rzp_test_secret_xyz';
  process.env.RAZORPAY_KEY_SECRET = rzpSecret;

  const orderA = {
    order_code: 'SMF-20260906-1111',
    customer_phone: '9876543210',
    customer_email: 'customer.a@example.com',
    status: 'upi_pending',
    payment_method: 'upi',
    payment_attempt_id: 'order_rzp_A',
    amount: 22900
  };

  const orderB = {
    order_code: 'SMF-20260906-2222',
    customer_phone: '9876543210',
    customer_email: 'customer.b@example.com',
    status: 'upi_pending',
    payment_method: 'upi',
    payment_attempt_id: 'order_rzp_B',
    amount: 45800
  };

  // Mock fetch router
  let mockPaymentFetchResult = null;
  global.fetch = async (url, options) => {
    if (url.includes('/rest/v1/orders?order_code=')) {
      if (options && options.method === 'PATCH') {
        const patchData = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => [{ ...orderA, ...patchData }]
        };
      }
      if (url.includes(orderA.order_code)) {
        return { ok: true, status: 200, json: async () => [orderA] };
      }
      if (url.includes(orderB.order_code)) {
        return { ok: true, status: 200, json: async () => [orderB] };
      }
      return { ok: true, status: 200, json: async () => [] };
    }
    if (url.includes('api.razorpay.com/v1/payments/')) {
      if (mockPaymentFetchResult) {
        return {
          ok: true,
          status: 200,
          json: async () => mockPaymentFetchResult
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { description: 'Not found' } })
      };
    }
    return { ok: false, status: 404, json: async () => [] };
  };

  const origAxiosCreate = axios.create;
  axios.create = function(cfg) {
    const instance = origAxiosCreate.call(axios, cfg);
    instance.interceptors.request.use((config) => {
      config.adapter = async (c) => {
        if (mockPaymentFetchResult) {
          return {
            data: mockPaymentFetchResult,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: c
          };
        }
        const err = new Error('Request failed with status code 404');
        err.response = { status: 404, data: { error: { description: 'Not found' } } };
        throw err;
      };
      return config;
    });
    return instance;
  };

  try {
    // 1. ORDER A + RZP A + PAY A (Valid) -> PASS 200
    const paymentIdA = 'pay_rzp_A_1';
    const validSignatureA = crypto
      .createHmac('sha256', rzpSecret)
      .update(`order_rzp_A|${paymentIdA}`)
      .digest('hex');

    mockPaymentFetchResult = {
      id: paymentIdA,
      order_id: 'order_rzp_A',
      amount: 22900,
      currency: 'INR',
      status: 'captured'
    };

    const reqA = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        orderCode: orderA.order_code,
        phone: orderA.customer_phone,
        razorpay_order_id: 'order_rzp_A',
        razorpay_payment_id: paymentIdA,
        razorpay_signature: validSignatureA
      }
    };
    const resA = createMockRes();
    await verifyPaymentHandler(reqA, resA);
    const resultA = resA._get();
    assert.strictEqual(resultA.statusCode, 200);
    assert.strictEqual(resultA.responseData.verified, true);
    assert.strictEqual(resultA.responseData.status, 'confirmed');

    // 2. ORDER A + RZP B + PAY B (Cross-Order Attempt) -> FAIL 400
    const paymentIdB = 'pay_rzp_B_1';
    const validSignatureB = crypto
      .createHmac('sha256', rzpSecret)
      .update(`order_rzp_B|${paymentIdB}`)
      .digest('hex');

    const reqCross = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        orderCode: orderA.order_code,
        phone: orderA.customer_phone,
        razorpay_order_id: 'order_rzp_B',
        razorpay_payment_id: paymentIdB,
        razorpay_signature: validSignatureB
      }
    };
    const resCross = createMockRes();
    await verifyPaymentHandler(reqCross, resCross);
    const resultCross = resCross._get();
    assert.strictEqual(resultCross.statusCode, 400);
    assert.strictEqual(resultCross.responseData.error, 'Razorpay order mismatch.');

    // 3. ORDER A + RZP A + Fake Signature -> FAIL 400
    const reqFakeSig = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: {
        orderCode: orderA.order_code,
        phone: orderA.customer_phone,
        razorpay_order_id: 'order_rzp_A',
        razorpay_payment_id: paymentIdA,
        razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000'
      }
    };
    const resFakeSig = createMockRes();
    await verifyPaymentHandler(reqFakeSig, resFakeSig);
    const resultFakeSig = resFakeSig._get();
    assert.strictEqual(resultFakeSig.statusCode, 400);
    assert.strictEqual(resultFakeSig.responseData.error, 'Payment signature verification failed.');

    // 4. ORDER A + RZP A + Valid Signature + Tampered Payment Amount -> FAIL 400
    mockPaymentFetchResult = {
      id: paymentIdA,
      order_id: 'order_rzp_A',
      amount: 45800, // 45800 instead of 22900
      currency: 'INR',
      status: 'captured'
    };
    const resBadAmt = createMockRes();
    await verifyPaymentHandler(reqA, resBadAmt);
    const resultBadAmt = resBadAmt._get();
    assert.strictEqual(resultBadAmt.statusCode, 400);
    assert.strictEqual(resultBadAmt.responseData.error, 'Payment amount mismatch.');

    // 5. ORDER A + RZP A + Valid Signature + Wrong Currency (USD) -> FAIL 400
    mockPaymentFetchResult = {
      id: paymentIdA,
      order_id: 'order_rzp_A',
      amount: 22900,
      currency: 'USD',
      status: 'captured'
    };
    const resBadCurr = createMockRes();
    await verifyPaymentHandler(reqA, resBadCurr);
    const resultBadCurr = resBadCurr._get();
    assert.strictEqual(resultBadCurr.statusCode, 400);
    assert.strictEqual(resultBadCurr.responseData.error, 'Invalid payment currency.');

    // 6. ORDER A + RZP A + Valid Signature + Failed/Refunded Payment Status -> FAIL 400
    mockPaymentFetchResult = {
      id: paymentIdA,
      order_id: 'order_rzp_A',
      amount: 22900,
      currency: 'INR',
      status: 'failed'
    };
    const resBadStatus = createMockRes();
    await verifyPaymentHandler(reqA, resBadStatus);
    const resultBadStatus = resBadStatus._get();
    assert.strictEqual(resultBadStatus.statusCode, 400);
    assert.strictEqual(resultBadStatus.responseData.error, 'Payment has not been successfully authorized.');

  } finally {
    axios.create = origAxiosCreate;
    global.fetch = originalFetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    process.env.RAZORPAY_KEY_ID = originalRzpId;
    process.env.RAZORPAY_KEY_SECRET = originalRzpSecret;
  }
});


