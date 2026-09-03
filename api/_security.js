import crypto from 'node:crypto';

const ALLOWED_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);

export function isAllowedOrigin(origin) {
  if (!origin) return true; // server-to-server or same-origin requests may omit Origin
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_ENV !== 'production') {
    if (
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.run.app') ||
      origin.endsWith('.googleusercontent.com') ||
      origin.endsWith('.aistudio.google.com') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return true;
    }
  }
  return false;
}

export function clientIp(req) {
  const pick = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  return (
    pick(req.headers['cf-connecting-ip']) ||
    pick(req.headers['true-client-ip']) ||
    pick(req.headers['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// In-memory rate limiter per warm container/instance
const rateLimitBuckets = new Map();
export function checkRateLimit(key, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (rateLimitBuckets.size > 5000) {
      for (const [k, v] of rateLimitBuckets) {
        if (now >= v.resetAt) rateLimitBuckets.delete(k);
      }
    }
    return true; // Allowed
  }
  if (bucket.count >= limit) {
    return false; // Throttled
  }
  bucket.count++;
  return true; // Allowed
}

export function getSecuritySecret() {
  const secret =
    process.env.ORDER_SECURITY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    console.error('[security] Security secret not configured in environment. Failing closed.');
    return null;
  }
  return secret.trim();
}

/**
 * Generates an HMAC signature for an order to prevent unauthenticated mutation.
 * Fails closed (returns null) if no cryptographic secret is configured or inputs are invalid.
 */
export function generateOrderToken(orderCode, phone) {
  const secret = getSecuritySecret();
  if (!secret) return null;

  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) return null;

  const cleanOrderCode = String(orderCode || '').trim().toUpperCase();
  if (!cleanOrderCode || !/^SMF-\d{8}-\d{4}$/.test(cleanOrderCode)) return null;

  return crypto
    .createHmac('sha256', secret)
    .update(`${cleanOrderCode}:${cleanPhone}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Validates the order token in constant time.
 * Fails closed if token or inputs are invalid or secret is unavailable.
 */
export function verifyOrderToken(orderCode, phone, token) {
  if (!token || typeof token !== 'string') return false;
  const expected = generateOrderToken(orderCode, phone);
  if (!expected) return false;

  try {
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(token, 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Validates admin authorization via Bearer token or x-admin-key in constant time.
 */
export function isAdminAuthorized(req) {
  const adminSecret = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminSecret || typeof adminSecret !== 'string' || adminSecret.trim().length === 0) {
    return false; // Fail closed if no admin secret configured
  }

  const authHeader = String(req.headers['authorization'] || '').trim();
  const customHeader = String(req.headers['x-admin-key'] || req.headers['x-admin-secret'] || '').trim();

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (customHeader) {
    token = customHeader;
  }

  if (!token) return false;

  try {
    const expectedBuf = Buffer.from(adminSecret.trim(), 'utf8');
    const actualBuf = Buffer.from(token, 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Validates UTR / UPI reference number.
 * Typical Indian bank UTRs are 12 digits (or alphanumeric 12 to 22 characters).
 */
export function validateAndNormalizeUtr(rawUtr) {
  if (!rawUtr || typeof rawUtr !== 'string') return null;
  const cleaned = rawUtr.trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (!/^[A-Z0-9]{10,24}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}
