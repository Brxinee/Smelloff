import { Resend } from 'resend';
import {
  orderConfirmation,
  orderShipped,
  outForDelivery,
  orderDelivered,
  welcomeEmail,
  abandonedCart,
  paymentReminder,
  orderCancelled,
  refundProcessed,
} from './email-templates.js';
import {
  isAdminAuthorized,
  verifyOrderToken,
  verifyOrderConfirmationToken,
  checkRateLimit,
} from './_security.js';
import { BASE_PRODUCT } from '../shared/products-config.js';

const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

const TEMPLATES = {
  orderConfirmation,
  orderShipped,
  outForDelivery,
  orderDelivered,
  welcomeEmail,
  abandonedCart,
  paymentReminder,
  orderCancelled,
  refundProcessed,
};

const RESTRICTED_TEMPLATES = new Set([
  'orderShipped',
  'outForDelivery',
  'orderDelivered',
  'orderCancelled',
  'refundProcessed',
  'abandonedCart',
  'paymentReminder'
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);
const MAX_BODY_BYTES = 40 * 1024;
const MAX_DATA_KEYS = 80;

// Best-effort in-memory rate limiter (per warm lambda instance).
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const rlBuckets = new Map();

function rateLimited(key) {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (!b || now >= b.resetAt) {
    rlBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rlBuckets.size > 5000) {
      for (const [k, v] of rlBuckets) if (now >= v.resetAt) rlBuckets.delete(k);
    }
    return false;
  }
  if (b.count >= RATE_LIMIT) return true;
  bucketCount(b);
  return false;
}

function bucketCount(b) {
  b.count++;
}

// In-memory idempotency cache for order confirmation emails
const sentConfirmationOrders = new Map();
const MAX_IDEMPOTENCY_CACHE = 10000;

export function hasConfirmationBeenSent(orderCode) {
  if (typeof globalThis.__MOCK_SENT_CONFIRMATIONS__ !== 'undefined') {
    return globalThis.__MOCK_SENT_CONFIRMATIONS__.has(orderCode);
  }
  return sentConfirmationOrders.has(orderCode);
}

export function markConfirmationAsSent(orderCode) {
  if (typeof globalThis.__MOCK_SENT_CONFIRMATIONS__ !== 'undefined') {
    globalThis.__MOCK_SENT_CONFIRMATIONS__.add(orderCode);
  }
  if (sentConfirmationOrders.size >= MAX_IDEMPOTENCY_CACHE) {
    const oldestKey = sentConfirmationOrders.keys().next().value;
    if (oldestKey) sentConfirmationOrders.delete(oldestKey);
  }
  sentConfirmationOrders.set(orderCode, Date.now());
}

export async function fetchOrderByCode(orderCode) {
  if (!orderCode) return null;
  if (typeof globalThis.__MOCK_ORDER_FETCHER__ === 'function') {
    return globalThis.__MOCK_ORDER_FETCHER__(orderCode);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return null;
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');
    const url = `${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[send-email] Supabase fetch error:', err.message);
    return null;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin/server-to-server requests may omit Origin
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_ENV !== 'production') {
    if (origin.endsWith('.vercel.app') || origin.endsWith('.run.app') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  }
  return false;
}

function sanitizeData(value, depth = 0) {
  if (depth > 3 || value == null) return value == null ? null : undefined;
  if (typeof value === 'string') return value.slice(0, 8000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 40).map(v => sanitizeData(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value).slice(0, MAX_DATA_KEYS)) {
      if (/password|secret|token|authorization|cookie|service.?role|api.?key/i.test(key)) continue;
      out[String(key).slice(0, 100)] = sanitizeData(raw, depth + 1);
    }
    return out;
  }
  return undefined;
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Admin-Secret, X-Order-Token, X-Confirmation-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pickIp = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  const ip = pickIp(req.headers['cf-connecting-ip'])
    || pickIp(req.headers['true-client-ip'])
    || pickIp(req.headers['x-forwarded-for'])
    || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

  try {
    const rawBody = req.body && typeof req.body === 'object' ? req.body : {};
    if (JSON.stringify(rawBody).length > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request too large' });
    }

    const type = String(rawBody.type || '').trim();
    const builder = TEMPLATES[type];
    if (!builder) return res.status(400).json({ error: 'Unknown email template' });

    // Protect sensitive order lifecycle emails from unauthenticated public invocation
    if (RESTRICTED_TEMPLATES.has(type) && !isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Transactional template requires admin authorization.' });
    }

    // -------------------------------------------------------------
    // ORDER CONFIRMATION: HARDENED AUTHORIZATION & AUTHORITATIVE DATA
    // -------------------------------------------------------------
    if (type === 'orderConfirmation') {
      const orderCode = String(
        rawBody.orderCode || rawBody.orderId ||
        rawBody.data?.orderId || rawBody.data?.orderCode || ''
      ).trim().toUpperCase();

      if (!orderCode || !/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
        return res.status(400).json({ error: 'Valid order code required (e.g. SMF-YYYYMMDD-XXXX)' });
      }

      const order = await fetchOrderByCode(orderCode);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const adminAuth = isAdminAuthorized(req);
      const dbEmail = String(order.customer_email || '').trim().toLowerCase();
      const dbPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);

      const confirmationToken = String(
        rawBody.confirmationToken || rawBody.confirmation_token ||
        rawBody.data?.confirmationToken || rawBody.data?.confirmation_token ||
        req.headers['x-confirmation-token'] || ''
      ).trim();

      const orderToken = String(
        rawBody.orderToken || rawBody.order_token ||
        rawBody.data?.orderToken || rawBody.data?.order_token ||
        req.headers['x-order-token'] || ''
      ).trim();

      const customerPhone = String(
        rawBody.phone || rawBody.customerPhone ||
        rawBody.data?.phone || rawBody.data?.customerPhone || ''
      ).replace(/\D/g, '').slice(-10);

      const isConfirmationTokenValid = confirmationToken
        ? verifyOrderConfirmationToken(orderCode, dbEmail, confirmationToken)
        : false;

      const isOrderTokenValid = orderToken
        ? verifyOrderToken(orderCode, dbPhone, orderToken)
        : false;

      const isPhoneValid = Boolean(customerPhone && dbPhone && customerPhone === dbPhone);

      if (!adminAuth && !isConfirmationTokenValid && !isOrderTokenValid && !isPhoneValid) {
        return res.status(403).json({
          error: 'Order confirmation requires valid authorization (confirmation token, order token, customer phone, or admin authorization).'
        });
      }

      if (!dbEmail || !EMAIL_RE.test(dbEmail)) {
        return res.status(400).json({ error: 'Order does not have a valid customer email address.' });
      }

      const requestedTo = String(rawBody.to || '').trim().toLowerCase();
      if (requestedTo && requestedTo !== dbEmail) {
        return res.status(400).json({ error: 'Recipient email does not match order record.' });
      }

      const orderStatus = String(order.status || '').toLowerCase();
      const paymentMethod = String(order.payment_method || '').toLowerCase();

      if (['failed', 'cancelled'].includes(orderStatus)) {
        return res.status(400).json({ error: `Cannot send confirmation email for ${orderStatus} order.` });
      }

      const terminalConfirmedStates = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
      if (paymentMethod === 'cod') {
        if (orderStatus !== 'placed' && !terminalConfirmedStates.includes(orderStatus)) {
          return res.status(400).json({ error: 'COD order is not in a placed or confirmed state.' });
        }
      } else {
        if (!terminalConfirmedStates.includes(orderStatus)) {
          return res.status(400).json({ error: 'Payment has not been confirmed for this order.' });
        }
      }

      // Idempotency: avoid sending duplicate confirmation emails
      if (hasConfirmationBeenSent(orderCode)) {
        return res.status(200).json({
          ok: true,
          idempotent: true,
          orderId: orderCode,
          message: 'Order confirmation email already sent.'
        });
      }

      // Authoritative template data strictly derived from database record
      const addr = order.address || {};
      const customerName = (typeof addr === 'object' && addr.name) || (typeof order.name === 'string' && order.name) || 'there';
      const addressFormatted = typeof addr === 'string'
        ? addr
        : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

      const amountRupees = order.amount
        ? String(Math.round(order.amount / 100))
        : String(BASE_PRODUCT.price);

      const codFeeRupees = paymentMethod === 'cod'
        ? (order.cod_fee ? Math.round(order.cod_fee / 100) : BASE_PRODUCT.codFee)
        : 0;

      const paymentMethodLabel = paymentMethod === 'cod'
        ? 'Cash on Delivery'
        : 'Prepaid (Razorpay)';

      const authoritativeData = {
        orderId: orderCode,
        customerName,
        amount: amountRupees,
        codFee: codFeeRupees,
        address: addressFormatted,
        paymentMethod: paymentMethodLabel,
      };

      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY missing');
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const { subject, html } = orderConfirmation(authoritativeData);
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: FROM,
        to: dbEmail,
        replyTo: REPLY_TO,
        subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
        html,
      });

      if (result.error) {
        console.error('Resend error:', result.error);
        return res.status(502).json({ error: 'Email could not be sent.' });
      }

      // Only mark idempotent on successful dispatch
      markConfirmationAsSent(orderCode);
      return res.status(200).json({ id: result.data?.id, ok: true, orderId: orderCode });
    }

    // -------------------------------------------------------------
    // OTHER TEMPLATES (e.g. welcomeEmail, admin lifecycle emails)
    // -------------------------------------------------------------
    const to = String(rawBody.to || '').trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'Invalid email address' });

    if (type === 'welcomeEmail') {
      if (!checkRateLimit(`welcome-recipient:${to}`, 2, 24 * 60 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many welcome emails requested for this address. Please try again later.' });
      }
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY missing');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const data = sanitizeData(rawBody.data || {});
    const { subject, html } = builder(data || {});
    if (!subject || !html || typeof subject !== 'string' || typeof html !== 'string') {
      return res.status(500).json({ error: 'Invalid email template output' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return res.status(502).json({ error: 'Email could not be sent.' });
    }

    return res.status(200).json({ id: result.data?.id, ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Email could not be sent.' });
  }
}