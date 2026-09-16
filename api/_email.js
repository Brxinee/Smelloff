import { Resend } from 'resend';

export const EMAIL_PROVIDER = 'resend';
export const DEFAULT_FROM = 'ODORSTRIKE <orders@smelloff.in>';
export const DEFAULT_FROM_ADDRESS = 'orders@smelloff.in';
export const DEFAULT_FROM_DOMAIN = 'smelloff.in';
export const DEFAULT_REPLY_TO = 'smelloffsupport@gmail.com';
export const REQUIRED_FROM_DOMAIN = 'smelloff.in';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/i;
const RESEND_DEV_RE = /@resend\.dev\s*>?$/i;

const IDEMPOTENCY_PREFIX = {
  orderConfirmation: 'order-confirmation',
  paymentConfirmation: 'payment-confirmation',
  codConfirmation: 'order-confirmation',
  orderShipped: 'shipping',
  outForDelivery: 'out-for-delivery',
  orderDelivered: 'delivered',
  adminNewOrder: 'admin-new-order',
  adminPaymentConfirmed: 'admin-payment-confirmed',
  emailFailure: 'email-failure',
  diagnosticTest: 'email-system-test',
  welcomeEmail: 'welcome',
  abandonedCart: 'abandoned-cart',
  paymentReminder: 'payment-reminder',
  paymentFailed: 'payment-failed',
  reviewRequest: 'review-request',
  orderCancelled: 'order-cancelled',
  refundProcessed: 'refund-processed',
};

export function isEmailSideEffectsDisabled() {
  return Boolean(
    globalThis.__MOCK_ORDER_DB__ ||
    globalThis.__MOCK_ORDER_FETCHER__ ||
    globalThis.__MOCK_SENT_CONFIRMATIONS__ ||
    process.env.EMAIL_SIDE_EFFECTS === '0'
  );
}

export function maskEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at < 1) return email ? '***' : '';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, local.length <= 2 ? 1 : 2);
  return `${visible}***@${domain}`;
}

export function isValidEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_RE.test(email);
}

export function normalizeOrderCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return ORDER_CODE_RE.test(code) ? code : '';
}

export function parseFromAddress(from) {
  const raw = String(from || '').trim();
  const angled = raw.match(/<([^>]+)>/);
  const address = String(angled ? angled[1] : raw).trim().toLowerCase();
  const domain = address.includes('@') ? address.split('@').pop() : '';
  return { from: raw, address, domain };
}

export function getSenderConfig() {
  const from = String(process.env.EMAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const parsed = parseFromAddress(from);
  const replyTo = String(process.env.EMAIL_REPLY_TO || DEFAULT_REPLY_TO).trim() || DEFAULT_REPLY_TO;
  const adminNotify = String(
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ORDERS_NOTIFY_EMAIL ||
    replyTo ||
    DEFAULT_REPLY_TO
  ).trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
  const production = vercelEnv === 'production';
  const usesResendDev = RESEND_DEV_RE.test(from) || parsed.domain === 'resend.dev';
  const domainOk = parsed.domain === REQUIRED_FROM_DOMAIN && !usesResendDev;
  return {
    from,
    fromAddress: parsed.address || DEFAULT_FROM_ADDRESS,
    fromDomain: parsed.domain || DEFAULT_FROM_DOMAIN,
    replyTo,
    adminNotify,
    vercelEnv,
    production,
    usesResendDev,
    apiKeyConfigured: Boolean(String(process.env.RESEND_API_KEY || '').trim()),
    domainStatus: domainOk ? 'DOMAIN_OK' : 'DOMAIN_CONFIGURATION_REQUIRED',
    requiredFromDomain: REQUIRED_FROM_DOMAIN,
  };
}

export function getEmailDiagnostics() {
  const sender = getSenderConfig();
  return {
    RESEND_CONFIGURED: sender.apiKeyConfigured,
    RESEND_API_KEY_PRESENT: sender.apiKeyConfigured,
    sender: sender.from,
    senderAddress: sender.fromAddress,
    senderDomain: sender.fromDomain,
    replyTo: sender.replyTo,
    adminNotify: maskEmail(sender.adminNotify),
    vercelEnv: sender.vercelEnv,
    domainStatus: sender.domainStatus,
    usesResendDev: sender.usesResendDev,
    provider: EMAIL_PROVIDER,
  };
}

export function getIdempotencyKey(type, orderId, extra = '') {
  const prefix = IDEMPOTENCY_PREFIX[type] || String(type || 'transactional').trim();
  const orderCode = normalizeOrderCode(orderId);
  if (orderCode) return `${prefix}/${orderCode}${extra ? `/${extra}` : ''}`;
  const stable = String(extra || '').trim().toLowerCase();
  if (!stable) {
    throw new Error(`Cannot derive idempotency key for type "${type}" without an order code`);
  }
  return `${prefix}/${stable}`;
}

export function getOrderConfirmationIdempotencyKey(orderCode) {
  const normalized = normalizeOrderCode(orderCode);
  if (!normalized) {
    throw new Error(`Invalid order code for idempotency key: ${orderCode}`);
  }
  return `order-confirmation/${normalized}`;
}

export function classifyResendError(error, { production, fromDomain, usesResendDev } = {}) {
  if (!error) {
    return { errorCode: 'RESEND_API_ERROR', errorMessage: 'Unknown Resend error', httpStatus: 502 };
  }
  if (typeof error === 'string') {
    return classifyResendError({ message: error }, { production, fromDomain, usesResendDev });
  }

  const statusCode = Number(error.statusCode || error.status || 0);
  const name = String(error.name || error.code || '').toLowerCase();
  const message = String(error.message || error.error || 'Email could not be sent.');
  const haystack = `${name} ${message}`.toLowerCase();

  if (usesResendDev && production) {
    return {
      errorCode: 'DOMAIN_MISMATCH',
      errorMessage: 'Production sender resolved to resend.dev. Verified smelloff.in domain is required.',
      httpStatus: 500,
    };
  }
  if (statusCode === 401 || haystack.includes('invalid api key') || haystack.includes('unauthorized') || name === 'invalid_api_key') {
    return { errorCode: 'INVALID_API_KEY', errorMessage: message, httpStatus: 502 };
  }
  if (haystack.includes('not verified') || haystack.includes('unverified') || haystack.includes('domain is not verified')) {
    return { errorCode: 'UNVERIFIED_SENDER', errorMessage: message, httpStatus: 502 };
  }
  if (haystack.includes('domain mismatch') || (fromDomain && haystack.includes(fromDomain) && haystack.includes('domain'))) {
    return { errorCode: 'DOMAIN_MISMATCH', errorMessage: message, httpStatus: 502 };
  }
  if (haystack.includes('suppressed') || name === 'suppressed') {
    return { errorCode: 'SUPPRESSED_RECIPIENT', errorMessage: message, httpStatus: 422 };
  }
  if (statusCode === 422 || haystack.includes('invalid `to`') || haystack.includes('invalid to') || haystack.includes('invalid recipient')) {
    return { errorCode: 'INVALID_RECIPIENT', errorMessage: message, httpStatus: 400 };
  }
  if (statusCode === 429 || name === 'rate_limit_exceeded' || haystack.includes('rate limit')) {
    return { errorCode: 'RATE_LIMIT', errorMessage: message, httpStatus: 429 };
  }
  if (statusCode >= 500 || haystack.includes('timeout') || haystack.includes('bad gateway')) {
    return { errorCode: 'RESEND_API_ERROR', errorMessage: message, httpStatus: 502 };
  }
  return {
    errorCode: name ? name.toUpperCase() : 'RESEND_API_ERROR',
    errorMessage: message,
    httpStatus: statusCode >= 400 && statusCode < 600 ? statusCode : 502,
  };
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function classifyEmailPersistFailure(status, body) {
  const haystack = `${status} ${String(body || '')}`.toLowerCase();
  if (
    Number(status) === 404 ||
    haystack.includes('pgrst205') ||
    haystack.includes('could not find the table') ||
    haystack.includes('schema cache')
  ) {
    return 'SCHEMA_MISMATCH';
  }
  return 'DATABASE_FAILURE';
}

export async function persistEmailEvent(event) {
  if (isEmailSideEffectsDisabled()) return { ok: true, skipped: true };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return { ok: false, errorCode: 'DATABASE_FAILURE', skipped: true };

  const row = {
    order_code: event.orderId || null,
    email_type: event.type,
    idempotency_key: event.idempotencyKey,
    recipient_masked: maskEmail(event.to),
    sender: event.from,
    provider: EMAIL_PROVIDER,
    provider_email_id: event.emailId || null,
    status: event.status,
    error_code: event.errorCode || null,
    error_message: event.errorMessage ? String(event.errorMessage).slice(0, 500) : null,
    originating_route: event.originatingRoute || null,
    metadata: event.metadata || {},
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/email_events`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok || res.status === 409) return { ok: true };
    let body = '';
    try { body = typeof res.text === 'function' ? await res.text() : ''; } catch { body = ''; }
    const errorCode = classifyEmailPersistFailure(res.status, body);
    console.error('[email] persist EMAIL_EVENT failed', { status: res.status, errorCode, body: String(body).slice(0, 200) });
    return { ok: false, errorCode };
  } catch (err) {
    console.error('[email] persist EMAIL_EVENT exception', { message: err?.message || String(err) });
    return { ok: false, errorCode: 'DATABASE_FAILURE' };
  }
}

export async function updateEmailEventByProviderId(providerEmailId, patch) {
  if (isEmailSideEffectsDisabled() || !providerEmailId) return { ok: true, skipped: true };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return { ok: false, skipped: true };
  try {
    const res = await fetch(
      `${supabaseUrl()}/rest/v1/email_events?provider_email_id=eq.${encodeURIComponent(providerEmailId)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(4000),
      }
    );
    return { ok: res.ok };
  } catch (err) {
    console.error('[email] update by provider id failed', { message: err?.message || String(err) });
    return { ok: false };
  }
}

export function logEmailEvent(level, code, details) {
  const payload = {
    event: code,
    timestamp: new Date().toISOString(),
    provider: EMAIL_PROVIDER,
    type: details.type || null,
    orderId: details.orderId || null,
    to: maskEmail(details.to),
    from: details.from || null,
    emailId: details.emailId || null,
    idempotencyKey: details.idempotencyKey || null,
    originatingRoute: details.originatingRoute || null,
    errorCode: details.errorCode || null,
    errorMessage: details.errorMessage || null,
    errorName: details.errorName || null,
    httpStatus: details.httpStatus || null,
    vercelEnv: details.vercelEnv || process.env.VERCEL_ENV || null,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else console.log(line);
}

async function maybeAlertFailure(failed, sender) {
  if (isEmailSideEffectsDisabled()) return;
  if (!failed || failed.type === 'emailFailure' || failed.type === 'diagnosticTest') return;
  const adminTo = sender.adminNotify;
  if (!isValidEmail(adminTo)) return;
  try {
    const { emailFailure } = await import('./_email-templates.js');
    const rendered = emailFailure({
      emailType: failed.type,
      orderId: failed.orderId || '',
      recipientMasked: maskEmail(failed.to),
      provider: EMAIL_PROVIDER,
      errorCode: failed.errorCode || 'RESEND_API_ERROR',
      errorMessage: failed.errorMessage || 'Email delivery failed',
      timestamp: new Date().toISOString(),
    });
    await sendTransactionalEmail({
      type: 'emailFailure',
      orderId: failed.orderId || '',
      to: adminTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: getIdempotencyKey(
        'emailFailure',
        failed.orderId,
        `${failed.type}:${String(failed.errorCode || 'error').toLowerCase()}`
      ),
      originatingRoute: failed.originatingRoute || 'internal',
      notifyFailure: false,
    });
  } catch (err) {
    console.error('[email] failure alert could not be dispatched', { message: err?.message || String(err) });
  }
}

export async function persistEmailWebhookEvent(event) {
  if (isEmailSideEffectsDisabled()) return { ok: true, skipped: true };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return { ok: false, skipped: true };
  const row = {
    svix_id: event.svixId,
    event_type: event.eventType,
    provider_email_id: event.emailId || null,
    payload: event.payload || {},
    created_at: event.createdAt || new Date().toISOString(),
  };
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/email_webhook_events`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 409) return { ok: true, duplicate: true };
    if (!res.ok) {
      let body = '';
      try { body = typeof res.text === 'function' ? await res.text() : ''; } catch { body = ''; }
      const errorCode = classifyEmailPersistFailure(res.status, body);
      console.error('[email] persist webhook event failed', { status: res.status, errorCode, body: String(body).slice(0, 200) });
      return { ok: false, errorCode };
    }
    return { ok: true };
  } catch (err) {
    console.error('[email] persist webhook event exception', { message: err?.message || String(err) });
    return { ok: false, errorCode: 'DATABASE_FAILURE' };
  }
}

export async function sendTransactionalEmail({
  type,
  orderId = '',
  to,
  subject,
  html,
  text,
  idempotencyKey,
  originatingRoute = 'unknown',
  notifyFailure = true,
  headers = undefined,
} = {}) {
  const sender = getSenderConfig();
  const recipient = String(Array.isArray(to) ? to[0] : to || '').trim().toLowerCase();
  const orderCode = normalizeOrderCode(orderId);
  const key = String(process.env.RESEND_API_KEY || '').trim();

  let resolvedIdempotencyKey = idempotencyKey;
  try {
    if (!resolvedIdempotencyKey) {
      resolvedIdempotencyKey = getIdempotencyKey(type, orderCode || orderId, recipient);
    }
  } catch (err) {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'TEMPLATE_RENDER_ERROR',
      errorMessage: err?.message || 'Unable to derive idempotency key',
    };
    logEmailEvent('error', 'EMAIL_FAILURE', {
      type, orderId: orderCode, to: recipient, from: sender.from,
      originatingRoute, errorCode: failure.errorCode, errorMessage: failure.errorMessage,
      vercelEnv: sender.vercelEnv,
    });
    return failure;
  }

  const baseLog = {
    type,
    orderId: orderCode || orderId || null,
    to: recipient,
    from: sender.from,
    idempotencyKey: resolvedIdempotencyKey,
    originatingRoute,
    vercelEnv: sender.vercelEnv,
  };

  logEmailEvent('info', 'EMAIL_ATTEMPT', baseLog);

  if (!key) {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'RESEND_API_KEY is not configured',
      httpStatus: 500,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'MISSING_API_KEY' });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    return failure;
  }

  if (!isValidEmail(recipient)) {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'INVALID_RECIPIENT',
      errorMessage: 'Invalid recipient email address',
      httpStatus: 400,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'INVALID_RECIPIENT' });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    return failure;
  }

  if (sender.production && sender.usesResendDev) {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'DOMAIN_MISMATCH',
      errorMessage: 'Production sender must be orders@smelloff.in. resend.dev fallback is blocked.',
      httpStatus: 500,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'DOMAIN_MISMATCH' });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    return failure;
  }

  if (sender.production && sender.fromDomain !== REQUIRED_FROM_DOMAIN) {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'DOMAIN_MISMATCH',
      errorMessage: `Production sender domain must be ${REQUIRED_FROM_DOMAIN}, got ${sender.fromDomain}`,
      httpStatus: 500,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'DOMAIN_MISMATCH' });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    return failure;
  }

  if (!subject || !html || typeof subject !== 'string' || typeof html !== 'string') {
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: 'TEMPLATE_RENDER_ERROR',
      errorMessage: 'Invalid email template output',
      httpStatus: 500,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'TEMPLATE_RENDER_ERROR' });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    return failure;
  }

  const payload = {
    from: sender.from,
    to: recipient,
    replyTo: sender.replyTo,
    subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
    html,
  };
  if (text && typeof text === 'string') payload.text = text;
  if (headers && typeof headers === 'object') payload.headers = headers;

  try {
    const resend = new Resend(key);
    const result = await resend.emails.send(payload, { idempotencyKey: resolvedIdempotencyKey });
    const error = result?.error || null;
    const data = result?.data || null;

    if (error) {
      const classified = classifyResendError(error, {
        production: sender.production,
        fromDomain: sender.fromDomain,
        usesResendDev: sender.usesResendDev,
      });
      const failure = {
        ok: false,
        provider: EMAIL_PROVIDER,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
        errorName: error.name || classified.errorCode,
        httpStatus: classified.httpStatus,
        idempotencyKey: resolvedIdempotencyKey,
      };
      logEmailEvent('error', 'EMAIL_FAILURE', {
        ...baseLog,
        ...failure,
        errorName: error.name || null,
        httpStatus: error.statusCode || classified.httpStatus,
      });
      await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
      if (notifyFailure) await maybeAlertFailure({ ...baseLog, ...failure }, sender);
      return failure;
    }

    const emailId = data?.id;
    if (!emailId) {
      const failure = {
        ok: false,
        provider: EMAIL_PROVIDER,
        errorCode: 'RESEND_API_ERROR',
        errorMessage: 'Resend accepted the request but returned no email ID',
        httpStatus: 502,
        idempotencyKey: resolvedIdempotencyKey,
      };
      logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure, errorName: 'MISSING_EMAIL_ID' });
      await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
      if (notifyFailure) await maybeAlertFailure({ ...baseLog, ...failure }, sender);
      return failure;
    }

    logEmailEvent('info', 'EMAIL_SUCCESS', { ...baseLog, emailId });
    await persistEmailEvent({
      ...baseLog,
      from: sender.from,
      emailId,
      status: 'QUEUED',
    });
    return {
      ok: true,
      emailId,
      provider: EMAIL_PROVIDER,
      idempotencyKey: resolvedIdempotencyKey,
    };
  } catch (err) {
    const classified = classifyResendError(err, {
      production: sender.production,
      fromDomain: sender.fromDomain,
      usesResendDev: sender.usesResendDev,
    });
    const failure = {
      ok: false,
      provider: EMAIL_PROVIDER,
      errorCode: classified.errorCode === 'RESEND_API_ERROR' ? 'VERCEL_FUNCTION_ERROR' : classified.errorCode,
      errorMessage: classified.errorMessage || err?.message || 'Email delivery failed',
      errorName: err?.name || 'Error',
      httpStatus: classified.httpStatus || 502,
      idempotencyKey: resolvedIdempotencyKey,
    };
    logEmailEvent('error', 'EMAIL_FAILURE', { ...baseLog, ...failure });
    await persistEmailEvent({ ...baseLog, from: sender.from, status: 'FAILED', ...failure });
    if (notifyFailure) await maybeAlertFailure({ ...baseLog, ...failure }, sender);
    return failure;
  }
}
