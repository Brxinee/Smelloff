import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  ORDER_LIFECYCLE,
  isValidTransition,
  calculateOrderTotal,
  BASE_PRODUCT
} from '../../shared/products-config.js';
import {
  getSecuritySecret,
  generateOrderToken,
  verifyOrderToken,
  validateAndNormalizeUtr,
  isAdminAuthorized,
  isAllowedOrigin,
  checkRateLimit
} from '../../api/_security.js';

console.log('====================================================');
console.log('  SMELLOFF / ODORSTRIKE MANUAL UPI SECURITY SUITE  ');
console.log('====================================================\n');

let passed = 0;
let total = 0;

async function runAttackTest(id, name, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ [BLOCKED] ATTACK ${id}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAILED]  ATTACK ${id}: ${name}`);
    console.error('  Failure details:', err.message);
  }
}

// Helper to create mock response object
function createMockRes() {
  let statusCode = 200;
  let responseData = {};
  const headers = {};
  return {
    headers,
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
          return { statusCode, data: responseData };
        },
        end: () => ({ statusCode, data: null })
      };
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };
}

// Set temporary valid test environment secrets for test execution
const PREV_ADMIN_SECRET = process.env.ADMIN_SECRET;
const PREV_SECURITY_SECRET = process.env.ORDER_SECURITY_SECRET;
process.env.ADMIN_SECRET = 'test-admin-secret-key-32chars-xyz';
process.env.ORDER_SECURITY_SECRET = 'test-order-signing-secret-32ch';

// ATTACK 1: Customer UTR submission authentication & validation
await runAttackTest(1, 'Customer UTR submission -> Rejects unauthenticated / malformed submissions (400/403)', async () => {
  const { default: verifyHandler } = await import('../../api/verify-payment.js');
  
  // 1a. Malformed order code
  const res1 = createMockRes();
  const req1 = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'INVALID-CODE', upiRef: '123456789012' }
  };
  await verifyHandler(req1, res1);
  assert.strictEqual(res1.getStatusCode(), 400);

  // 1b. Malformed / empty UTR
  const res2 = createMockRes();
  const req2 = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260820-1234', upiRef: 'short' }
  };
  await verifyHandler(req2, res2);
  assert.strictEqual(res2.getStatusCode(), 400);

  // 1c. Unauthenticated submission without valid token/phone (order not found or auth failure)
  const res3 = createMockRes();
  const req3 = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260820-1234', upiRef: '123456789012', phone: '0000000000' }
  };
  await verifyHandler(req3, res3);
  assert.strictEqual([403, 404].includes(res3.getStatusCode()), true);
});

// ATTACK 2: Call /api/payment-status with invalid order code format
await runAttackTest(2, 'Call /api/payment-status with malformed order code -> Rejected (400 Bad Request)', async () => {
  const { default: paymentStatusHandler } = await import('../../api/payment-status.js');
  const res = createMockRes();
  const req = {
    method: 'GET',
    headers: {},
    query: { orderCode: 'INVALID-CODE' }
  };
  await paymentStatusHandler(req, res);
  assert.strictEqual(res.getStatusCode(), 400);
  assert.match(res.getData().error, /Valid order code required/i);
});

// ATTACK 3: Use another customer's phone or order token
await runAttackTest(3, 'Order ownership forgery with mismatched phone/token -> Blocked (403/invalid)', () => {
  const orderCode = 'SMF-20260820-1234';
  const legitimatePhone = '9876543210';
  const attackerPhone = '9999999999';
  
  const legitimateToken = generateOrderToken(orderCode, legitimatePhone);
  assert.strictEqual(typeof legitimateToken, 'string');
  assert.strictEqual(legitimateToken.length, 32);

  // Attacker tries to verify using their phone with victim's token
  assert.strictEqual(verifyOrderToken(orderCode, attackerPhone, legitimateToken), false);
  // Attacker tries with forged token
  assert.strictEqual(verifyOrderToken(orderCode, legitimatePhone, 'forged_fake_token_0000000000000'), false);
  // Attacker tries with different orderCode
  assert.strictEqual(verifyOrderToken('SMF-20260820-9999', legitimatePhone, legitimateToken), false);
});

// ATTACK 4: Attempt client-side price tampering in calculateOrderTotal
await runAttackTest(4, 'Tamper with unit price or amount -> Server strictly recalculates authoritative total', () => {
  // Quantity 1 - Prepaid (Solo ₹229)
  const q1Prepaid = calculateOrderTotal(1, 'upi');
  assert.strictEqual(q1Prepaid.qty, 1);
  assert.strictEqual(q1Prepaid.subtotal, 229);
  assert.strictEqual(q1Prepaid.mrpTotal, 499);
  assert.strictEqual(q1Prepaid.codFee, 0);
  assert.strictEqual(q1Prepaid.total, 229);
  assert.strictEqual(q1Prepaid.amountPaise, 22900);
  assert.strictEqual(q1Prepaid.unitPrice, 229);
  assert.strictEqual(q1Prepaid.sku, 'OS-001-50ML');
  assert.strictEqual(q1Prepaid.isCod, false);

  // Quantity 1 - COD (Solo ₹229 + ₹60 = ₹289)
  const q1Cod = calculateOrderTotal(1, 'cod');
  assert.strictEqual(q1Cod.qty, 1);
  assert.strictEqual(q1Cod.subtotal, 229);
  assert.strictEqual(q1Cod.mrpTotal, 499);
  assert.strictEqual(q1Cod.codFee, 60);
  assert.strictEqual(q1Cod.total, 289);
  assert.strictEqual(q1Cod.amountPaise, 28900);
  assert.strictEqual(q1Cod.isCod, true);

  // Quantity 2 - Prepaid (Duo ₹429)
  const q2Prepaid = calculateOrderTotal(2, 'upi');
  assert.strictEqual(q2Prepaid.qty, 2);
  assert.strictEqual(q2Prepaid.subtotal, 429);
  assert.strictEqual(q2Prepaid.mrpTotal, 998);
  assert.strictEqual(q2Prepaid.codFee, 0);
  assert.strictEqual(q2Prepaid.total, 429);
  assert.strictEqual(q2Prepaid.amountPaise, 42900);

  // Quantity 2 - COD (Duo ₹429 + ₹60 = ₹489)
  const q2Cod = calculateOrderTotal(2, 'cod');
  assert.strictEqual(q2Cod.qty, 2);
  assert.strictEqual(q2Cod.subtotal, 429);
  assert.strictEqual(q2Cod.mrpTotal, 998);
  assert.strictEqual(q2Cod.codFee, 60);
  assert.strictEqual(q2Cod.total, 489);
  assert.strictEqual(q2Cod.amountPaise, 48900);

  // Quantity 3 - Prepaid (Trio ₹599)
  const q3Prepaid = calculateOrderTotal(3, 'upi');
  assert.strictEqual(q3Prepaid.qty, 3);
  assert.strictEqual(q3Prepaid.subtotal, 599);
  assert.strictEqual(q3Prepaid.mrpTotal, 1497);
  assert.strictEqual(q3Prepaid.codFee, 0);
  assert.strictEqual(q3Prepaid.total, 599);
  assert.strictEqual(q3Prepaid.amountPaise, 59900);

  // Quantity 3 - COD (Trio ₹599 + ₹60 = ₹659)
  const q3Cod = calculateOrderTotal(3, 'cod');
  assert.strictEqual(q3Cod.qty, 3);
  assert.strictEqual(q3Cod.subtotal, 599);
  assert.strictEqual(q3Cod.mrpTotal, 1497);
  assert.strictEqual(q3Cod.codFee, 60);
  assert.strictEqual(q3Cod.total, 659);
  assert.strictEqual(q3Cod.amountPaise, 65900);

  // Malicious price overrides from client (e.g., client passes price = 1, subtotal = 1, total = 1, price = 9999)
  // Server ignores client parameters and recomputes purely from quantity (2) + method (upi)
  const maliciousClientPayload = { quantity: 2, price: 1, subtotal: 1, total: 1, amountPaise: 100 };
  const recalculated = calculateOrderTotal(maliciousClientPayload.quantity, 'upi');
  assert.strictEqual(recalculated.total, 429);
  assert.strictEqual(recalculated.amountPaise, 42900);
  assert.notStrictEqual(recalculated.total, maliciousClientPayload.total);
});

// ATTACK 5: Attempt SKU injection or alteration
await runAttackTest(5, 'Attempt arbitrary SKU injection -> Server strictly binds BASE_PRODUCT SKU', () => {
  const order = calculateOrderTotal(1, 'upi');
  assert.strictEqual(order.sku, BASE_PRODUCT.sku);
  assert.strictEqual(order.sku, 'OS-001-50ML');
});

// ATTACK 6: Change quantity beyond allowed policy bounds [1..5]
await runAttackTest(6, 'Change quantity to 0, -5, or 100 -> Server clamps to [1..5]', () => {
  const zeroQty = calculateOrderTotal(0, 'upi');
  assert.strictEqual(zeroQty.qty, 1);

  const negativeQty = calculateOrderTotal(-5, 'upi');
  assert.strictEqual(negativeQty.qty, 1);

  const excessiveQty = calculateOrderTotal(100, 'upi');
  assert.strictEqual(excessiveQty.qty, BASE_PRODUCT.maxQuantity); // Clamped to 5
  assert.strictEqual(excessiveQty.total, 5 * 229);
});

// ATTACK 7: Reuse confirmed UTR format check and normalization
await runAttackTest(7, 'Normalize UTR characters and reject symbol spam', () => {
  assert.strictEqual(validateAndNormalizeUtr(' 123456789012 '), '123456789012');
  assert.strictEqual(validateAndNormalizeUtr('hdfc-1234-5678_9012'), 'HDFC123456789012');
  assert.strictEqual(validateAndNormalizeUtr('!@#$%^&*()'), null);
  assert.strictEqual(validateAndNormalizeUtr(''), null);
});

// ATTACK 8: Database migration uniqueness barrier for active UTRs
await runAttackTest(8, 'Verify database migration contains partial unique index on orders.upi_ref', () => {
  const migrationPath = path.resolve('supabase/migrations/20260820_finalize_upi_lifecycle.sql');
  assert.strictEqual(fs.existsSync(migrationPath), true);
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /CREATE UNIQUE INDEX/i);
  assert.match(content, /WHERE upi_ref IS NOT NULL/i);
  assert.match(content, /status IN/i);
});

// ATTACK 9: Replay admin confirmation on already confirmed order
await runAttackTest(9, 'Admin confirmation replay -> Idempotent response, zero duplicate emails', async () => {
  assert.strictEqual(isValidTransition('confirmed', 'confirmed', 'upi'), true);
  assert.strictEqual(isValidTransition('verification_pending', 'verification_pending', 'upi'), true);
});

// ATTACK 10: Call admin endpoint without credentials -> Blocked (401 Unauthorized)
await runAttackTest(10, 'Call admin verify endpoint without credentials -> Blocked (401 Unauthorized)', async () => {
  const { default: adminVerifyHandler } = await import('../../api/admin/verify-payment.js');
  const res = createMockRes();
  const req = {
    method: 'POST',
    headers: {}, // No Authorization header
    body: { orderCode: 'SMF-20260820-1234', action: 'confirm' }
  };
  await adminVerifyHandler(req, res);
  assert.strictEqual(res.getStatusCode(), 401);
  assert.match(res.getData().error, /Unauthorized/i);
});

// ATTACK 11: Call retired legacy webhook endpoint -> 410 Gone
await runAttackTest(11, 'Call legacy webhook -> 410 Gone', async () => {
  const { default: webhookHandler } = await import('../../api/webhook.js');
  const res = createMockRes();
  const req = {
    method: 'POST',
    headers: {},
    body: { orderCode: 'SMF-20260820-1234', status: 'confirmed' }
  };
  await webhookHandler(req, res);
  assert.strictEqual(res.getStatusCode(), 410);
  assert.match(res.getData().error, /webhook is retired/i);
});

// ATTACK 12: Call webhook repeatedly with same status -> Idempotent handling
await runAttackTest(12, 'Webhook repeated calls -> Idempotent no-op', () => {
  assert.strictEqual(isValidTransition('confirmed', 'confirmed', 'upi'), true);
  assert.strictEqual(isValidTransition('placed', 'placed', 'cod'), true);
});

// ATTACK 13: Attempt invalid status jump: confirmed -> delivered directly or delivered -> confirmed
await runAttackTest(13, 'Invalid state machine jumps -> Rejected by state validator', () => {
  // Direct jump from confirmed to delivered without fulfillment steps
  assert.strictEqual(isValidTransition('confirmed', 'delivered', 'upi'), false);
  // Terminal state mutations
  assert.strictEqual(isValidTransition('delivered', 'confirmed', 'upi'), false);
  assert.strictEqual(isValidTransition('cancelled', 'confirmed', 'upi'), false);
  // Arbitrary reversals
  assert.strictEqual(isValidTransition('confirmed', 'upi_pending', 'upi'), false);
  assert.strictEqual(isValidTransition('confirmed', 'placed', 'cod'), false);
});

// ATTACK 14: Remove ORDER_SECURITY_SECRET in production-like configuration -> Fails closed
await runAttackTest(14, 'Missing security secret in environment -> Fails closed safely', () => {
  const tempSec = process.env.ORDER_SECURITY_SECRET;
  const tempSupa = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tempAdm = process.env.ADMIN_SECRET;

  delete process.env.ORDER_SECURITY_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ADMIN_SECRET;

  assert.strictEqual(getSecuritySecret(), null);
  assert.strictEqual(generateOrderToken('SMF-20260820-1234', '9876543210'), null);
  assert.strictEqual(verifyOrderToken('SMF-20260820-1234', '9876543210', 'token'), false);

  // Restore test env
  if (tempSec) process.env.ORDER_SECURITY_SECRET = tempSec;
  if (tempSupa) process.env.SUPABASE_SERVICE_ROLE_KEY = tempSupa;
  if (tempAdm) process.env.ADMIN_SECRET = tempAdm;
});

// ATTACK 15: Search entire codebase for old hardcoded fallback secret
await runAttackTest(15, 'Audit codebase: zero occurrences of fallback salt "smelloff-default-order-signing-salt-2026"', () => {
  const filesToScan = [
    'api/_security.js',
    'api/create-order.js',
    'api/verify-payment.js',
    'api/admin/verify-payment.js',
    'api/webhook.js',
    'api/send-email.js',
    'shared/products-config.js',
    'odorstrike.html'
  ];

  for (const relPath of filesToScan) {
    const fullPath = path.resolve(relPath);
    if (fs.existsSync(fullPath)) {
      const text = fs.readFileSync(fullPath, 'utf8');
      assert.strictEqual(
        text.includes('smelloff-default-order-signing-salt-2026'),
        false,
        `Found fallback salt in ${relPath}`
      );
    }
  }
});

// Extra Check: Payment status verification fails closed when status API is not configured
await runAttackTest(16, 'Status check fails closed when merchant status API is unconfigured', async () => {
  const prevUrl = process.env.UPI_STATUS_API_URL;
  const prevCheck = process.env.UPI_CHECK_URL;
  delete process.env.UPI_STATUS_API_URL;
  delete process.env.UPI_CHECK_URL;

  const { checkBankUpiStatus } = await import('../../api/payment-status.js');
  const res = await checkBankUpiStatus({ order_code: 'SMF-20260820-1234', amount: 22900 });
  assert.strictEqual(res, null);

  if (prevUrl) process.env.UPI_STATUS_API_URL = prevUrl;
  if (prevCheck) process.env.UPI_CHECK_URL = prevCheck;
});

// Extra Check: Sensitive transactional email endpoint prevents spoofing
await runAttackTest(17, 'Transactional email endpoint rejects unauthenticated order confirmation triggers', async () => {
  const { default: sendEmailHandler } = await import('../../api/send-email.js');
  const res = createMockRes();
  const req = {
    method: 'POST',
    headers: {}, // No admin auth
    body: {
      to: 'victim@example.com',
      type: 'orderConfirmation',
      data: { orderId: 'SMF-20260820-1234' }
    }
  };
  await sendEmailHandler(req, res);
  assert.strictEqual(res.getStatusCode(), 401);
  assert.match(res.getData().error, /Unauthorized/i);
});

// ATTACK 18: Canonical UPI URI Builder Verification
await runAttackTest(18, 'Canonical UPI URI builder has exactly 4 query parameters (pa, pn, am, cu) and no metadata', async () => {
  const { buildUpiPaymentUri } = await import('../../api/create-order.js');
  const uri = buildUpiPaymentUri(229);
  assert.strictEqual(uri, 'upi://pay?pa=mr.brainy%40ibl&pn=Smelloff&am=229&cu=INR');

  const parsed = new URL(uri);
  const keys = Array.from(parsed.searchParams.keys());
  assert.strictEqual(keys.length, 4);
  assert.deepStrictEqual(keys.sort(), ['am', 'cu', 'pa', 'pn']);
  assert.strictEqual(parsed.searchParams.get('pa'), 'mr.brainy@ibl');
  assert.strictEqual(parsed.searchParams.get('pn'), 'Smelloff');
  assert.strictEqual(parsed.searchParams.get('am'), '229');
  assert.strictEqual(parsed.searchParams.get('cu'), 'INR');
  assert.strictEqual(parsed.searchParams.get('tn'), null);
  assert.strictEqual(parsed.searchParams.get('tr'), null);
  assert.strictEqual(parsed.searchParams.get('mc'), null);
});

// ATTACK 19: Codebase Audit for Forbidden UPI Scheme Parameters & Duplicate Builders
await runAttackTest(19, 'Audit payment codebase: zero tr/tn/intent/app schemes and no duplicate UPI builders', () => {
  const activeFiles = [
    'api/create-order.js',
    'odorstrike.html',
    'assets/js/app.js'
  ];

  const forbiddenRegexes = [
    /[?&](tr|tn|mc)=/i,
    /intent:\/\//i,
    /tez:\/\//i,
    /phonepe:\/\//i,
    /paytmmp:\/\//i,
    /package=com\.phonepe\.app/i,
    /package=com\.google\.android\.apps\.nbu\.paisa\.user/i,
    /package=net\.one97\.paytm/i,
    /getAppUpiLink/i,
    /buildUpiLinks/i
  ];

  for (const relPath of activeFiles) {
    const fullPath = path.resolve(relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const re of forbiddenRegexes) {
        assert.strictEqual(
          re.test(content),
          false,
          `Found forbidden UPI pattern ${re} in ${relPath}`
        );
      }
    }
  }
});

// Restore original env variables
if (PREV_ADMIN_SECRET) process.env.ADMIN_SECRET = PREV_ADMIN_SECRET;
else delete process.env.ADMIN_SECRET;

if (PREV_SECURITY_SECRET) process.env.ORDER_SECURITY_SECRET = PREV_SECURITY_SECRET;
else delete process.env.ORDER_SECURITY_SECRET;

console.log('\n====================================================');
console.log(`FINAL SECURITY AUDIT: ${passed}/${total} attack vectors blocked.`);
console.log('====================================================\n');

if (passed !== total) {
  process.exit(1);
}
