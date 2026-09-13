import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_LIFECYCLE, isValidTransition } from '../shared/products-config.js';

test('Order Lifecycle State Machine: Valid Transitions for Prepaid UPI', () => {
  const prepaid = ORDER_LIFECYCLE.PREPAID_UPI;
  assert.equal(prepaid.initialStatus, 'upi_pending');

  // Valid forward paths
  assert.equal(isValidTransition('upi_pending', 'confirmed', 'upi'), true);
  assert.equal(isValidTransition('confirmed', 'packed', 'upi'), true);
  assert.equal(isValidTransition('packed', 'dispatched', 'upi'), true);
  assert.equal(isValidTransition('dispatched', 'out_for_delivery', 'upi'), true);
  assert.equal(isValidTransition('out_for_delivery', 'delivered', 'upi'), true);
  assert.equal(isValidTransition('confirmed', 'dispatched', 'upi'), true);

  // Cancellations
  assert.equal(isValidTransition('upi_pending', 'cancelled', 'upi'), true);
  assert.equal(isValidTransition('confirmed', 'cancelled', 'upi'), true);
  assert.equal(isValidTransition('packed', 'cancelled', 'upi'), true);

  // Terminal states cannot transition to active/forward states
  assert.equal(isValidTransition('delivered', 'confirmed', 'upi'), false);
  assert.equal(isValidTransition('delivered', 'upi_pending', 'upi'), false);
  assert.equal(isValidTransition('cancelled', 'confirmed', 'upi'), false);
  assert.equal(isValidTransition('cancelled', 'delivered', 'upi'), false);
  assert.equal(isValidTransition('cancelled', 'packed', 'upi'), false);

  // Backwards transitions are rejected
  assert.equal(isValidTransition('delivered', 'dispatched', 'upi'), false);
  assert.equal(isValidTransition('dispatched', 'packed', 'upi'), false);
  assert.equal(isValidTransition('packed', 'confirmed', 'upi'), false);
  assert.equal(isValidTransition('confirmed', 'upi_pending', 'upi'), false);
});

test('Order Lifecycle State Machine: Valid Transitions for COD', () => {
  const cod = ORDER_LIFECYCLE.COD;
  assert.equal(cod.initialStatus, 'placed');

  // Valid COD progression
  assert.equal(isValidTransition('placed', 'confirmed', 'cod'), true);
  assert.equal(isValidTransition('confirmed', 'packed', 'cod'), true);
  assert.equal(isValidTransition('packed', 'dispatched', 'cod'), true);
  assert.equal(isValidTransition('dispatched', 'out_for_delivery', 'cod'), true);
  assert.equal(isValidTransition('out_for_delivery', 'delivered', 'cod'), true);

  // COD cannot transition to upi_pending
  assert.equal(isValidTransition('placed', 'upi_pending', 'cod'), false);

  // Terminal states cannot transition backwards
  assert.equal(isValidTransition('delivered', 'placed', 'cod'), false);
  assert.equal(isValidTransition('cancelled', 'placed', 'cod'), false);
});

test('Cancellation Race Simulation: Atomic DB boundary prevents TOCTOU clobbering', async () => {
  // Mock Supabase DB state
  const mockDb = {
    order: {
      id: '00000000-0000-0000-0000-000000000001',
      customer_email: 'shopper@example.com',
      status: 'confirmed',
    }
  };

  const cancellable = ['placed', 'upi_pending', 'confirmed'];

  // Simulate execution of cancel-order edge function with concurrency
  async function simulateCancelOrderEdgeFunction(db) {
    // 1. Initial select
    const order = { ...db.order };
    if (!order) return { status: 404, error: 'Order not found' };
    if (!cancellable.includes(order.status)) {
      return { status: 422, error: 'Order cannot be cancelled' };
    }

    // 2. Race window: concurrent warehouse process updates status to 'packed'
    // (Simulating external fulfillment worker mutating state before update executes)
    // In our test, we trigger the race here:
    db.order.status = 'packed';

    // 3. Database atomic update with predicate
    // UPDATE orders SET status = 'cancelled' WHERE id = orderId AND status IN ('placed', 'upi_pending', 'confirmed') RETURNING id
    let updatedRows = [];
    if (cancellable.includes(db.order.status)) {
      db.order.status = 'cancelled';
      updatedRows = [{ id: db.order.id }];
    }

    // 4. Verify outcome
    if (updatedRows.length === 0) {
      return {
        status: 422,
        error: 'Order cannot be cancelled — it has already been dispatched or fulfillment has commenced.'
      };
    }

    return { status: 200, success: true };
  }

  const result = await simulateCancelOrderEdgeFunction(mockDb);

  // Assert that cancellation was safely rejected because fulfillment began concurrently
  assert.equal(result.status, 422);
  assert.equal(result.error.includes('fulfillment has commenced'), true);
  // Assert DB status was NOT corrupted into 'cancelled'
  assert.equal(mockDb.order.status, 'packed');
});

test('Cancellation Race Simulation: Uncontested cancellation succeeds atomically', async () => {
  const mockDb = {
    order: {
      id: '00000000-0000-0000-0000-000000000002',
      customer_email: 'shopper@example.com',
      status: 'confirmed',
    }
  };

  const cancellable = ['placed', 'upi_pending', 'confirmed'];

  async function simulateCancelOrderEdgeFunction(db) {
    const order = { ...db.order };
    if (!cancellable.includes(order.status)) {
      return { status: 422, error: 'Order cannot be cancelled' };
    }

    // Uncontested: order status remains 'confirmed' at DB execution time
    let updatedRows = [];
    if (cancellable.includes(db.order.status)) {
      db.order.status = 'cancelled';
      updatedRows = [{ id: db.order.id }];
    }

    if (updatedRows.length === 0) {
      return { status: 422, error: 'Order cannot be cancelled' };
    }

    return { status: 200, success: true };
  }

  const result = await simulateCancelOrderEdgeFunction(mockDb);
  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.equal(mockDb.order.status, 'cancelled');
});
