import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimShiprocketFulfillment,
  finalizeShiprocketFulfillment,
  releaseShiprocketFulfillmentClaim,
  extractShiprocketIds
} from '../api/_shiprocket.js';
import shiprocketSyncHandler from '../api/shiprocket-sync.js';
import adminVerifyPaymentHandler from '../api/admin/verify-payment.js';

test('Shiprocket extractShiprocketIds correctly extracts orderId, shipmentId, awb, courier', () => {
  const payload = {
    order_id: 123456,
    shipment_id: 789012,
    awb_code: 'AWB998877',
    courier_name: 'Delhivery'
  };
  const extracted = extractShiprocketIds(payload);
  assert.equal(extracted.orderId, 123456);
  assert.equal(extracted.shipmentId, 789012);
  assert.equal(extracted.awb, 'AWB998877');
  assert.equal(extracted.courier, 'Delhivery');

  const nested = {
    data: {
      orderId: 654321,
      shipmentId: 210987,
      awb: 'AWB112233',
      courier: 'Bluedart'
    }
  };
  const extractedNested = extractShiprocketIds(nested);
  assert.equal(extractedNested.orderId, 654321);
  assert.equal(extractedNested.shipmentId, 210987);
  assert.equal(extractedNested.awb, 'AWB112233');
  assert.equal(extractedNested.courier, 'Bluedart');
});

test('Shiprocket Concurrency: 10 simultaneous workers -> exactly 1 external creation call', async () => {
  const orderCode = 'SMF-20260913-7771';
  const mockDb = {
    [orderCode]: {
      id: '00000000-0000-0000-0000-000000000010',
      order_code: orderCode,
      status: 'confirmed',
      shiprocket_order_id: null,
      shiprocket_shipment_id: null,
      shiprocket_claimed_at: null,
      shiprocket_claim_id: null,
      amount: 22900
    }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;

  let externalApiCalls = 0;
  async function mockExternalShiprocketCreate() {
    externalApiCalls++;
    // Simulate network delay
    await new Promise(r => setTimeout(r, 10));
    return {
      order_id: 888123,
      shipment_id: 999123,
      awb_code: 'AWB_MOCK_10',
      courier_name: 'Bluedart'
    };
  }

  async function workerTask(workerIndex) {
    const claimId = `claim_worker_${workerIndex}_${Date.now()}`;
    const claimResult = await claimShiprocketFulfillment(orderCode, claimId);

    if (!claimResult.claimed) {
      return { workerIndex, status: 'skipped', inProgress: true };
    }

    try {
      const resp = await mockExternalShiprocketCreate();
      const ids = extractShiprocketIds(resp);
      await finalizeShiprocketFulfillment(orderCode, claimId, ids);
      return { workerIndex, status: 'created', ids };
    } catch (err) {
      await releaseShiprocketFulfillmentClaim(orderCode, claimId, err.message);
      return { workerIndex, status: 'failed', error: err.message };
    }
  }

  try {
    // Launch 10 workers simultaneously
    const results = await Promise.all([
      workerTask(1),
      workerTask(2),
      workerTask(3),
      workerTask(4),
      workerTask(5),
      workerTask(6),
      workerTask(7),
      workerTask(8),
      workerTask(9),
      workerTask(10)
    ]);

    // EXACT GUARANTEE: Exactly 1 external create call occurred
    assert.equal(externalApiCalls, 1, 'Exactly one external call to Shiprocket must be made across 10 concurrent workers');

    const created = results.filter(r => r.status === 'created');
    const skipped = results.filter(r => r.status === 'skipped');
    assert.equal(created.length, 1, 'Exactly one worker must succeed in creating shipment');
    assert.equal(skipped.length, 9, 'Other 9 workers must be safely skipped');

    // DB state must be finalized
    assert.equal(mockDb[orderCode].shiprocket_order_id, 888123);
    assert.equal(mockDb[orderCode].shiprocket_shipment_id, 999123);
    assert.equal(mockDb[orderCode].shiprocket_awb, 'AWB_MOCK_10');
    assert.equal(mockDb[orderCode].shiprocket_claimed_at, null);
    assert.equal(mockDb[orderCode].shiprocket_claim_id, null);
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
  }
});

test('Shiprocket Idempotency: Existing shiprocket_order_id returns alreadyCreated without external call', async () => {
  const orderCode = 'SMF-20260913-7772';
  const mockDb = {
    [orderCode]: {
      order_code: orderCode,
      status: 'confirmed',
      shiprocket_order_id: 555666,
      shiprocket_shipment_id: 777888,
      shiprocket_awb: 'AWB_EXISTING'
    }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;

  try {
    const claimResult = await claimShiprocketFulfillment(orderCode, 'claim_retry_1');
    assert.equal(claimResult.claimed, false);
    assert.equal(claimResult.alreadyCreated, true);
    assert.equal(claimResult.shiprocketOrderId, 555666);
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
  }
});

test('Shiprocket Eligibility: Ineligible order states (upi_pending, cancelled, failed) cannot claim fulfillment', async () => {
  const mockDb = {
    'SMF-UNPAID-1': { order_code: 'SMF-UNPAID-1', status: 'upi_pending' },
    'SMF-CANCELLED-1': { order_code: 'SMF-CANCELLED-1', status: 'cancelled' },
    'SMF-FAILED-1': { order_code: 'SMF-FAILED-1', status: 'failed' }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;

  try {
    const unpaid = await claimShiprocketFulfillment('SMF-UNPAID-1', 'claim_1');
    assert.equal(unpaid.claimed, false);
    assert.equal(unpaid.ineligible, true);

    const cancelled = await claimShiprocketFulfillment('SMF-CANCELLED-1', 'claim_2');
    assert.equal(cancelled.claimed, false);
    assert.equal(cancelled.ineligible, true);

    const failed = await claimShiprocketFulfillment('SMF-FAILED-1', 'claim_3');
    assert.equal(failed.claimed, false);
    assert.equal(failed.ineligible, true);
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
  }
});

test('Shiprocket Crash Recovery: Stale claim (>120s) can be safely reclaimed by next worker', async () => {
  const orderCode = 'SMF-20260913-7773';
  const twoMinutesAgo = new Date(Date.now() - 130 * 1000).toISOString();

  const mockDb = {
    [orderCode]: {
      order_code: orderCode,
      status: 'confirmed',
      shiprocket_order_id: null,
      shiprocket_claimed_at: twoMinutesAgo,
      shiprocket_claim_id: 'crashed_worker_claim'
    }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;

  try {
    // Next worker attempts claim with fresh claim ID
    const newClaimId = 'recovery_worker_claim';
    const claimResult = await claimShiprocketFulfillment(orderCode, newClaimId, 120);

    assert.equal(claimResult.claimed, true, 'Stale claim must be reclaimable after timeout');
    assert.equal(mockDb[orderCode].shiprocket_claim_id, newClaimId);

    // Finalize
    await finalizeShiprocketFulfillment(orderCode, newClaimId, {
      orderId: 444333,
      shipmentId: 222111,
      awb: 'AWB_RECOVERED'
    });

    assert.equal(mockDb[orderCode].shiprocket_order_id, 444333);
    assert.equal(mockDb[orderCode].shiprocket_claim_id, null);
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
  }
});

test('Shiprocket Provider Failure: Claim is released so subsequent retry succeeds', async () => {
  const orderCode = 'SMF-20260913-7774';
  const mockDb = {
    [orderCode]: {
      order_code: orderCode,
      status: 'confirmed',
      shiprocket_order_id: null,
      shiprocket_claimed_at: null,
      shiprocket_claim_id: null
    }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;

  try {
    // 1. Worker 1 claims but Shiprocket API throws an error
    const claim1 = 'claim_attempt_1';
    const res1 = await claimShiprocketFulfillment(orderCode, claim1);
    assert.equal(res1.claimed, true);

    // Release on error
    await releaseShiprocketFulfillmentClaim(orderCode, claim1, 'Carrier pickup unserviceable');
    assert.equal(mockDb[orderCode].shiprocket_claimed_at, null);
    assert.equal(mockDb[orderCode].shiprocket_claim_id, null);
    assert.equal(mockDb[orderCode].shiprocket_error, 'Carrier pickup unserviceable');

    // 2. Worker 2 / Retry immediately attempts claim
    const claim2 = 'claim_attempt_2';
    const res2 = await claimShiprocketFulfillment(orderCode, claim2);
    assert.equal(res2.claimed, true, 'Retry must immediately succeed after release');
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
  }
});

test('Shiprocket Crash Window & Reconciliation: Crash post-creation recovered via reconciliation on 422 duplicate', async () => {
  const orderCode = 'SMF-20260913-9999';
  const mockDb = {
    [orderCode]: {
      order_code: orderCode,
      status: 'confirmed',
      shiprocket_order_id: null,
      shiprocket_claimed_at: new Date(Date.now() - 150 * 1000).toISOString(), // Stale claim
      shiprocket_claim_id: 'crashed_worker_claim'
    }
  };

  // Mock Shiprocket External Store
  const mockExternalOrders = {
    [orderCode]: {
      order_id: 999888,
      channel_order_id: orderCode,
      shipment_id: 777666,
      awb_code: 'AWB_RECONCILED_9999',
      courier_name: 'Delhivery Surface'
    }
  };

  globalThis.__MOCK_ORDER_DB__ = mockDb;
  globalThis.__MOCK_SHIPROCKET_SERVICE__ = {
    findByOrderCode: async (code) => mockExternalOrders[code] || null
  };

  try {
    // Worker B arrives after Worker A crashed
    const claimId = 'worker_b_claim';
    const claimResult = await claimShiprocketFulfillment(orderCode, claimId, 120);
    assert.equal(claimResult.claimed, true, 'Worker B must claim stale order');

    // Worker B attempts creation, but external Shiprocket rejects with 422 duplicate
    const mockCreateError = new Error('Shiprocket API error: The order id has already been taken.');
    mockCreateError.status = 422;

    // Reconciliation logic
    const { isDuplicateOrderError, findShiprocketOrderByOrderCode } = await import('../api/_shiprocket.js');
    assert.equal(isDuplicateOrderError(mockCreateError), true);

    const reconciled = await findShiprocketOrderByOrderCode(orderCode);
    assert.ok(reconciled, 'Must locate existing order in Shiprocket');
    assert.equal(reconciled.orderId, 999888);
    assert.equal(reconciled.shipmentId, 777666);
    assert.equal(reconciled.awb, 'AWB_RECONCILED_9999');

    await finalizeShiprocketFulfillment(orderCode, claimId, reconciled);

    // Verify DB state
    assert.equal(mockDb[orderCode].shiprocket_order_id, 999888);
    assert.equal(mockDb[orderCode].shiprocket_shipment_id, 777666);
    assert.equal(mockDb[orderCode].shiprocket_awb, 'AWB_RECONCILED_9999');
    assert.equal(mockDb[orderCode].shiprocket_courier, 'Delhivery Surface');
    assert.equal(mockDb[orderCode].shiprocket_claim_id, null);
  } finally {
    delete globalThis.__MOCK_ORDER_DB__;
    delete globalThis.__MOCK_SHIPROCKET_SERVICE__;
  }
});

