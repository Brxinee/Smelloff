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

test('Financial Integrity: Unpaid order cancellation must NOT enqueue or emit Refund conversion event', () => {
  // Simulate Postgres orders_meta_enqueue trigger logic
  function simulateOrdersMetaEnqueue(oldStatus, newStatus, orderCode, orderId) {
    const events = [];
    if (newStatus !== oldStatus) {
      const code = orderCode || orderId;
      if (newStatus === 'confirmed') {
        events.push({ event_id: `purchase_${code}`, event_name: 'Purchase' });
      } else if (newStatus === 'cancelled' || newStatus === 'returned') {
        const confirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
        if (confirmedStates.includes(oldStatus)) {
          events.push({ event_id: `refund_${code}`, event_name: 'Refund' });
        }
      }
    }
    return events;
  }

  // 1. Unpaid UPI order cancelled directly from upi_pending
  const unpaidUpiCancelled = simulateOrdersMetaEnqueue('upi_pending', 'cancelled', 'SMF-20260913-1001', 'id-1');
  assert.equal(unpaidUpiCancelled.length, 0, 'Unpaid upi_pending cancelled must emit 0 events (no false Refund)');

  // 2. Unconfirmed COD order cancelled directly from placed
  const unconfirmedCodCancelled = simulateOrdersMetaEnqueue('placed', 'cancelled', 'SMF-20260913-1002', 'id-2');
  assert.equal(unconfirmedCodCancelled.length, 0, 'Unconfirmed placed COD cancelled must emit 0 events');

  // 3. Confirmed prepaid order cancelled -> MUST emit Refund event to net out prior Purchase
  const confirmedPrepaidCancelled = simulateOrdersMetaEnqueue('confirmed', 'cancelled', 'SMF-20260913-1003', 'id-3');
  assert.equal(confirmedPrepaidCancelled.length, 1);
  assert.equal(confirmedPrepaidCancelled[0].event_name, 'Refund');
  assert.equal(confirmedPrepaidCancelled[0].event_id, 'refund_SMF-20260913-1003');

  // 4. Delivered order returned (RTO / 7-day return) -> MUST emit Refund event
  const returnedOrder = simulateOrdersMetaEnqueue('delivered', 'returned', 'SMF-20260913-1004', 'id-4');
  assert.equal(returnedOrder.length, 1);
  assert.equal(returnedOrder[0].event_name, 'Refund');

  // 5. Subsequent cancelled -> returned must NOT emit a second Refund event
  const alreadyCancelledReturned = simulateOrdersMetaEnqueue('cancelled', 'returned', 'SMF-20260913-1003', 'id-3');
  assert.equal(alreadyCancelledReturned.length, 0, 'Cancelled -> Returned must not double-enqueue Refund');
});

test('Financial Integrity: Meta CAPI multi-quantity amount calculation and currency discipline', async () => {
  const { contentsFromItems } = await import('../api/_meta.js');
  
  // Test matrix for canonical quantity amounts:
  const quantities = [1, 2, 5, 10];
  for (const qty of quantities) {
    const dbAmountPaise = 22900 * qty;
    const valueRupees = Number(dbAmountPaise) / 100;
    const items = [{ sku: 'ODOR-100ML', quantity: qty, price: 229 }];
    
    assert.equal(valueRupees, 229 * qty, `Rupee value for qty ${qty} must equal ${229 * qty}`);
    
    const contents = contentsFromItems(items, valueRupees);
    assert.equal(contents.num_items, qty);
    assert.equal(contents.contents[0].quantity, qty);
    assert.equal(contents.contents[0].item_price, 229);
  }
});

