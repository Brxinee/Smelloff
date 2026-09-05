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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

// Best-effort in-memory rate limiter (per warm lambda instance). Keeps this
// transactional-email endpoint from being abused as an open relay/spam vector.
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
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.run.app') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Behind Cloudflare, x-forwarded-for is a Cloudflare POP shared by many
  // visitors — rate-limiting on it would throttle everyone routed through the
  // same POP together. cf-connecting-ip is the real client.
  const pickIp = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  const ip = pickIp(req.headers['cf-connecting-ip'])
    || pickIp(req.headers['true-client-ip'])
    || pickIp(req.headers['x-forwarded-for'])
    || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const body = req.body || {};
    const { to, type, data = {} } = body;

    if (!to) {
      return res.status(400).json({ error: 'Missing "to"' });
    }
    if (!EMAIL_RE.test(to)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Missing "type" (template)' });
    }
    const builder = TEMPLATES[type];
    if (!builder) {
      return res.status(400).json({ error: `Unknown template: ${type}` });
    }
    const { subject, html } = builder(data);

    const result = await resend.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject,
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
