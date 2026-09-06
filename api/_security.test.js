import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateAndNormalizeUtr } from './_security.js';

describe('validateAndNormalizeUtr', () => {
  test('returns null for non-string or falsy inputs', () => {
    assert.strictEqual(validateAndNormalizeUtr(null), null);
    assert.strictEqual(validateAndNormalizeUtr(undefined), null);
    assert.strictEqual(validateAndNormalizeUtr(''), null);
    assert.strictEqual(validateAndNormalizeUtr(1234567890), null);
    assert.strictEqual(validateAndNormalizeUtr({}), null);
    assert.strictEqual(validateAndNormalizeUtr([]), null);
  });

  test('returns normalized UTR for valid inputs', () => {
    // Exact length boundaries (10 to 24 chars)
    assert.strictEqual(validateAndNormalizeUtr('1234567890'), '1234567890'); // 10 chars
    assert.strictEqual(validateAndNormalizeUtr('ABCDEFGHIJKLMNOPQRSTUVWX'), 'ABCDEFGHIJKLMNOPQRSTUVWX'); // 24 chars
    assert.strictEqual(validateAndNormalizeUtr('A1B2C3D4E5F6G7H8'), 'A1B2C3D4E5F6G7H8'); // mixed alphanumeric
  });

  test('normalizes input by trimming, uppercase, and removing specific characters', () => {
    assert.strictEqual(validateAndNormalizeUtr('  abc123def456  '), 'ABC123DEF456'); // trims and uppercases
    assert.strictEqual(validateAndNormalizeUtr('a-b-c-1234567'), 'ABC1234567'); // removes hyphens
    assert.strictEqual(validateAndNormalizeUtr('x_y_z_9876543'), 'XYZ9876543'); // removes underscores
    assert.strictEqual(validateAndNormalizeUtr(' 1 2 3 4 5 6 7 8 9 0 '), '1234567890'); // removes spaces
    assert.strictEqual(validateAndNormalizeUtr('a-b_c 123def4'), 'ABC123DEF4'); // mixed normalization
  });

  test('returns null for UTRs with invalid lengths after normalization', () => {
    assert.strictEqual(validateAndNormalizeUtr('123456789'), null); // 9 chars (too short)
    assert.strictEqual(validateAndNormalizeUtr('ABCDEFGHIJKLMNOPQRSTUVWXY'), null); // 25 chars (too long)
    assert.strictEqual(validateAndNormalizeUtr(' a-b 1234 '), null); // too short after normalization
  });

  test('returns null for UTRs containing unallowed special characters', () => {
    assert.strictEqual(validateAndNormalizeUtr('1234567890!'), null); // exclamation mark
    assert.strictEqual(validateAndNormalizeUtr('abc123def@gh'), null); // at symbol
    assert.strictEqual(validateAndNormalizeUtr('XYZ123#4567'), null); // hash
    assert.strictEqual(validateAndNormalizeUtr('1234567890.'), null); // dot
  });
});
