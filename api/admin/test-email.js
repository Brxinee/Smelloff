import { isAllowedOrigin, clientIp, checkRateLimit, isAdminAuthorized } from '../_security.js';
import {
  sendTransactionalEmail,
  getIdempotencyKey,
  getEmailDiagnostics,
  getSenderConfig,
  isValidEmail,
} from '../_email.js';
import { diagnosticTest } from '../email-templates.js';

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Admin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Admin-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Valid admin credentials required.' });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`admin-test-email:${ip}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.resendApiKey || body.apiKey || body.RESEND_API_KEY || body.secret) {
    return res.status(400).json({ error: 'Do not send API keys or secrets to this endpoint.' });
  }

  const email = String(body.email || body.to || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
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
