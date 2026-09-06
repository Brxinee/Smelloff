import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotal, BASE_PRODUCT } from './products-config.js';

describe('calculateOrderTotal', () => {
  test('returns default 1 quantity for prepaid', () => {
    const result = calculateOrderTotal();
    assert.equal(result.qty, 1);
    assert.equal(result.total, BASE_PRODUCT.price + BASE_PRODUCT.shippingCost);
    assert.equal(result.isCod, false);
  });

  test('calculates multiple quantity for prepaid', () => {
    const result = calculateOrderTotal(3);
    assert.equal(result.qty, 3);
    assert.equal(result.total, 3 * BASE_PRODUCT.price + BASE_PRODUCT.shippingCost);
    assert.equal(result.isCod, false);
  });

  test('adds COD fee when payment method is cod', () => {
    const result = calculateOrderTotal(1, 'cod');
    assert.equal(result.isCod, true);
    assert.equal(result.codFee, BASE_PRODUCT.codFee);
    assert.equal(result.total, BASE_PRODUCT.price + BASE_PRODUCT.shippingCost + BASE_PRODUCT.codFee);
  });

  test('is case insensitive for cod payment method', () => {
    const result = calculateOrderTotal(2, 'COD');
    assert.equal(result.isCod, true);
    assert.equal(result.codFee, BASE_PRODUCT.codFee);
    assert.equal(result.total, 2 * BASE_PRODUCT.price + BASE_PRODUCT.shippingCost + BASE_PRODUCT.codFee);
  });

  test('clamps quantity below 1 to 1', () => {
    const resultZero = calculateOrderTotal(0);
    assert.equal(resultZero.qty, 1);

    const resultNegative = calculateOrderTotal(-5);
    assert.equal(resultNegative.qty, 1);
  });

  test('clamps quantity above maxQuantity to maxQuantity', () => {
    const resultHigh = calculateOrderTotal(10);
    assert.equal(resultHigh.qty, BASE_PRODUCT.maxQuantity);
    assert.equal(resultHigh.total, BASE_PRODUCT.maxQuantity * BASE_PRODUCT.price + BASE_PRODUCT.shippingCost);
  });

  test('handles invalid quantity types by defaulting to 1', () => {
    const resultNaN = calculateOrderTotal('abc');
    assert.equal(resultNaN.qty, 1);

    const resultNull = calculateOrderTotal(null);
    assert.equal(resultNull.qty, 1);

    const resultUndefined = calculateOrderTotal(undefined);
    assert.equal(resultUndefined.qty, 1);
  });

  test('parses string quantities as integers', () => {
    const resultString = calculateOrderTotal('4');
    assert.equal(resultString.qty, 4);

    const resultFloatString = calculateOrderTotal('3.14');
    assert.equal(resultFloatString.qty, 3);
  });
});
