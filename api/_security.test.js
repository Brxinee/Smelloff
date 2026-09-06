import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { generateOrderToken, verifyOrderToken } from './_security.js';

describe('verifyOrderToken', () => {
  let originalSecret;

  before(() => {
    originalSecret = process.env.ORDER_SECURITY_SECRET;
    process.env.ORDER_SECURITY_SECRET = 'test-secret-key-for-unit-tests';
  });

  after(() => {
    if (originalSecret !== undefined) {
      process.env.ORDER_SECURITY_SECRET = originalSecret;
    } else {
      delete process.env.ORDER_SECURITY_SECRET;
    }
  });

  test('happy path - verifies a valid token', () => {
    const orderCode = 'SMF-12345678-1234';
    const phone = '1234567890';
    const token = generateOrderToken(orderCode, phone);

    assert.strictEqual(typeof token, 'string', 'Token should be generated');
    assert.strictEqual(verifyOrderToken(orderCode, phone, token), true);
  });

  test('tampered path - fails verification with a modified token', () => {
    const orderCode = 'SMF-12345678-1234';
    const phone = '1234567890';
    const token = generateOrderToken(orderCode, phone);
    const tamperedToken = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');

    assert.strictEqual(verifyOrderToken(orderCode, phone, tamperedToken), false);
  });

  test('tampered path - fails verification with completely different token', () => {
    const orderCode = 'SMF-12345678-1234';
    const phone = '1234567890';
    assert.strictEqual(verifyOrderToken(orderCode, phone, 'invalid-token-string-that-is-long-enough'), false);
  });

  test('edge cases - fails verification with null, undefined, or non-string token inputs', () => {
    const orderCode = 'SMF-12345678-1234';
    const phone = '1234567890';

    assert.strictEqual(verifyOrderToken(orderCode, phone, null), false);
    assert.strictEqual(verifyOrderToken(orderCode, phone, undefined), false);
    assert.strictEqual(verifyOrderToken(orderCode, phone, 12345), false);
    assert.strictEqual(verifyOrderToken(orderCode, phone, {}), false);
  });

  test('invalid inputs - fails gracefully when generateOrderToken fails due to invalid orderCode or phone', () => {
    const invalidOrderCode = 'INVALID-ORDER';
    const validPhone = '1234567890';
    const someToken = 'sometokenstring';

    // generateOrderToken would return null for invalidOrderCode
    assert.strictEqual(verifyOrderToken(invalidOrderCode, validPhone, someToken), false);

    const validOrderCode = 'SMF-12345678-1234';
    const invalidPhone = '123'; // Not 10 digits
    assert.strictEqual(verifyOrderToken(validOrderCode, invalidPhone, someToken), false);
  });

  test('fails gracefully when length of expected and provided token mismatch', () => {
    const orderCode = 'SMF-12345678-1234';
    const phone = '1234567890';
    const token = generateOrderToken(orderCode, phone);

    // shorter token
    assert.strictEqual(verifyOrderToken(orderCode, phone, token.slice(0, 10)), false);

    // longer token
    assert.strictEqual(verifyOrderToken(orderCode, phone, token + 'extra'), false);
  });
});
