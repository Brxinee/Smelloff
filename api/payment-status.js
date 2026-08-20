import {
  isAllowedOrigin,
  clientIp,
  checkRateLimit,
  verifyOrderToken
} from './_security.js';
import { Resend } from 'resend';
import { orderConfirmation } from './email-templates.js';
import { verifyPayuPayment, isPayuConfigured } from './payu-upi.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[payment-status] Supabase fetch error:', err.message);
    return null;
  }
}

async function markOrderConfirmed(orderCode, txnDetails = {}) {
  if (!SERVICE_KEY || !orderCode) return null;
  const patchBody = {
    status: 'confirmed',
    upi_status: 'success',
    payment_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (txnDetails.upiTxnId) patchBody.upi_txn_id = txnDetails.upiTxnId;
  if (txnDetails.responseCode) patchBody.upi_response_code = String(txnDetails.responseCode);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&status=eq.upi_pending`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(patchBody)
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function sendConfirmationEmail(order) {
  if (!process.env.RESEND_API_KEY || !order?.customer_email) return;
  try {
    const addr = order.address || {};
    const addrFormatted = typeof addr === 'string'
      ? addr
      : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    const { subject, html } = orderConfirmation({
      orderId: order.order_code,
      customerName: (typeof addr === 'object' && addr.name) || 'Customer',
      amount: String(order.amount ? order.amount / 100 : 229),
      codFee: 0,
      address: addrFormatted,
      paymentMethod: 'UPI (Prepaid)'
    });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: order.customer_email, replyTo: REPLY_TO, subject, html });
  } catch (err) {
    console.error('[payment-status] Confirmation email error:', err.message);
  }
}

export async function checkBankUpiStatus(order) {
  if (!order || order.payment_method !== 'upi' || !order.upi_transaction_ref || !isPayuConfigured()) return null;
  try {
    const result = await verifyPayuPayment(order.upi_transaction_ref);
    if (!result) return null;
    const expectedAmount = Number(order.amount || 0) / 100;
    const amountMatches = result.amount == null || Math.abs(Number(result.amount) - expectedAmount) < 0.005;
    return {
      verified: Boolean(result.success && amountMatches),
      failed: result.status === 'failed' || result.status === 'failure',
      upiTxnId: result.payuTxnId || result.bankRef || null,
      responseCode: result.status,
      amountMatches,
      providerStatus: result.status
    };
  } catch (err) {
    console.error('[payment-status] PayU verification error:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`payment-status:${ip}`, 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many status check requests. Please slow down.' });
  }

  try {
    const params = req.method === 'GET' ? req.query : (req.body || {});
    const orderCode = String(params.orderCode || params.orderId || params.order_code || '').trim().toUpperCase();
    const customerPhone = String(params.phone || params.customerPhone || '').replace(/\D/g, '').slice(-10);
    const orderToken = String(params.orderToken || params.order_token || req.headers['x-order-token'] || '').trim();
    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) return res.status(400).json({ error: 'Valid order code required.' });

    const order = await fetchOrderByCode(orderCode);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
    const tokenValid = orderToken ? verifyOrderToken(orderCode, dbPhone, orderToken) : false;
    const phoneValid = customerPhone && dbPhone && customerPhone === dbPhone;
    if (!tokenValid && !phoneValid) return res.status(403).json({ error: 'Order ownership verification failed.' });

    const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (terminalConfirmedStates.includes(order.status)) {
      return res.status(200).json({ ok: true, orderId: orderCode, status: 'confirmed', orderStatus: order.status, verified: true, paymentMethod: order.payment_method, amount: order.amount ? order.amount / 100 : 229, verifiedAt: order.payment_verified_at || order.updated_at });
    }

    if (order.status === 'cancelled' || order.status === 'failed') {
      return res.status(200).json({ ok: true, orderId: orderCode, status: order.status, verified: false, paymentMethod: order.payment_method });
    }

    if (order.status === 'upi_pending') {
      if (!isPayuConfigured()) return res.status(503).json({ error: 'UPI verification is temporarily unavailable.' });
      const result = await checkBankUpiStatus(order);
      if (result?.verified) {
        const confirmedOrder = await markOrderConfirmed(orderCode, result);
        if (!confirmedOrder) {
          const current = await fetchOrderByCode(orderCode);
          if (current?.status === 'confirmed') {
            return res.status(200).json({ ok: true, orderId: orderCode, status: 'confirmed', verified: true, paymentMethod: 'upi', amount: expectedAmountSafe(order), verifiedAt: current.payment_verified_at || current.updated_at });
          }
          return res.status(409).json({ error: 'Payment verified but order confirmation was not persisted. Please retry status check.' });
        }
        await sendConfirmationEmail(confirmedOrder);
        return res.status(200).json({ ok: true, orderId: orderCode, status: 'confirmed', verified: true, paymentMethod: 'upi', amount: confirmedOrder.amount / 100, verifiedAt: confirmedOrder.payment_verified_at });
      }
      if (result?.failed) return res.status(200).json({ ok: true, orderId: orderCode, status: 'failed', verified: false, paymentMethod: 'upi', message: 'UPI payment was not completed.' });
    }

    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      status: order.status,
      verified: false,
      paymentMethod: order.payment_method,
      amount: order.amount ? order.amount / 100 : 229,
      message: order.status === 'upi_pending' ? 'Awaiting UPI payment confirmation' : `Order is in status '${order.status}'`
    });
  } catch (err) {
    console.error('[payment-status] Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve payment status.' });
  }
}

function expectedAmountSafe(order) {
  return order?.amount ? order.amount / 100 : 229;
}
