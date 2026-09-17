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
