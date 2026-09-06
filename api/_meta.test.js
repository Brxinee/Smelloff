import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { hashEmail } from './_meta.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('hashEmail', async (t) => {
  await t.test('returns null for empty or falsy inputs', () => {
    assert.strictEqual(hashEmail(), null);
    assert.strictEqual(hashEmail(null), null);
    assert.strictEqual(hashEmail(undefined), null);
    assert.strictEqual(hashEmail(''), null);
    assert.strictEqual(hashEmail('   '), null);
  });

  await t.test('returns null for strings without @', () => {
    assert.strictEqual(hashEmail('invalidemail.com'), null);
    assert.strictEqual(hashEmail('john.doe'), null);
  });

  await t.test('correctly hashes valid email', () => {
    const email = 'test@example.com';
    const expected = sha256(email);
    assert.strictEqual(hashEmail(email), expected);
  });

  await t.test('trims whitespace before hashing', () => {
    const email = '  test@example.com  ';
    const expected = sha256('test@example.com');
    assert.strictEqual(hashEmail(email), expected);
  });

  await t.test('lowercases before hashing', () => {
    const email = 'TeSt@ExAmPlE.cOm';
    const expected = sha256('test@example.com');
    assert.strictEqual(hashEmail(email), expected);
  });

  await t.test('handles non-string inputs that contain @ after string conversion', () => {
    const obj = { toString: () => 'obj@example.com' };
    const expected = sha256('obj@example.com');
    assert.strictEqual(hashEmail(obj), expected);
  });
});
