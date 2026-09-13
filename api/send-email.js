import { randomUUID } from 'crypto';
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

// In-memory idempotency cache for order confirmation emails (fast instance-local short-circuit)
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

function supaHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * Distributed atomic claim: ensures AT MOST ONE worker/instance across the entire
 * serverless deployment can claim the right to dispatch an order confirmation email.
 *
 * Implements a durable Postgres row-level atomic lock with stale claim recovery:
 * 1. Checks in-memory fast-path (instant reject if already completed locally).
 * 2. Checks mock DB if in test mode (for concurrency & multi-instance tests).
 * 3. Calls Supabase RPC `claim_order_confirmation_email` (atomic FOR UPDATE lock).
 * 4. Falls back to direct PostgREST atomic conditional PATCH if RPC is unavailable.
 */
export async function claimOrderConfirmationEmail(orderCode, claimId, staleSeconds = 90) {
  if (!orderCode) return { claimed: false, alreadySent: false };

  // 1. Fast in-memory check
  if (hasConfirmationBeenSent(orderCode)) {
    return { claimed: false, alreadySent: true };
  }

  // 2. Mock DB check (for deterministic testing & isolated simulation)
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (!order) return { claimed: false, alreadySent: false };
    if (order.confirmation_email_sent_at) {
      return { claimed: false, alreadySent: true };
    }
    const now = Date.now();
    const claimedAt = order.confirmation_email_claimed_at ? new Date(order.confirmation_email_claimed_at).getTime() : null;
    const isStale = claimedAt ? (now - claimedAt > staleSeconds * 1000) : true;
    if (claimedAt && !isStale) {
      return { claimed: false, alreadySent: false, inProgress: true };
    }
    order.confirmation_email_claimed_at = new Date(now).toISOString();
    order.confirmation_email_claim_id = claimId;
    return { claimed: true, alreadySent: false };
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    // If Supabase service role key is not configured, fall back to in-memory idempotency
    if (hasConfirmationBeenSent(orderCode)) {
      return { claimed: false, alreadySent: true };
    }
    return { claimed: true, alreadySent: false };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  // 3. Try atomic RPC in Postgres
  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_order_confirmation_email`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({
        p_order_code: orderCode,
        p_claim_id: claimId,
        p_stale_seconds: staleSeconds,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (rpcRes.ok) {
      const rows = await rpcRes.json().catch(() => []);
      const res = Array.isArray(rows) && rows.length ? rows[0] : rows;
      if (res && typeof res === 'object') {
        return {
          claimed: Boolean(res.claimed),
          alreadySent: Boolean(res.already_sent),
          inProgress: !res.claimed && !res.already_sent,
        };
      }
    }
  } catch (err) {
    console.warn('[send-email] RPC claim failed, attempting direct table update:', err.message);
  }

  // 4. Fallback to direct PostgREST atomic conditional PATCH
  try {
    const staleIso = new Date(Date.now() - staleSeconds * 1000).toISOString();
    const patchUrl = `${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&confirmation_email_sent_at=is.null&or=(confirmation_email_claimed_at.is.null,confirmation_email_claimed_at.lt.${encodeURIComponent(staleIso)})`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        confirmation_email_claimed_at: new Date().toISOString(),
        confirmation_email_claim_id: claimId,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (patchRes.ok) {
      const rows = await patchRes.json().catch(() => []);
      if (Array.isArray(rows) && rows.length === 1) {
        return { claimed: true, alreadySent: false };
      }
    }

    // If 0 rows were updated, check whether it was already sent
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=confirmation_email_sent_at,confirmation_email_claimed_at`, {
      headers: supaHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (checkRes.ok) {
      const rows = await checkRes.json().catch(() => []);
      if (Array.isArray(rows) && rows.length && rows[0].confirmation_email_sent_at) {
        return { claimed: false, alreadySent: true };
      }
    }
    return { claimed: false, alreadySent: false, inProgress: true };
  } catch (err) {
    console.error('[send-email] PostgREST claim error:', err.message);
    return { claimed: false, alreadySent: false };
  }
}

/**
 * Permanently finalizes order confirmation email send upon Resend success.
 */
export async function finalizeOrderConfirmationEmail(orderCode, claimId) {
  // Always update in-memory cache
  markConfirmationAsSent(orderCode);

  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (order && order.confirmation_email_claim_id === claimId) {
      order.confirmation_email_sent_at = new Date().toISOString();
      order.confirmation_email_claim_id = null;
    }
    return;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return;

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_order_confirmation_email`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({ p_order_code: orderCode, p_claim_id: claimId }),
      signal: AbortSignal.timeout(5000),
    });
    if (rpcRes.ok) return;
  } catch {}

  try {
    await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&confirmation_email_claim_id=eq.${encodeURIComponent(claimId)}`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        confirmation_email_sent_at: new Date().toISOString(),
        confirmation_email_claim_id: null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[send-email] Finalize claim error:', err.message);
  }
}

/**
 * Releases claim on provider failure so customer or background retries can proceed immediately.
 */
export async function releaseOrderConfirmationClaim(orderCode, claimId) {
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (order && order.confirmation_email_claim_id === claimId && !order.confirmation_email_sent_at) {
      order.confirmation_email_claimed_at = null;
      order.confirmation_email_claim_id = null;
    }
    return;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return;

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/release_order_confirmation_claim`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({ p_order_code: orderCode, p_claim_id: claimId }),
      signal: AbortSignal.timeout(5000),
    });
    if (rpcRes.ok) return;
  } catch {}

  try {
    await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&confirmation_email_claim_id=eq.${encodeURIComponent(claimId)}&confirmation_email_sent_at=is.null`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        confirmation_email_claimed_at: null,
        confirmation_email_claim_id: null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[send-email] Release claim error:', err.message);
  }
}

export async function fetchOrderByCode(orderCode) {
  if (!orderCode) return null;
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    return order ? { ...order } : null;
  }
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

      // 1. Initial check: if already recorded as sent on fetched order or in local cache
      if (order.confirmation_email_sent_at || hasConfirmationBeenSent(orderCode)) {
        return res.status(200).json({
          ok: true,
          success: true,
          idempotent: true,
          orderId: orderCode,
          message: 'Order confirmation email already sent.'
        });
      }

      // 2. Atomic distributed claim: guarantees at most one worker claims the right to send
      const claimId = randomUUID();
      const claim = await claimOrderConfirmationEmail(orderCode, claimId);
      if (claim.alreadySent) {
        return res.status(200).json({
          ok: true,
          success: true,
          idempotent: true,
          orderId: orderCode,
          message: 'Order confirmation email already sent.'
        });
      }
      if (!claim.claimed) {
        return res.status(200).json({
          ok: true,
          success: true,
          idempotent: true,
          orderId: orderCode,
          message: 'Order confirmation email send in progress.'
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
        await releaseOrderConfirmationClaim(orderCode, claimId);
        return res.status(500).json({ error: 'Email service not configured' });
      }

      try {
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
          await releaseOrderConfirmationClaim(orderCode, claimId);
          return res.status(502).json({ error: 'Email could not be sent.' });
        }

        // Successfully sent: finalize claim and record confirmation_email_sent_at
        await finalizeOrderConfirmationEmail(orderCode, claimId);
        return res.status(200).json({ id: result.data?.id, ok: true, success: true, orderId: orderCode });
      } catch (sendErr) {
        console.error('Resend send exception:', sendErr.message);
        await releaseOrderConfirmationClaim(orderCode, claimId);
        return res.status(502).json({ error: 'Email delivery failed' });
      }
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