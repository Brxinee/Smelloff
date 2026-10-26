// A prepaid checkout that opened Razorpay and never paid gets one reminder
// email, 45 minutes to 24 hours later, linking back to checkout with the same
// quantity. Never for COD, test orders, a customer who has since ordered, or
// an order Razorpay shows as paid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Resend } from 'resend';
import {
  dispatchDuePaymentReminders,
  isPaymentReminderDue,
  hasLaterSale,
  paymentRetryUrl,
} from '../api/_email-dispatch.js';
import { renderTemplate } from '../api/_email-templates.js';
import { isTestOrInternal } from '../api/sheets-sync.js';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const minutesAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString();

function pending(overrides = {}) {
  return {
    order_code: 'SMF-20261026-4242',
    customer_email: 'buyer@example.com',
    customer_phone: '9876543210',
    status: 'upi_pending',
    payment_method: 'upi',
    amount: 41900,
    payment_attempt_id: 'order_rzp_1',
    address: { name: 'Arjun Rao', line: '12 Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' },
    items: [{ quantity: 2, price: 229 }],
    created_at: minutesAgo(60),
    ...overrides,
  };
}

async function runWith(orders, { payments = [], fail = false } = {}) {
  const prev = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key';
  const sent = [];
  const original = Resend.prototype.post;
  Resend.prototype.post = async (path, entity, options = {}) => {
    sent.push({ entity, key: options.idempotencyKey });
    return { data: { id: `email_${sent.length}` }, error: null };
  };
  globalThis.__MOCK_ORDER_DB__ = orders;
  try {
    const result = await dispatchDuePaymentReminders({ route: 'test' }, NOW, {
      isInternal: isTestOrInternal,
      fetchPayments: async () => {
        if (fail) throw new Error('razorpay down');
        return { items: payments };
      },
    });
    return { result, sent };
  } finally {
    Resend.prototype.post = original;
    delete globalThis.__MOCK_ORDER_DB__;
    if (prev !== undefined) process.env.RESEND_API_KEY = prev; else delete process.env.RESEND_API_KEY;
  }
}

test('reminder is due 45 minutes to 24 hours after an unpaid prepaid order', () => {
  assert.equal(isPaymentReminderDue(pending({ created_at: minutesAgo(30) }), NOW), false);
  assert.equal(isPaymentReminderDue(pending({ created_at: minutesAgo(45) }), NOW), true);
  assert.equal(isPaymentReminderDue(pending({ created_at: minutesAgo(23 * 60) }), NOW), true);
  assert.equal(isPaymentReminderDue(pending({ created_at: minutesAgo(25 * 60) }), NOW), false);
  assert.equal(isPaymentReminderDue(pending({ status: 'confirmed' }), NOW), false);
  assert.equal(isPaymentReminderDue(pending({ payment_method: 'cod' }), NOW), false);
  assert.equal(isPaymentReminderDue(pending({ customer_email: 'nope' }), NOW), false);
});

test('one unpaid order sends one reminder back to checkout with the same quantity', async () => {
  const { result, sent } = await runWith([pending()]);
  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].key, 'payment-reminder/SMF-20261026-4242');
  assert.match(sent[0].entity.html, /odorstrike\?buy=1&amp;qty=2|odorstrike\?buy=1&qty=2/);
  assert.match(sent[0].entity.html, /Cash on Delivery/);
  assert.equal(paymentRetryUrl(pending({ items: [{ quantity: 40 }] })), 'https://smelloff.in/odorstrike?buy=1&qty=10');
});

test('no reminder when Razorpay shows a payment, or when Razorpay cannot be asked', async () => {
  const paid = await runWith([pending()], { payments: [{ status: 'captured' }] });
  assert.equal(paid.sent.length, 0);
  assert.equal(paid.result.results[0].reason, 'PAYMENT_ON_RAZORPAY');
  const down = await runWith([pending()], { fail: true });
  assert.equal(down.sent.length, 0);
  const failedOnly = await runWith([pending()], { payments: [{ status: 'failed' }] });
  assert.equal(failedOnly.sent.length, 1);
});

test('no reminder when the same customer ordered again afterwards', async () => {
  const later = pending({ order_code: 'SMF-20261026-5555', status: 'placed', payment_method: 'cod', created_at: minutesAgo(20), customer_email: 'other@example.com' });
  assert.equal(hasLaterSale(pending(), [pending(), later]), true);
  const { result, sent } = await runWith([pending(), later]);
  assert.equal(sent.length, 0);
  assert.equal(result.results[0].reason, 'ORDERED_AGAIN');
});

test('test and internal orders never get a reminder', async () => {
  const { sent } = await runWith([
    pending({ address: { name: 'Test order', line: 'do not ship' } }),
    pending({ order_code: 'SMF-20261026-7777', customer_email: 'owner@smelloff.in' }),
  ]);
  assert.equal(sent.length, 0);
});

test('reminder copy states nothing was charged and offers COD, with no urgency or discount', () => {
  const r = renderTemplate('paymentReminder', { orderId: 'SMF-20261026-4242', customerName: 'Arjun', amount: '419', retryUrl: 'https://smelloff.in/odorstrike?buy=1&qty=2' });
  assert.match(r.text, /Nothing has been charged/);
  assert.match(r.text, /Cash on Delivery/);
  assert.match(r.text, /odorstrike\?buy=1&qty=2/);
  assert.doesNotMatch(`${r.subject} ${r.text}`, /hurry|last chance|expires|only \d+ left|% off|discount/i);
});
