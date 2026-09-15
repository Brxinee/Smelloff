import crypto from 'node:crypto';
import { persistEmailWebhookEvent, updateEmailEventByProviderId, logEmailEvent } from './_email.js';

export const config = { api: { bodyParser: false } };

const STATUS_BY_EVENT = {
  'email.sent': 'SENT',
  'email.delivered': 'DELIVERED',
  'email.failed': 'FAILED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.delivery_delayed': 'DELAYED',
};

export function mapResendWebhookStatus(eventType) {
  return STATUS_BY_EVENT[String(eventType || '')] || null;
}

export function verifySvixSignature(rawBody, headers, secret) {
  const id = String(headers['svix-id'] || headers['webhook-id'] || '').trim();
  const timestamp = String(headers['svix-timestamp'] || headers['webhook-timestamp'] || '').trim();
  const signatureHeader = String(headers['svix-signature'] || headers['webhook-signature'] || '').trim();
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Math.abs(Date.now() - ts * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const secretPart = String(secret).startsWith('whsec_') ? String(secret).slice(6) : String(secret);
  let secretBytes;
  try {
    secretBytes = Buffer.from(secretPart, 'base64');
  } catch {
    return false;
  }
  if (!secretBytes.length) return false;

  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(',') ? part.split(',').slice(1).join(',') : part));

  try {
    const expectedBuf = Buffer.from(expected, 'utf8');
    for (const candidate of candidates) {
      const receivedBuf = Buffer.from(candidate, 'utf8');
      if (expectedBuf.length !== receivedBuf.length) continue;
      if (crypto.timingSafeEqual(expectedBuf, receivedBuf)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function readRawBody(req) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object' && !isReadableStream(req)) {
    return JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function isReadableStream(req) {
  return req && typeof req.on === 'function' && typeof req.read === 'function' && req.readable !== false;
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(500).json({ error: 'Resend webhook secret is not configured.' });
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[resend-webhook] Failed to read body', { message: err?.message || String(err) });
    return res.status(400).json({ error: 'Invalid webhook body.' });
  }

  if (!verifySvixSignature(rawBody, req.headers || {}, secret)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const eventType = String(event.type || event.event || '');
  const data = event.data || {};
  const emailId = String(data.email_id || data.id || '').trim();
  const svixId = String(req.headers['svix-id'] || req.headers['webhook-id'] || emailId || '').trim();
  const status = mapResendWebhookStatus(eventType);

  logEmailEvent('info', 'EMAIL_WEBHOOK', {
    type: eventType,
    emailId,
    errorCode: status || 'UNHANDLED',
    originatingRoute: '/api/resend-webhook',
  });

  const persisted = await persistEmailWebhookEvent({
    svixId: svixId || `resend:${emailId}:${eventType}`,
    eventType,
    emailId,
    payload: {
      type: eventType,
      created_at: event.created_at || null,
    },
    createdAt: event.created_at || new Date().toISOString(),
  });

  if (persisted?.duplicate) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  if (emailId && status) {
    const patch = {
      status,
      last_webhook_event: eventType,
    };
    if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') {
      patch.error_code = status;
      patch.error_message = String(data.bounce?.message || data.error || eventType).slice(0, 500);
    }
    await updateEmailEventByProviderId(emailId, patch);
  }

  return res.status(200).json({ received: true, event: eventType, status: status || 'ignored' });
}
