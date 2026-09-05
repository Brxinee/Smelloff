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
import { isAdminAuthorized } from './_security.js';

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
  'orderConfirmation',
  'orderShipped',
  'outForDelivery',
  'orderDelivered',
  'orderCancelled',
  'refundProcessed'
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
  b.count++;
  return false;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin/server-to-server requests may omit Origin
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Vercel previews are only allowed outside production. Production must stay
  // locked to the two canonical storefront origins.
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
      // Never accept secrets or arbitrary headers as template data.
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    const to = String(rawBody.to || '').trim().toLowerCase();
    const type = String(rawBody.type || '').trim();
    if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'Invalid email address' });

    const builder = TEMPLATES[type];
    if (!builder) return res.status(400).json({ error: 'Unknown email template' });

    // Protect sensitive order lifecycle emails from unauthenticated public invocation
    if (RESTRICTED_TEMPLATES.has(type) && !isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Transactional template requires admin authorization.' });
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
      subject: subject.slice(0, 200),
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