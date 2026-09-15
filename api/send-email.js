import { randomUUID } from 'crypto';
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
  paymentConfirmation,
  adminNewOrder,
  adminPaymentConfirmed,
  emailFailure,
  diagnosticTest,
  paymentFailed,
  reviewRequest,
} from './_email-templates.js';
import {
  isAdminAuthorized,
  verifyOrderToken,
  verifyOrderConfirmationToken,
  checkRateLimit,
} from './_security.js';
import { BASE_PRODUCT } from '../shared/products-config.js';
import { sendTransactionalEmail, getIdempotencyKey, getSenderConfig, getEmailDiagnostics } from './_email.js';

const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

const TEMPLATES = {
  orderConfirmation,
  paymentConfirmation,
  orderShipped,
  outForDelivery,
  orderDelivered,
  welcomeEmail,
  abandonedCart,
  paymentReminder,
  orderCancelled,
  refundProcessed,
  paymentFailed,
  reviewRequest,
  adminNewOrder,
  adminPaymentConfirmed,
  emailFailure,
  diagnosticTest,
};

const RESTRICTED_TEMPLATES = new Set([
  'orderShipped',
  'outForDelivery',
  'orderDelivered',
  'orderCancelled',
  'refundProcessed',
  'abandonedCart',
  'paymentReminder',
  'paymentConfirmation',
  'paymentFailed',
  'reviewRequest',
  'adminNewOrder',
  'adminPaymentConfirmed',
  'emailFailure',
  'diagnosticTest',
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

const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/i;

/**
 * Deterministic Resend Idempotency Key for order confirmation emails.
 *
 * Guarantees that across retries, crashes, and multi-instance reclaims,
 * Resend receives the exact same idempotency key for any given order.
 * Strictly derives from the validated order code without user-controlled strings,
 * PII, timestamps, or random UUIDs.
 *
 * "Concurrent duplicate sends are prevented by the database claim, and crash/retry duplicate sends
 * are mitigated by the stable Resend idempotency key."
 *
 * Example: 'order-confirmation/SMF-20260913-1111'
 */
export function getOrderConfirmationIdempotencyKey(orderCode) {
  const normalized = String(orderCode || '').trim().toUpperCase();
  if (!ORDER_CODE_RE.test(normalized)) {
    throw new Error(`Invalid order code for idempotency key: ${orderCode}`);
  }
  return `order-confirmation/${normalized}`;
}

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
 * 3. Checks mock order fetcher if in unit test mode without DB.
 * 4. Fails closed (HTTP 500) if required production Supabase credentials are missing.
 * 5. Calls Supabase RPC `claim_order_confirmation_email` (atomic FOR UPDATE lock).
 * 6. Falls back to direct PostgREST atomic conditional PATCH if RPC is unavailable.
 *
 * Note on Distributed Boundaries:
 * Concurrent duplicate sends are prevented by the database claim, and crash/retry duplicate sends
 * are mitigated by the stable Resend idempotency key.
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

  // 3. Mock order fetcher check (for unit test mock environments without real Supabase)
  if (typeof globalThis.__MOCK_ORDER_FETCHER__ !== 'undefined') {
    if (hasConfirmationBeenSent(orderCode)) {
      return { claimed: false, alreadySent: true };
    }
    return { claimed: true, alreadySent: false };
  }

  // 4. In production without mocks, verify credentials and FAIL CLOSED if missing
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    console.error('[send-email] SUPABASE_SERVICE_ROLE_KEY missing - failing closed');
    const err = new Error('Database service credentials missing');
    err.code = 'SUPABASE_CONFIG_MISSING';
    throw err;
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

export async function sendOrderConfirmationForOrder(order, { route = 'internal' } = {}) {
  const orderCode = String(order?.order_code || order?.orderId || '').trim().toUpperCase();
  if (!orderCode || !ORDER_CODE_RE.test(orderCode)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Valid order code required' };
  }

  const dbEmail = String(order.customer_email || '').trim().toLowerCase();
  if (!dbEmail || !EMAIL_RE.test(dbEmail)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Order does not have a valid customer email address.' };
  }

  if (order.confirmation_email_sent_at || hasConfirmationBeenSent(orderCode)) {
    return { ok: true, idempotent: true, orderId: orderCode };
  }

  const claimId = randomUUID();
  let claim;
  try {
    claim = await claimOrderConfirmationEmail(orderCode, claimId);
  } catch (claimErr) {
    if (claimErr.code === 'SUPABASE_CONFIG_MISSING') {
      return { ok: false, errorCode: 'DATABASE_FAILURE', errorMessage: 'Database service not configured', httpStatus: 500 };
    }
    throw claimErr;
  }
  if (claim.alreadySent) return { ok: true, idempotent: true, orderId: orderCode };
  if (!claim.claimed) return { ok: true, idempotent: true, inProgress: true, orderId: orderCode };

  const addr = order.address || {};
  const customerName = (typeof addr === 'object' && addr.name) || (typeof order.name === 'string' && order.name) || 'there';
  const addressFormatted = typeof addr === 'string'
    ? addr
    : [addr.line, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  const paymentMethod = String(order.payment_method || '').toLowerCase();
  const amountRupees = order.amount
    ? String(Math.round(order.amount / 100))
    : String(BASE_PRODUCT.price);
  const codFeeRupees = paymentMethod === 'cod'
    ? (order.cod_fee ? Math.round(order.cod_fee / 100) : BASE_PRODUCT.codFee)
    : 0;
  const paymentMethodLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'Prepaid (Razorpay)';
  const quantity = Array.isArray(order.items) && order.items[0]?.quantity
    ? Number(order.items[0].quantity) || 1
    : 1;

  let rendered;
  try {
    rendered = orderConfirmation({
      orderId: orderCode,
      customerName,
      amount: amountRupees,
      codFee: codFeeRupees,
      address: addressFormatted,
      paymentMethod: paymentMethodLabel,
      quantity,
      timestamp: order.created_at || order.payment_verified_at || '',
      transactionRef: String(order.upi_txn_id || order.payment_attempt_id || '').trim(),
      paymentStatus: paymentMethod === 'cod' ? 'Confirmed · pay on delivery' : 'Paid',
    });
  } catch (err) {
    await releaseOrderConfirmationClaim(orderCode, claimId);
    return {
      ok: false,
      errorCode: 'TEMPLATE_RENDER_ERROR',
      errorMessage: err?.message || 'Template rendering failed',
    };
  }

  const result = await sendTransactionalEmail({
    type: 'orderConfirmation',
    orderId: orderCode,
    to: dbEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: getOrderConfirmationIdempotencyKey(orderCode),
    originatingRoute: route,
  });

  if (!result.ok) {
    await releaseOrderConfirmationClaim(orderCode, claimId);
    return result;
  }

  await finalizeOrderConfirmationEmail(orderCode, claimId);
  return { ...result, orderId: orderCode };
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
  if (!key) {
    console.error('[send-email] SUPABASE_SERVICE_ROLE_KEY missing - failing closed');
    const err = new Error('Database service credentials missing');
    err.code = 'SUPABASE_CONFIG_MISSING';
    throw err;
  }

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

function isDiagnosticRequest(req, body) {
  const query = req.query || {};
  if (String(query.diagnostic || '') === '1') return true;
  const url = String(req.url || req.originalUrl || '');
  if (url.includes('test-email')) return true;
  const action = String(body?.action || '').trim();
  if (action === 'test-email') return true;
  return String(body?.type || '').trim() === 'diagnosticTest';
}

async function handleDiagnosticTest(req, res, body) {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Valid admin credentials required.' });
  }
  if (body.resendApiKey || body.apiKey || body.RESEND_API_KEY || body.secret) {
    return res.status(400).json({ error: 'Do not send API keys or secrets to this endpoint.' });
  }

  const email = String(body.email || body.to || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid test recipient email is required.' });
  }

  const sender = getSenderConfig();
  const diagnostics = getEmailDiagnostics();
  const timestamp = new Date().toISOString();
  const rendered = diagnosticTest({
    emailId: 'pending',
    environment: sender.vercelEnv,
    timestamp,
  });

  const result = await sendTransactionalEmail({
    type: 'diagnosticTest',
    orderId: '',
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: getIdempotencyKey(
      'diagnosticTest',
      '',
      `${email}:${timestamp.slice(0, 16)}`
    ),
    originatingRoute: '/api/admin/test-email',
    notifyFailure: false,
  });

  if (!result.ok) {
    return res.status(result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 502).json({
      ok: false,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      diagnostics,
    });
  }

  return res.status(200).json({
    ok: true,
    emailId: result.emailId,
    provider: result.provider,
    diagnostics,
  });
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

    if (isDiagnosticRequest(req, rawBody)) {
      return handleDiagnosticTest(req, res, rawBody);
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

      let order;
      try {
        order = await fetchOrderByCode(orderCode);
      } catch (fetchErr) {
        if (fetchErr.code === 'SUPABASE_CONFIG_MISSING') {
          return res.status(500).json({ error: 'Database service not configured' });
        }
        throw fetchErr;
      }
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

      // 1. Claim + send via the shared confirmation path (DB lock + Resend idempotency)
      const result = await sendOrderConfirmationForOrder(order, { route: '/api/send-email' });
      if (result.errorCode === 'DATABASE_FAILURE') {
        return res.status(500).json({ error: 'Database service not configured' });
      }
      if (result.idempotent) {
        return res.status(200).json({
          ok: true,
          success: true,
          idempotent: true,
          orderId: orderCode,
          message: result.inProgress
            ? 'Order confirmation email send in progress.'
            : 'Order confirmation email already sent.',
        });
      }
      if (!result.ok) {
        if (result.errorCode === 'MISSING_API_KEY') {
          return res.status(500).json({ error: 'Email service not configured' });
        }
        if (result.errorCode === 'TEMPLATE_RENDER_ERROR') {
          return res.status(500).json({ error: 'Invalid email template output' });
        }
        const statusCode = result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 600
          ? result.httpStatus
          : 502;
        return res.status(statusCode).json({
          error: result.errorMessage || 'Email could not be sent.',
          code: result.errorCode || result.errorName || 'RESEND_ERROR',
        });
      }
      return res.status(200).json({ id: result.emailId, ok: true, success: true, orderId: orderCode });
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
    let rendered;
    try {
      rendered = builder(data || {});
    } catch (err) {
      console.error('[send-email] template render error:', err?.message || err);
      return res.status(500).json({ error: 'Invalid email template output' });
    }
    const { subject, html, text } = rendered || {};
    if (!subject || !html || typeof subject !== 'string' || typeof html !== 'string') {
      return res.status(500).json({ error: 'Invalid email template output' });
    }

    const orderCode = String(data.orderId || data.orderCode || rawBody.orderId || rawBody.orderCode || '').trim();
    let idempotencyKey;
    try {
      idempotencyKey = getIdempotencyKey(type, orderCode, to);
    } catch {
      idempotencyKey = `${type}/${to}`;
    }

    const result = await sendTransactionalEmail({
      type,
      orderId: orderCode,
      to,
      subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
      html,
      text,
      idempotencyKey,
      originatingRoute: '/api/send-email',
    });

    if (!result.ok) {
      if (result.errorCode === 'MISSING_API_KEY') {
        return res.status(500).json({ error: 'Email service not configured' });
      }
      return res.status(502).json({ error: 'Email could not be sent.' });
    }

    return res.status(200).json({ id: result.emailId, ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Email could not be sent.' });
  }
}