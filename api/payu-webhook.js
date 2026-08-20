import crypto from 'node:crypto';
import { verifyPayuPayment, verifyPayuResponseHash, isPayuConfigured } from './payu-upi.js';
import { orderConfirmation } from './email-templates.js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    return Object.fromEntries(new URLSearchParams(String(body)));
  } catch {
    return {};
  }
}

async function findOrderByTxnId(txnid) {
  if (!SERVICE_KEY || !txnid) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?upi_transaction_ref=eq.${encodeURIComponent(txnid)}&select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function confirmOrder(order, verification) {
  const expectedAmount = Number(order.amount || 0) / 100;
  if (verification.amount != null && Math.abs(Number(verification.amount) - expectedAmount) >= 0.005) return null;

  const patch = {
    status: 'confirmed',
    upi_status: 'success',
    payment_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (verification.payuTxnId) patch.upi_txn_id = verification.payuTxnId;
  if (verification.bankRef) patch.upi_txn_id = verification.bankRef;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(order.order_code)}&status=eq.upi_pending`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(patch)
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function sendConfirmation(order) {
  if (!process.env.RESEND_API_KEY || !order?.customer_email) return;
  try {
    const address = typeof order.address === 'string'
      ? order.address
      : [order.address?.line, order.address?.city, order.address?.state, order.address?.pincode].filter(Boolean).join(', ');
    const { subject, html } = orderConfirmation({
      orderId: order.order_code,
      customerName: order.address?.name || 'there',
      amount: String(order.amount / 100),
      codFee: 0,
      address,
      paymentMethod: 'UPI (Prepaid)'
    });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: order.customer_email, replyTo: REPLY_TO, subject, html });
  } catch (err) {
    console.error('[payu-webhook] Email error:', err.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isPayuConfigured()) return res.status(503).json({ error: 'UPI provider is not configured.' });

  try {
    const body = parseBody(req.body);
    if (!verifyPayuResponseHash(body)) return res.status(401).json({ error: 'Invalid payment callback signature.' });

    const txnid = String(body.txnid || '').trim();
    const status = String(body.status || '').trim().toLowerCase();
    if (!txnid) return res.status(400).json({ error: 'Transaction ID required.' });

    const order = await findOrderByTxnId(txnid);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (order.status === 'confirmed' || ['packed', 'dispatched', 'out_for_delivery', 'delivered'].includes(order.status)) {
      return res.status(200).json({ ok: true, idempotent: true, status: order.status });
    }

    if (status !== 'success') {
      if (['failure', 'failed'].includes(status)) {
        await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(order.order_code)}&status=eq.upi_pending`, {
          method: 'PATCH',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed', upi_status: 'failed', updated_at: new Date().toISOString() })
        });
      }
      return res.status(200).json({ ok: true, status });
    }

    const verified = await verifyPayuPayment(txnid);
    if (!verified.success) return res.status(409).json({ error: 'Payment callback was not confirmed by PayU status verification.' });

    const expectedAmount = Number(order.amount || 0) / 100;
    if (verified.amount != null && Math.abs(Number(verified.amount) - expectedAmount) >= 0.005) {
      return res.status(409).json({ error: 'Payment amount mismatch.' });
    }

    const confirmed = await confirmOrder(order, verified);
    if (!confirmed) return res.status(200).json({ ok: true, status: 'already_processed' });
    await sendConfirmation(confirmed);

    return res.status(200).json({ ok: true, orderId: order.order_code, status: 'confirmed' });
  } catch (err) {
    console.error('[payu-webhook] Error:', err);
    return res.status(500).json({ error: 'Payment callback processing failed.' });
  }
}
