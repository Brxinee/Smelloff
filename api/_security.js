import crypto from 'node:crypto';

const PRODUCTION_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);

function allowedOrigins() {
  const origins = new Set(PRODUCTION_ORIGINS);
  const extra = String(process.env.SMELLOFF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, ''))
    .filter(Boolean);
  for (const origin of extra) origins.add(origin);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  return origins;
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins().has(String(origin).trim().replace(/\/$/, ''));
}

export function clientIp(req) {
  const pick = v => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  return pick(req.headers['cf-connecting-ip']) ||
    pick(req.headers['true-client-ip']) ||
    pick(req.headers['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown';
}

// Per-instance fallback throttle. Durable/global abuse protection should also
// be enforced by the platform/WAF where available.
const rateLimitBuckets = new Map();
export function checkRateLimit(key, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (rateLimitBuckets.size > 5000) {
      for (const [k, v] of rateLimitBuckets) if (now >= v.resetAt) rateLimitBuckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function getSecuritySecret() {
  const secret = process.env.ORDER_SECURITY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    console.error('[security] Security secret not configured. Failing closed.');
    return null;
  }
  return secret.trim();
}

export function generateOrderToken(orderCode, phone) {
  const secret = getSecuritySecret();
  if (!secret) return null;
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  const cleanOrderCode = String(orderCode || '').trim().toUpperCase();
  if (cleanPhone.length !== 10 || !/^SMF-\d{8}-\d{4}$/.test(cleanOrderCode)) return null;
  return crypto.createHmac('sha256', secret)
    .update(`${cleanOrderCode}:${cleanPhone}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyOrderToken(orderCode, phone, token) {
  if (!token || typeof token !== 'string') return false;
  const expected = generateOrderToken(orderCode, phone);
  if (!expected) return false;
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(token, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAdminAuthorized(req) {
  const adminSecret = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminSecret || typeof adminSecret !== 'string' || !adminSecret.trim()) return false;
  const auth = String(req.headers.authorization || '').trim();
  const custom = String(req.headers['x-admin-key'] || req.headers['x-admin-secret'] || '').trim();
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : custom;
  if (!token) return false;
  try {
    const a = Buffer.from(adminSecret.trim(), 'utf8');
    const b = Buffer.from(token, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function validateAndNormalizeUtr(rawUtr) {
  if (!rawUtr || typeof rawUtr !== 'string') return null;
  const cleaned = rawUtr.trim().toUpperCase().replace(/[\s\-_]/g, '');
  return /^[A-Z0-9]{10,24}$/.test(cleaned) ? cleaned : null;
}
