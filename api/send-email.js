import { Resend } from 'resend';
import {
  orderConfirmation,
  orderShipped,
  welcomeEmail,
  abandonedCart,
} from './email-templates.js';

const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

const TEMPLATES = {
  orderConfirmation,
  orderShipped,
  welcomeEmail,
  abandonedCart,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_HOST_RE = /(^|\.)smelloff\.in$/i;

const ALLOWED_ORIGINS = new Set([
  'https://smelloff.in',
  'https://www.smelloff.in',
]);

// Per-IP token bucket. Resets when the function instance recycles, which is
// fine as a basic abuse brake — Vercel WAF in front handles the rest.
const RATE = new Map();
function rateLimitOk(ip, max, windowMs) {
  const now = Date.now();
  const entry = RATE.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  RATE.set(ip, entry);
  if (RATE.size > 5000) RATE.clear();
  return entry.count <= max;
}

const SITE_URL = 'https://www.smelloff.in';
function safeUrl(u) {
  if (typeof u !== 'string' || !u) return SITE_URL;
  try {
    const x = new URL(u, SITE_URL);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return SITE_URL;
    return SAFE_HOST_RE.test(x.hostname) ? x.toString() : SITE_URL;
  } catch { return SITE_URL; }
}
function clip(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').slice(0, max);
}

// Whitelist + sanitize what each template is allowed to receive. Anything
// else from the request body is dropped — the public POST cannot inject
// arbitrary HTML or attacker-controlled URLs into a Smelloff-branded email.
function sanitizeData(type, raw = {}) {
  const d = raw || {};
  switch (type) {
    case 'orderConfirmation':
      return {
        orderId:       clip(d.orderId, 40),
        customerName:  clip(d.customerName, 60) || 'there',
        amount:        clip(d.amount, 12),
        address:       clip(d.address, 400),
        paymentMethod: clip(d.paymentMethod, 60),
      };
    case 'orderShipped':
      return {
        orderId:      clip(d.orderId, 40),
        customerName: clip(d.customerName, 60) || 'there',
        trackingId:   clip(d.trackingId, 60),
        courier:      clip(d.courier, 40),
        trackingUrl:  safeUrl(d.trackingUrl),
      };
    case 'welcomeEmail':
      return { customerName: clip(d.customerName, 60) || 'there' };
    case 'abandonedCart':
      return {
        customerName: clip(d.customerName, 60) || 'there',
        productUrl:   safeUrl(d.productUrl),
      };
    default:
      return {};
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'origin' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimitOk(ip, 5, 60_000)) {
    return res.status(429).json({ error: 'rate' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const body = req.body || {};
    const { to, type } = body;

    if (!to || typeof to !== 'string') {
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
    const data = sanitizeData(type, body.data);
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
      return res.status(500).json({ error: result.error.message });
    }

    return res.status(200).json({ id: result.data?.id, ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message || 'Send failed' });
  }
}
