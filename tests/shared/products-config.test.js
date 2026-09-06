import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTransition } from '../../shared/products-config.js';

describe('isValidTransition', () => {
  describe('PREPAID_UPI lifecycle', () => {
    it('allows valid transitions from upi_pending', () => {
      assert.strictEqual(isValidTransition('upi_pending', 'confirmed', 'prepaid'), true);
      assert.strictEqual(isValidTransition('upi_pending', 'failed', 'prepaid'), true);
      assert.strictEqual(isValidTransition('upi_pending', 'cancelled', 'prepaid'), true);
    });

    it('rejects invalid transitions from upi_pending', () => {
      assert.strictEqual(isValidTransition('upi_pending', 'packed', 'prepaid'), false);
      assert.strictEqual(isValidTransition('upi_pending', 'delivered', 'prepaid'), false);
    });

    it('allows valid transitions from confirmed', () => {
      assert.strictEqual(isValidTransition('confirmed', 'packed', 'prepaid'), true);
      assert.strictEqual(isValidTransition('confirmed', 'dispatched', 'prepaid'), true);
      assert.strictEqual(isValidTransition('confirmed', 'cancelled', 'prepaid'), true);
    });

    it('rejects invalid transitions from confirmed', () => {
      assert.strictEqual(isValidTransition('confirmed', 'upi_pending', 'prepaid'), false);
      assert.strictEqual(isValidTransition('confirmed', 'delivered', 'prepaid'), false);
    });

    it('handles terminal states correctly', () => {
      // Delivered has no allowed next transitions
      assert.strictEqual(isValidTransition('delivered', 'packed', 'prepaid'), false);
      // Cancelled has no allowed next transitions
      assert.strictEqual(isValidTransition('cancelled', 'confirmed', 'prepaid'), false);
    });
  });

  describe('COD lifecycle', () => {
    it('allows valid transitions from placed', () => {
      assert.strictEqual(isValidTransition('placed', 'confirmed', 'COD'), true);
      assert.strictEqual(isValidTransition('placed', 'packed', 'cod'), true); // checking case-insensitivity
      assert.strictEqual(isValidTransition('placed', 'dispatched', 'Cod'), true);
      assert.strictEqual(isValidTransition('placed', 'cancelled', 'cod'), true);
    });

    it('rejects invalid transitions from placed', () => {
      assert.strictEqual(isValidTransition('placed', 'delivered', 'cod'), false);
      assert.strictEqual(isValidTransition('placed', 'out_for_delivery', 'cod'), false);
    });

    it('allows valid transitions from packed', () => {
      assert.strictEqual(isValidTransition('packed', 'dispatched', 'cod'), true);
      assert.strictEqual(isValidTransition('packed', 'cancelled', 'cod'), true);
    });

    it('rejects backward transitions', () => {
      assert.strictEqual(isValidTransition('packed', 'placed', 'cod'), false);
      assert.strictEqual(isValidTransition('dispatched', 'packed', 'cod'), false);
    });
  });

  describe('Edge cases', () => {
    it('returns true for idempotent transitions (current === target)', () => {
      assert.strictEqual(isValidTransition('placed', 'placed', 'cod'), true);
      assert.strictEqual(isValidTransition('confirmed', 'confirmed', 'prepaid'), true);
      assert.strictEqual(isValidTransition('unknown_state', 'unknown_state', 'prepaid'), true);
    });

    it('returns false for missing arguments', () => {
      assert.strictEqual(isValidTransition(), false);
      assert.strictEqual(isValidTransition('placed'), false);
      assert.strictEqual(isValidTransition(null, 'placed', 'cod'), false);
      assert.strictEqual(isValidTransition('placed', null, 'cod'), false);
    });

    it('returns false for unknown current states', () => {
      assert.strictEqual(isValidTransition('invalid_state', 'confirmed', 'prepaid'), false);
      assert.strictEqual(isValidTransition('invalid_state', 'packed', 'cod'), false);
    });

    it('returns false for unknown target states', () => {
      assert.strictEqual(isValidTransition('confirmed', 'invalid_state', 'prepaid'), false);
    });

    it('defaults to prepaid when paymentMethod is not provided or falsy', () => {
      // For prepaid, 'upi_pending' -> 'confirmed' is valid, but 'placed' is not in the map
      assert.strictEqual(isValidTransition('upi_pending', 'confirmed'), true);
      assert.strictEqual(isValidTransition('upi_pending', 'confirmed', null), true);
      assert.strictEqual(isValidTransition('upi_pending', 'confirmed', ''), true);
      assert.strictEqual(isValidTransition('upi_pending', 'confirmed', undefined), true);

      // 'placed' is only in COD, so it should be false if prepaid is the default
      assert.strictEqual(isValidTransition('placed', 'confirmed'), false);
    });
  });
});
