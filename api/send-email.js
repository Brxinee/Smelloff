import { Resend } from 'resend';
import {
  orderConfirmation,
  orderShipped,
  welcomeEmail,
  abandonedCart,
} from './email-templates.js';

const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'hello@smelloff.in';

const TEMPLATES = {
  orderConfirmation,
  orderShipped,
  welcomeEmail,
  abandonedCart,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://smelloff.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const body = req.body || {};
    const { to, type, data = {}, subject: rawSubject, html: rawHtml } = body;

    if (!to) {
      return res.status(400).json({ error: 'Missing "to"' });
    }
    if (!EMAIL_RE.test(to)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    let subject, html;

    if (type) {
      const builder = TEMPLATES[type];
      if (!builder) {
        return res.status(400).json({ error: `Unknown template: ${type}` });
      }
      ({ subject, html } = builder(data));
    } else if (rawSubject && rawHtml) {
      subject = String(rawSubject);
      html = String(rawHtml);
    } else {
      return res.status(400).json({
        error: 'Provide either "type" (template) or both "subject" and "html"',
      });
    }

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
