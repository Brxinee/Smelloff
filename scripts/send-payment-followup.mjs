// scripts/send-payment-followup.mjs
//
// Send the UPI payment follow-up email to a customer using Resend.
// Reads the HTML template from /payment-followup-email.html, replaces
// {{variables}} with values from the order, and sends via Resend's API.
//
// Usage (one-off, from project root):
//   RESEND_API_KEY=re_xxx node scripts/send-payment-followup.mjs
//
// You can also call sendPaymentFollowup({...}) from your serverless
// functions (e.g. /api/send-email.js) when an order has been logged
// but no UTR has been received within N minutes.

import { Resend } from 'resend';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, '..', 'payment-followup-email.html');

const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'support@smelloff.in';
const SUBJECT = 'Action needed: confirm your ODORSTRIKE order';

/**
 * Render the payment-followup email template with the given variables.
 * @param {object} vars - { customer_name, order_id, order_amount, order_date, utr_field_link }
 * @returns {Promise<string>} fully-rendered HTML
 */
export async function renderPaymentFollowup(vars) {
  let html = await readFile(TEMPLATE_PATH, 'utf8');
  // Strip the SUBJECT/PREVIEW HTML comments at the top of the file
  html = html.replace(/^<!--\s*SUBJECT:.*?-->\s*/i, '');
  html = html.replace(/^<!--\s*PREVIEW:.*?-->\s*/i, '');

  for (const [key, value] of Object.entries(vars)) {
    const safe = value == null ? '' : String(value);
    html = html.split(`{{${key}}}`).join(safe);
  }
  return html;
}

/**
 * Send the payment follow-up email.
 * @param {object} opts
 * @param {string} opts.to            - customer email
 * @param {string} opts.customer_name - first name or fallback
 * @param {string} opts.order_id      - e.g. "OS260424-ABCD"
 * @param {number|string} opts.order_amount - e.g. 258
 * @param {string} opts.order_date    - e.g. "25 Apr 2026"
 * @param {string} opts.utr_field_link - URL of the UTR submission form
 * @param {string} [opts.apiKey]      - falls back to env RESEND_API_KEY
 */
export async function sendPaymentFollowup(opts) {
  const apiKey = opts.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const resend = new Resend(apiKey);
  const html = await renderPaymentFollowup({
    customer_name: opts.customer_name,
    order_id:      opts.order_id,
    order_amount:  opts.order_amount,
    order_date:    opts.order_date,
    utr_field_link: opts.utr_field_link,
  });

  const result = await resend.emails.send({
    from: FROM,
    to: opts.to,
    replyTo: REPLY_TO,
    subject: SUBJECT,
    html,
    headers: {
      'List-Unsubscribe': '<mailto:support@smelloff.in?subject=unsubscribe>',
    },
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---- One-off CLI invocation (placeholder values for testing) ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await sendPaymentFollowup({
    to: 'customer@example.com',
    customer_name: 'Aniket',
    order_id: 'OS260425-Q9TZ',
    order_amount: 258,
    order_date: '25 Apr 2026',
    utr_field_link: 'https://smelloff.in/submit-utr?order=OS260425-Q9TZ',
  });
  console.log('Sent:', result);
}
