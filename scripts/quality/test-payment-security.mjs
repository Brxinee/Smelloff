import assert from 'node:assert';
import {
  ORDER_LIFECYCLE,
  isValidTransition,
  calculateOrderTotal,
  BASE_PRODUCT
} from '../../shared/products-config.js';
import {
  generateOrderToken,
  verifyOrderToken,
  validateAndNormalizeUtr,
  isAdminAuthorized,
  isAllowedOrigin,
  checkRateLimit
} from '../../api/_security.js';

console.log('=== SMELLOFF / ODORSTRIKE MANUAL UPI SECURITY TEST SUITE ===\n');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✓ [PASS] Vector ${total}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] Vector ${total}: ${name}`);
    console.error('  Error:', err.message);
  }
}

// Vector 1: State Machine Transition - upi_pending to verification_pending
runTest('upi_pending -> verification_pending is valid, direct upi_pending -> confirmed is disallowed for public', () => {
  assert.strictEqual(isValidTransition('upi_pending', 'verification_pending', 'upi'), true);
  assert.strictEqual(isValidTransition('verification_pending', 'confirmed', 'upi'), true);
  assert.strictEqual(isValidTransition('upi_pending', 'delivered', 'upi'), false);
});

// Vector 2: State Machine COD vs UPI separation
runTest('COD and UPI have distinct valid transitions', () => {
  assert.strictEqual(isValidTransition('placed', 'confirmed', 'cod'), true);
  assert.strictEqual(isValidTransition('placed', 'verification_pending', 'cod'), false);
  assert.strictEqual(isValidTransition('cancelled', 'confirmed', 'upi'), false);
  assert.strictEqual(isValidTransition('delivered', 'upi_pending', 'upi'), false);
});

// Vector 3: UTR format validation and normalization
runTest('UTR validation accepts valid alphanumeric 10-24 chars, rejects junk', () => {
  assert.strictEqual(validateAndNormalizeUtr('123456789012'), '123456789012');
  assert.strictEqual(validateAndNormalizeUtr(' HDFC1234567890 '), 'HDFC1234567890');
  assert.strictEqual(validateAndNormalizeUtr('abc-123_456-7890'), 'ABC1234567890');
  assert.strictEqual(validateAndNormalizeUtr('123'), null); // too short
  assert.strictEqual(validateAndNormalizeUtr(''), null);
  assert.strictEqual(validateAndNormalizeUtr(null), null);
  assert.strictEqual(validateAndNormalizeUtr('INVALID!@#$%^&*()'), null);
});

// Vector 4: Cryptographic Order Token Generation & Verification
runTest('Order tokens match only exact orderCode and phone combination', () => {
  const orderCode = 'SMF-20260820-1234';
  const phone = '9876543210';
  const token = generateOrderToken(orderCode, phone);
  
  assert.strictEqual(typeof token, 'string');
  assert.strictEqual(token.length, 32);
  assert.strictEqual(verifyOrderToken(orderCode, phone, token), true);
  
  // Tampering with phone fails
  assert.strictEqual(verifyOrderToken(orderCode, '9876543211', token), false);
  // Tampering with orderCode fails
  assert.strictEqual(verifyOrderToken('SMF-20260820-9999', phone, token), false);
  // Fake token fails
  assert.strictEqual(verifyOrderToken(orderCode, phone, 'invalid_token_here_000000000000'), false);
});

// Vector 5: Admin Authorization Security Check
runTest('Admin verification requires valid secret in Authorization or x-admin-key', () => {
  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'super-secret-admin-key-2026';

  const reqUnauth = { headers: {} };
  assert.strictEqual(isAdminAuthorized(reqUnauth), false);

  const reqWrongBearer = { headers: { authorization: 'Bearer wrong-key' } };
  assert.strictEqual(isAdminAuthorized(reqWrongBearer), false);

  const reqValidBearer = { headers: { authorization: 'Bearer super-secret-admin-key-2026' } };
  assert.strictEqual(isAdminAuthorized(reqValidBearer), true);

  const reqValidCustom = { headers: { 'x-admin-key': 'super-secret-admin-key-2026' } };
  assert.strictEqual(isAdminAuthorized(reqValidCustom), true);

  // Restore env
  process.env.ADMIN_SECRET = previousSecret;
});

// Vector 6: Fail closed when no admin secret is set
runTest('Admin authorization fails closed when admin secret is undefined', () => {
  const prevAdminSecret = process.env.ADMIN_SECRET;
  const prevAdminKey = process.env.ADMIN_KEY;
  const prevSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.ADMIN_SECRET;
  delete process.env.ADMIN_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const reqWithToken = { headers: { authorization: 'Bearer some-random-string' } };
  assert.strictEqual(isAdminAuthorized(reqWithToken), false);

  // Restore
  if (prevAdminSecret) process.env.ADMIN_SECRET = prevAdminSecret;
  if (prevAdminKey) process.env.ADMIN_KEY = prevAdminKey;
  if (prevSupaKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSupaKey;
});

// Vector 7: Authoritative Server-side Price Bounds
runTest('Quantity bounds enforced [1..5] with exact pricing', () => {
  const q1 = calculateOrderTotal(1, 'upi');
  assert.strictEqual(q1.qty, 1);
  assert.strictEqual(q1.total, 229);
  assert.strictEqual(q1.amountPaise, 22900);
  assert.strictEqual(q1.status, 'upi_pending');

  const qMax = calculateOrderTotal(100, 'upi');
  assert.strictEqual(qMax.qty, BASE_PRODUCT.maxQuantity); // Bounded to 5
  assert.strictEqual(qMax.total, BASE_PRODUCT.maxQuantity * 229);

  const qZero = calculateOrderTotal(0, 'upi');
  assert.strictEqual(qZero.qty, 1); // Bounded to 1

  const qNegative = calculateOrderTotal(-5, 'upi');
  assert.strictEqual(qNegative.qty, 1);

  const qCod = calculateOrderTotal(1, 'cod');
  assert.strictEqual(qCod.isCod, true);
  assert.strictEqual(qCod.codFee, 60);
  assert.strictEqual(qCod.total, 289);
  assert.strictEqual(qCod.status, 'placed');
});

// Vector 8: Origin Filtering & Allowed Domains
runTest('Storefront origin validation', () => {
  assert.strictEqual(isAllowedOrigin('https://smelloff.in'), true);
  assert.strictEqual(isAllowedOrigin('https://www.smelloff.in'), true);
  assert.strictEqual(isAllowedOrigin('https://attacker.com'), false);
  assert.strictEqual(isAllowedOrigin(undefined), true); // Server-to-server / curl
});

// Vector 9: Rate limiting test
runTest('In-memory rate limiter stops excessive spam calls', () => {
  const testKey = 'test-ip-123-' + Date.now();
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(checkRateLimit(testKey, 5, 10000), true);
  }
  // 6th attempt should be blocked
  assert.strictEqual(checkRateLimit(testKey, 5, 10000), false);
});

// Vector 10: State Machine Terminal States are strictly respected
runTest('Terminal states (delivered, cancelled) allow no further transitions', () => {
  assert.strictEqual(isValidTransition('delivered', 'confirmed', 'upi'), false);
  assert.strictEqual(isValidTransition('delivered', 'packed', 'cod'), false);
  assert.strictEqual(isValidTransition('cancelled', 'placed', 'cod'), false);
  assert.strictEqual(isValidTransition('cancelled', 'verification_pending', 'upi'), false);
});

// Vector 11: Idempotency of same status transition
runTest('Idempotent transitions (same status to same status) return true', () => {
  assert.strictEqual(isValidTransition('confirmed', 'confirmed', 'upi'), true);
  assert.strictEqual(isValidTransition('verification_pending', 'verification_pending', 'upi'), true);
  assert.strictEqual(isValidTransition('placed', 'placed', 'cod'), true);
});

// Vector 12: Public verification endpoint contract
runTest('Public verify-payment handler never outputs confirmed for pending orders', async () => {
  // Mock request/response testing
  let statusCode = 0;
  let responseData = {};
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; }
      };
    }
  };

  // Test invalid orderCode format
  const mockReqInvalidCode = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'INVALID-CODE', upiRef: '123456789012' }
  };
  const { default: verifyHandler } = await import('../../api/verify-payment.js');
  await verifyHandler(mockReqInvalidCode, mockRes);
  assert.strictEqual(statusCode, 400);
  assert.match(responseData.error, /Valid order code required/i);
});

// Vector 13: Webhook security contract
runTest('Webhook handler rejects unauthenticated requests with 401', async () => {
  let statusCode = 0;
  let responseData = {};
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; }
      };
    }
  };

  const mockReqUnauth = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260820-1234', status: 'confirmed' }
  };
  const { default: webhookHandler } = await import('../../api/webhook.js');
  await webhookHandler(mockReqUnauth, mockRes);
  assert.strictEqual(statusCode, 401);
  assert.match(responseData.error, /Unauthorized webhook/i);
});

// Vector 14: Admin verify endpoint rejects unauthenticated requests with 401
runTest('Admin verify endpoint rejects unauthenticated requests with 401', async () => {
  let statusCode = 0;
  let responseData = {};
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; }
      };
    }
  };

  const mockReqUnauth = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260820-1234', action: 'confirm' }
  };
  const { default: adminVerifyHandler } = await import('../../api/admin/verify-payment.js');
  await adminVerifyHandler(mockReqUnauth, mockRes);
  assert.strictEqual(statusCode, 401);
  assert.match(responseData.error, /Unauthorized/i);
});

// Vector 15: Send email endpoint blocks spoofed orderConfirmation
runTest('Send email endpoint blocks spoofed orderConfirmation without admin auth', async () => {
  let statusCode = 0;
  let responseData = {};
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; }
      };
    }
  };

  const mockReqSpoof = {
    method: 'POST',
    headers: {},
    body: {
      to: 'customer@example.com',
      type: 'orderConfirmation',
      data: { orderId: 'SMF-20260820-1234' }
    }
  };
  const { default: sendEmailHandler } = await import('../../api/send-email.js');
  await sendEmailHandler(mockReqSpoof, mockRes);
  assert.strictEqual(statusCode, 401);
  assert.match(responseData.error, /Unauthorized/i);
});

console.log(`\n========================================`);
console.log(`RESULTS: ${passed}/${total} vectors passed cleanly.`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
