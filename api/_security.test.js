import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { generateOrderToken } from './_security.js';

describe('generateOrderToken', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    // Mock the environment for tests
    process.env = { ...originalEnv, ORDER_SECURITY_SECRET: 'test-secret-key-12345' };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('generates a 32-character hex token for valid inputs', () => {
    const token = generateOrderToken('SMF-12345678-1234', '9876543210');
    assert.ok(token);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 32);
    assert.match(token, /^[0-9a-f]{32}$/);
  });

  it('cleans and handles phone numbers with country codes or spaces', () => {
    const expectedToken = generateOrderToken('SMF-12345678-1234', '9876543210');

    const token1 = generateOrderToken('SMF-12345678-1234', '+919876543210');
    assert.strictEqual(token1, expectedToken);

    const token2 = generateOrderToken('SMF-12345678-1234', '98765 43210');
    assert.strictEqual(token2, expectedToken);

    const token3 = generateOrderToken('SMF-12345678-1234', '+91 98765 43210');
    assert.strictEqual(token3, expectedToken);
  });

  it('cleans and handles order codes with spaces or lowercase characters', () => {
    const expectedToken = generateOrderToken('SMF-12345678-1234', '9876543210');

    const token1 = generateOrderToken('smf-12345678-1234', '9876543210');
    assert.strictEqual(token1, expectedToken);

    const token2 = generateOrderToken(' SMF-12345678-1234 ', '9876543210');
    assert.strictEqual(token2, expectedToken);
  });

  it('returns null if security secret is not configured', () => {
    // Remove all possible secrets
    delete process.env.ORDER_SECURITY_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ADMIN_SECRET;

    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    const token = generateOrderToken('SMF-12345678-1234', '9876543210');

    console.error = originalError;

    assert.strictEqual(token, null);
  });

  it('returns null for invalid phone numbers', () => {
    // Less than 10 digits
    assert.strictEqual(generateOrderToken('SMF-12345678-1234', '12345'), null);
    // Null or undefined phone
    assert.strictEqual(generateOrderToken('SMF-12345678-1234', null), null);
    assert.strictEqual(generateOrderToken('SMF-12345678-1234', undefined), null);
    // Non-numeric phone that cannot be cleaned to 10 digits
    assert.strictEqual(generateOrderToken('SMF-12345678-1234', 'abcdefghij'), null);
  });

  it('returns null for invalid order codes', () => {
    // Missing prefix
    assert.strictEqual(generateOrderToken('12345678-1234', '9876543210'), null);
    // Wrong digit count
    assert.strictEqual(generateOrderToken('SMF-12345-123', '9876543210'), null);
    // Wrong format
    assert.strictEqual(generateOrderToken('SMF-ABCDEFGH-IJKL', '9876543210'), null);
    // Null or undefined order code
    assert.strictEqual(generateOrderToken(null, '9876543210'), null);
    assert.strictEqual(generateOrderToken(undefined, '9876543210'), null);
  });

  it('is deterministic for the same inputs', () => {
    const token1 = generateOrderToken('SMF-12345678-1234', '9876543210');
    const token2 = generateOrderToken('SMF-12345678-1234', '9876543210');
    assert.strictEqual(token1, token2);
  });
});
