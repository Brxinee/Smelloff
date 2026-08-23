import { isAllowedOrigin, clientIp, checkRateLimit, verifyOrderToken } from './_security.js';
import { Resend } from 'resend';
import { orderConfirmation } from './email-templates.js';
import { isValidTransition } from '../shared/products-config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
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
  try {
    const patchBody = {
      status: 'confirmed',
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (txnDetails.upiTxnId) patchBody.upi_txn_id = txnDetails.upiTxnId;
    if (txnDetails.responseCode) patchBody.upi_response_code = txnDetails.responseCode;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
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
  } catch (err) {
    console.error('[payment-status] Supabase confirmation patch error:', err.message);
    return null;
  }
}

export async function checkBankUpiStatus(order) {
  const statusApiUrl = process.env.UPI_STATUS_API_URL || process.env.UPI_CHECK_URL;
  const statusApiKey = process.env.UPI_STATUS_API_KEY || process.env.UPI_SECRET_KEY;
  if (!statusApiUrl) return null;

  try {
    const txnRef = order.upi_transaction_ref || order.order_code;
    const amount = order.amount ? (order.amount / 100).toFixed(2) : '229.00';
    const res = await fetch(`${statusApiUrl}?txnRef=${encodeURIComponent(txnRef)}&amount=${encodeURIComponent(amount)}&orderId=${encodeURIComponent(order.order_code)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(statusApiKey ? { Authorization: `Bearer ${statusApiKey}`, 'X-API-Key': statusApiKey } : {})
      }
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json) return null;

    const status = String(json.status || json.txnStatus || json.result || '').toUpperCase();
    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'SETTLED' || json.verified === true) {
      return {
        verified: true,
        upiTxnId: json.upiTxnId || json.rrn || json.bankRrn || null,
        responseCode: json.responseCode || '00'
      };
    }
    if (status === 'FAILURE' || status === 'FAILED') {
      return { verified: false, failed: true };
    }
    return null;
  } catch (err) {
    console.error('[payment-status] Bank UPI verification error:', err.message);
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

    if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
    }

    const order = await fetchOrderByCode(orderCode);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
    const tokenValid = orderToken ? verifyOrderToken(orderCode, dbPhone, orderToken) : false;
    const phoneValid = customerPhone && dbPhone && customerPhone === dbPhone;

    if (!tokenValid && !phoneValid) {
      return res.status(403).json({ error: 'Order ownership verification failed. Valid order token or phone required.' });
    }

    const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (terminalConfirmedStates.includes(order.status)) {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'confirmed',
        orderStatus: order.status,
        verified: true,
        paymentMethod: order.payment_method,
        amount: order.amount ? order.amount / 100 : 229,
        verifiedAt: order.payment_verified_at || order.updated_at
      });
    }

    if (order.status === 'verification_pending') {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'verification_pending',
        verified: false,
        paymentMethod: order.payment_method,
        amount: order.amount ? order.amount / 100 : 229,
        upiRef: order.upi_ref || null,
        message: 'UTR submitted — awaiting payment verification by our team'
      });
    }

    if (order.status === 'payment_not_verified') {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'payment_not_verified',
        verified: false,
        paymentMethod: order.payment_method,
        amount: order.amount ? order.amount / 100 : 229,
        message: 'Payment could not be verified. Please check UTR or submit again.'
      });
    }

    if (order.status === 'cancelled' || order.status === 'failed') {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: order.status,
        verified: false,
        paymentMethod: order.payment_method
      });
    }

    if (order.status === 'upi_pending') {
      const bankResult = await checkBankUpiStatus(order);
      if (bankResult && bankResult.verified) {
        const confirmedOrder = await markOrderConfirmed(orderCode, bankResult);
        if (confirmedOrder && process.env.RESEND_API_KEY && order.customer_email) {
          try {
            const addr = order.address || {};
            const addrFormatted = typeof addr === 'string' ? addr : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
            const { subject, html } = orderConfirmation({
              orderId: orderCode,
              customerName: (typeof addr === 'object' && addr.name) || 'Customer',
              amount: String(order.amount ? order.amount / 100 : 229),
              codFee: 0,
              address: addrFormatted,
              paymentMethod: 'UPI (Prepaid)'
            });
            const resend = new Resend(process.env.RESEND_API_KEY);
            resend.emails.send({ from: FROM, to: order.customer_email, replyTo: REPLY_TO, subject, html })
              .catch(e => console.error('[payment-status] Confirmation email error:', e.message));
          } catch (emailErr) {
            console.error('[payment-status] Email formatting error:', emailErr.message);
          }
        }
        return res.status(200).json({
          ok: true,
          orderId: orderCode,
          status: 'confirmed',
          verified: true,
          paymentMethod: 'upi',
          amount: order.amount ? order.amount / 100 : 229,
          verifiedAt: new Date().toISOString()
        });
      }
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
