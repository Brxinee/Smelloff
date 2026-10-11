import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/create-order.js';

function makeResponse() {
  let statusCode = 200;
  let responseData = null;
  return {
    response: {
      setHeader: () => {},
      status(code) {
        statusCode = code;
        return {
          json(data) { responseData = data; },
          end(data) { responseData = data; },
        };
      },
    },
    result() { return { statusCode, responseData }; },
  };
}

function validBody(overrides = {}) {
  return {
    amount: 22900,
    email: 'buyer@smelloff.test',
    phone: '9392974031',
    items: [{
      name: 'ODORSTRIKE Fabric Mist',
      variant: '50ml',
      quantity: 1,
      price: 229,
    }],
    address: {
      name: 'Test Buyer',
      line: '1 Test Street',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500018',
    },
    order_code: 'SMF-20260917-1234',
    ...overrides,
  };
}

const originalEnv = {
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function setTestEnv() {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function jsonResponse(data, status = 200) {
  const text = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async text() { return text; },
  };
}

test('create-order rejects an incomplete delivery address before any upstream work', async () => {
  setTestEnv();
  try {
    const { response, result } = makeResponse();
    await handler(
      { method: 'POST', headers: { origin: 'https://smelloff.in' }, body: validBody({ address: { name: 'Test Buyer' } }) },
      response,
    );
    assert.equal(result().statusCode, 400);
    assert.equal(result().responseData.error, 'A complete delivery address is required.');
  } finally {
    restoreEnv();
  }
});

test('create-order rejects a client amount that does not match canonical pricing', async () => {
  setTestEnv();
  try {
    const { response, result } = makeResponse();
    await handler(
      { method: 'POST', headers: { origin: 'https://smelloff.in' }, body: validBody({ amount: 1 }) },
      response,
    );
    assert.equal(result().statusCode, 400);
    assert.equal(result().responseData.error, 'Order amount mismatch. Please refresh and try again.');
  } finally {
    restoreEnv();
  }
});

test('create-order returns 503 when the order database is unavailable', async () => {
  setTestEnv();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('Network failure');
  };

  try {
    const { response, result } = makeResponse();
    await handler(
      { method: 'POST', headers: { origin: 'https://smelloff.in' }, body: validBody() },
      response,
    );
    assert.equal(result().statusCode, 503);
    assert.equal(result().responseData.error, 'Order database is temporarily unavailable. Please try again.');
  } finally {
    global.fetch = originalFetch;
    restoreEnv();
  }
});

test('create-order persists a database-valid prepaid method instead of pending', async () => {
  setTestEnv();
  const originalFetch = global.fetch;
  const originalRazorpayMock = globalThis.__MOCK_RAZORPAY_ORDER_CREATE__;
  let insertedBody = null;
  let call = 0;

  global.fetch = async (url, options = {}) => {
    call += 1;
    const method = options.method || 'GET';

    if (method === 'GET' && String(url).includes('/rest/v1/orders?order_code=')) {
      return jsonResponse([]);
    }

    if (method === 'POST' && String(url).endsWith('/rest/v1/orders')) {
      insertedBody = JSON.parse(options.body);
      return jsonResponse([{
        id: 'db-order-1',
        order_code: 'SMF-20260917-1234',
        customer_email: insertedBody.customer_email,
        customer_phone: insertedBody.customer_phone,
        amount: insertedBody.amount,
        payment_attempt_id: null,
      }], 201);
    }

    if (method === 'PATCH' && String(url).includes('/rest/v1/orders?order_code=')) {
      const body = JSON.parse(options.body);
      return jsonResponse([{
        id: 'db-order-1',
        order_code: 'SMF-20260917-1234',
        customer_email: 'buyer@smelloff.test',
        customer_phone: '9392974031',
        amount: 22900,
        payment_attempt_id: body.payment_attempt_id,
      }]);
    }

    throw new Error(`Unexpected fetch call ${call}: ${method} ${url}`);
  };

  globalThis.__MOCK_RAZORPAY_ORDER_CREATE__ = async (params) => ({
    id: 'order_test_123',
    amount: params.amount,
    currency: params.currency,
  });

  try {
    const { response, result } = makeResponse();
    await handler(
      { method: 'POST', headers: { origin: 'https://smelloff.in' }, body: validBody() },
      response,
    );

    assert.equal(result().statusCode, 200);
    assert.equal(insertedBody.payment_method, 'upi');
    assert.equal(insertedBody.status, 'upi_pending');
    assert.notEqual(insertedBody.payment_method, 'pending');
    assert.equal(result().responseData.order_id, 'order_test_123');
  } finally {
    global.fetch = originalFetch;
    if (originalRazorpayMock === undefined) delete globalThis.__MOCK_RAZORPAY_ORDER_CREATE__;
    else globalThis.__MOCK_RAZORPAY_ORDER_CREATE__ = originalRazorpayMock;
    restoreEnv();
  }
});
