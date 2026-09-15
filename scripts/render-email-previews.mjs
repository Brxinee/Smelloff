import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { renderTemplate } from '../api/_email-templates.js';

const OUT = '/workspace/screenshots/emails';
mkdirSync(OUT, { recursive: true });

function dataUri(path, mime) {
  const buf = readFileSync(path);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const BOTTLE = dataUri('/workspace/smelloff/assets/odorstrike-bottle-cutout.png', 'image/png');
const LOGO_BLACK = dataUri('/workspace/smelloff/assets/brand/logo-smelloff-black.png', 'image/png');
const LOGO_WHITE = dataUri('/workspace/smelloff/assets/brand/logo-smelloff-white.png', 'image/png');

function inlineAssets(html) {
  return html
    .replaceAll('https://smelloff.in/assets/odorstrike-bottle-cutout.png', BOTTLE)
    .replaceAll('https://smelloff.in/assets/odorstrike-bottle.jpg', BOTTLE)
    .replaceAll('https://smelloff.in/assets/brand/logo-smelloff-black.png', LOGO_BLACK)
    .replaceAll('https://smelloff.in/assets/brand/logo-smelloff-white.png?v=2', LOGO_WHITE)
    .replaceAll('https://smelloff.in/assets/brand/logo-smelloff-white.png', LOGO_WHITE);
}

const SAMPLE = {
  orderId: 'SMF-20260915-1842',
  customerName: 'Arjun Rao',
  amount: '229',
  address: '12 Banjara Hills, Hyderabad, Telangana 500034',
  paymentMethod: 'Prepaid (Razorpay)',
  quantity: 1,
  timestamp: '2026-09-15T10:32:00.000Z',
  transactionRef: 'pay_Mq8xK2nL',
  paymentStatus: 'Paid',
  trackingId: '141575321012',
  courier: 'Delhivery',
  trackingUrl: 'https://www.shiprocket.co/tracking/141575321012',
  phone: '9876543210',
  email: 'arjun.rao@gmail.com',
  product: 'ODORSTRIKE 50ml',
  fulfillmentStatus: 'Confirmed',
  reason: 'Requested by customer',
  method: 'original payment method',
  emailType: 'orderConfirmation',
  recipientMasked: 'ar***@gmail.com',
  provider: 'resend',
  errorCode: 'RESEND_5XX',
  errorMessage: 'Bad Gateway',
  emailId: 'email_test_1842',
  environment: 'production',
};

const TEMPLATES = [
  { file: '01-order-confirmed-prepaid', type: 'orderConfirmation', label: 'Order confirmed (prepaid)', audience: 'Customer · sends', data: SAMPLE },
  { file: '02-order-confirmed-cod', type: 'codConfirmation', label: 'COD order confirmed', audience: 'Customer · sends', data: { ...SAMPLE, amount: '289', paymentMethod: 'Cash on Delivery', codFee: 60, paymentStatus: 'Confirmed · pay on delivery', transactionRef: '' } },
  { file: '03-payment-failed', type: 'paymentFailed', label: "Payment didn't go through", audience: 'Customer · sends', data: SAMPLE },
  { file: '04-shipped', type: 'orderShipped', label: 'Shipped', audience: 'Customer · sends', data: SAMPLE },
  { file: '05-out-for-delivery', type: 'outForDelivery', label: 'Out for delivery today', audience: 'Customer · sends', data: SAMPLE },
  { file: '06-delivered', type: 'orderDelivered', label: 'Delivered', audience: 'Customer · sends', data: SAMPLE },
  { file: '07-review-request', type: 'reviewRequest', label: 'Review request (5–14 days after delivery)', audience: 'Customer · sends', data: SAMPLE },
  { file: '08-order-cancelled', type: 'orderCancelled', label: 'Order cancelled', audience: 'Customer · sends', data: SAMPLE },
  { file: '09-refund-processed', type: 'refundProcessed', label: 'Refund processed', audience: 'Customer · sends', data: SAMPLE },
  { file: '10-admin-new-order', type: 'adminNewOrder', label: 'Admin — new order', audience: 'Ops · sends', data: SAMPLE },
  { file: '11-admin-payment-verified', type: 'adminPaymentConfirmed', label: 'Admin — payment verified', audience: 'Ops · sends', data: SAMPLE },
  { file: '12-email-failure-alert', type: 'emailFailure', label: 'Admin — email delivery failure', audience: 'Ops · sends', data: SAMPLE },
  { file: '13-diagnostic-test', type: 'diagnosticTest', label: 'Email system test', audience: 'Ops · diagnostic', data: SAMPLE },
  { file: '14-payment-received-unused', type: 'paymentConfirmation', label: 'Payment received (not sent — folded into confirmation)', audience: 'Unused', unused: true, data: SAMPLE },
  { file: '15-welcome', type: 'welcomeEmail', label: 'Welcome', audience: 'Unused draft', unused: true, data: SAMPLE },
  { file: '16-abandoned-cart', type: 'abandonedCart', label: 'Abandoned cart', audience: 'Unused draft', unused: true, data: SAMPLE },
  { file: '17-payment-reminder', type: 'paymentReminder', label: 'Payment reminder', audience: 'Unused draft', unused: true, data: SAMPLE },
];

const rendered = TEMPLATES.map((entry) => {
  const out = renderTemplate(entry.type, entry.data);
  writeFileSync(`${OUT}/${entry.file}.html`, inlineAssets(out.html));
  return { ...entry, subject: out.subject };
});

function writeIndex(withPng) {
  const index = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Smelloff email templates</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#EDEDE8; color:#080808; font-family: Arial, Helvetica, sans-serif; }
  header { padding:32px 20px 16px; max-width:720px; margin:0 auto; }
  h1 { font-size:26px; letter-spacing:-0.3px; margin:0 0 10px; font-weight:700; }
  p { color:#6B6B66; font-size:15px; line-height:1.55; margin:0 0 14px; }
  .why { background:#FFFFFE; border:1px solid #E2E2DC; border-left:3px solid #B8FF57; padding:16px 18px; margin:0 0 20px; font-size:14px; color:#080808; }
  .why strong { display:block; margin:0 0 6px; }
  .nav { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 8px; }
  .nav a { color:#080808; background:#B8FF57; text-decoration:none; font-size:12px; font-weight:700; padding:8px 10px; border:2px solid #080808; }
  section { max-width:720px; margin:0 auto 40px; padding:0 16px 32px; border-bottom:1px solid #E2E2DC; }
  .meta { font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#6B6B66; margin:0 0 6px; }
  .subject { font-size:14px; color:#080808; margin:0 0 16px; }
  h2 { font-size:18px; margin:0 0 8px; }
  img.shot { width:100%; max-width:640px; height:auto; border:1px solid #E2E2DC; background:#FFFFFE; display:block; }
  iframe { width:100%; max-width:640px; height:1100px; border:1px solid #E2E2DC; background:#FFFFFE; display:block; }
  .unused { opacity:.72; }
</style>
</head>
<body>
<header>
  <h1>Smelloff transactional emails</h1>
  <p>Light receipts. Sample order SMF-20260915-1842. Customer mail first, then ops, then unused drafts.</p>
  <div class="why">
    <strong>Why this looks different from the site</strong>
    Forced-black emails invert in Gmail. White logos vanish. Acid-green CTAs go magenta. Apple Mail is ~62% of opens and does not auto-invert a light receipt. Brand stays in the 4px green bar + CTA, not a black page.
  </div>
  <div class="nav">
    ${rendered.map((e) => `<a href="#${e.file}">${e.label.split('(')[0].trim()}</a>`).join('')}
  </div>
</header>
${rendered.map((e) => `
<section id="${e.file}" class="${e.unused ? 'unused' : ''}">
  <p class="meta">${e.audience}</p>
  <h2>${e.label}</h2>
  <p class="subject">Subject: ${e.subject.replace(/</g, '\u0026lt;')}</p>
  ${withPng
    ? `<img class="shot" src="./${e.file}.png" alt="${e.label}">`
    : `<iframe src="./${e.file}.html" title="${e.label}"></iframe>`}
</section>`).join('\n')}
</body>
</html>`;
  writeFileSync(`${OUT}/index.html`, index);
}

writeIndex(false);

const browser = await chromium.launch({ args: ['--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 680, height: 1400 } });
for (const entry of rendered) {
  await page.goto(`http://127.0.0.1:8080/${entry.file}.html`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(200);
  const box = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return {
      width: Math.max(body.scrollWidth, html.scrollWidth, 640),
      height: Math.max(body.scrollHeight, html.scrollHeight, 800),
    };
  });
  await page.setViewportSize({
    width: Math.min(680, Math.max(640, box.width)),
    height: Math.min(2400, Math.max(900, box.height + 24)),
  });
  await page.screenshot({
    path: `${OUT}/${entry.file}.png`,
    fullPage: true,
  });
  console.log('shot', entry.file, entry.subject);
}
await browser.close();
writeIndex(true);
console.log('done', rendered.length);
