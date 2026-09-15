import crypto from 'node:crypto';
import { dispatchPrepaidPaymentEmails, sendPaymentFailedEmail, sendRefundProcessedEmail } from './_email-dispatch.js';
import resendWebhookHandler, { readRawBody } from './_resend-webhook.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
function getWebhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
}

// In-memory LRU cache of recently processed webhook event IDs
const processedEventIds = new Set();
const MAX_EVENT_CACHE = 5000;

function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return true;
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_EVENT_CACHE) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  return false;
}

async function findOrderByRazorpayOrderId(razorpayOrderId) {
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined' && Array.isArray(globalThis.__MOCK_ORDER_DB__)) {
    return globalThis.__MOCK_ORDER_DB__.find(o => o.payment_attempt_id === razorpayOrderId) || null;
  }
  if (!SERVICE_KEY || !razorpayOrderId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?payment_attempt_id=eq.${encodeURIComponent(razorpayOrderId)}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[webhook] Supabase order query error:', err.message);
    return null;
  }
}

async function updateOrderStatus(orderCode, patch) {
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined' && Array.isArray(globalThis.__MOCK_ORDER_DB__)) {
    const o = globalThis.__MOCK_ORDER_DB__.find(ord => ord.order_code === orderCode);
    if (o) {
      Object.assign(o, patch);
      return true;
    }
    return false;
  }
  if (!SERVICE_KEY || !orderCode) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('[webhook] Supabase order patch error:', err.message);
    return false;
  }
}

export const config = { api: { bodyParser: false } };

function isResendWebhookRequest(req) {
  const headers = req.headers || {};
  if (headers['x-razorpay-signature']) return false;
  const query = req.query || {};
  if (String(query.provider || '').toLowerCase() === 'resend') return true;
  const url = String(req.url || req.originalUrl || '');
  if (url.includes('resend-webhook')) return true;
  return Boolean(
    (headers['svix-id'] || headers['webhook-id']) &&
    (headers['svix-signature'] || headers['webhook-signature'])
  );
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isResendWebhookRequest(req)) {
    return resendWebhookHandler(req, res);
  }

  const signature = req.headers['x-razorpay-signature'] || '';
  const webhookSecret = getWebhookSecret();
  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Missing webhook signature or secret.' });
  }

  // Deduplicate by event ID if supplied by Razorpay
  const eventId = String(req.headers['x-razorpay-event-id'] || '').trim();
  if (eventId && isDuplicateEvent(eventId)) {
    return res.status(200).json({ received: true, duplicate: true, eventId });
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[webhook] Failed to read body', { message: err?.message || String(err) });
    return res.status(400).json({ error: 'Invalid webhook body.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  let signatureValid = false;
  try {
    const expected = Buffer.from(expectedSignature, 'hex');
    const received = Buffer.from(String(signature), 'hex');
    if (expected.length !== received.length) {
      crypto.timingSafeEqual(expected, expected);
      signatureValid = false;
    } else {
      signatureValid = crypto.timingSafeEqual(expected, received);
    }
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  try {
    const event = (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && typeof req.body.pipe !== 'function')
      ? req.body
      : JSON.parse(rawBody);
    const eventType = String(event.event || '');
    const paymentEntity = event.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id || event.payload?.order?.entity?.id || '';
    const paymentId = paymentEntity.id || '';

    if (eventType === 'payment.authorized') {
      // payment.authorized is not captured/settled. Do NOT confirm order yet.
      return res.status(200).json({ received: true, status: 'authorized', note: 'Awaiting payment capture before confirmation.' });
    }

    if (['payment.captured', 'order.paid'].includes(eventType)) {
      if (!razorpayOrderId) {
        return res.status(200).json({ received: true, note: 'No linked order id.' });
      }

      const order = await findOrderByRazorpayOrderId(razorpayOrderId);
      if (!order) {
        return res.status(200).json({ received: true, note: 'Smelloff order not found for attempt id.' });
      }

      // Validate currency and amount
      if (paymentEntity.currency && String(paymentEntity.currency).toUpperCase() !== 'INR') {
        console.error('[webhook] Currency mismatch for order', order.order_code, paymentEntity.currency);
        return res.status(200).json({ received: true, error: 'Currency mismatch' });
      }

      if (paymentEntity.amount !== undefined && Number(paymentEntity.amount) !== Number(order.amount)) {
        console.error('[webhook] Amount mismatch for order', order.order_code, paymentEntity.amount, order.amount);
        return res.status(200).json({ received: true, error: 'Amount mismatch' });
      }

      const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
      const confirmedOrder = terminalConfirmedStates.includes(order.status)
        ? order
        : null;

      if (!confirmedOrder) {
        await updateOrderStatus(order.order_code, {
          status: 'confirmed',
          upi_txn_id: paymentId || order.upi_txn_id,
          upi_response_code: 'RZP_WEBHOOK',
          payment_verified_at: new Date().toISOString(),
        });
      }

      const orderForEmail = {
        ...order,
        status: 'confirmed',
        upi_txn_id: paymentId || order.upi_txn_id,
        payment_verified_at: order.payment_verified_at || new Date().toISOString(),
      };
      try {
        await dispatchPrepaidPaymentEmails(orderForEmail, { route: '/api/webhook' });
      } catch (emailErr) {
        console.error('[webhook] Email dispatch exception (payment remains confirmed):', emailErr?.message || emailErr);
      }

      return res.status(200).json({
        received: true,
        idempotent: Boolean(confirmedOrder),
        status: confirmedOrder ? order.status : 'confirmed',
        orderCode: order.order_code,
      });
    }

    if (eventType === 'payment.failed') {
      if (razorpayOrderId) {
        const order = await findOrderByRazorpayOrderId(razorpayOrderId);
        const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
        if (order && !terminalConfirmedStates.includes(order.status) && (order.status === 'pending' || order.status === 'upi_pending')) {
          await updateOrderStatus(order.order_code, {
            status: 'failed',
            upi_response_code: 'RZP_FAILED',
          });
          try {
            await sendPaymentFailedEmail({ ...order, status: 'failed' }, { route: '/api/webhook' });
          } catch (emailErr) {
            console.error('[webhook] Failed-payment email exception:', emailErr?.message || emailErr);
          }
        }
      }
      return res.status(200).json({ received: true, event: 'payment.failed' });
    }

    if (eventType === 'refund.processed' || eventType === 'payment.refunded') {
      const refundEntity = event.payload?.refund?.entity || {};
      const refundAmountPaise = Number(refundEntity.amount || paymentEntity.amount || 0);
      if (razorpayOrderId) {
        const order = await findOrderByRazorpayOrderId(razorpayOrderId);
        if (order) {
          try {
            await sendRefundProcessedEmail(order, {
              route: '/api/webhook',
              amount: refundAmountPaise ? String(Math.round(refundAmountPaise / 100)) : undefined,
              method: 'original payment method',
            });
          } catch (emailErr) {
            console.error('[webhook] Refund email exception:', emailErr?.message || emailErr);
          }
        }
      }
      return res.status(200).json({ received: true, event: eventType });
    }

    return res.status(200).json({ received: true, unhandledEvent: eventType });
  } catch (error) {
    console.error('[webhook] Processing error:', error?.message || error);
    return res.status(500).json({ error: 'Webhook processing error.' });
  }
}
