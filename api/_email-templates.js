import { BASE_PRODUCT } from '../shared/products-config-workers.js';

// Email design system (2026-10-11): the site's palette on a light receipt.
// Light canvas because Gmail's apps invert colours and ignore
// prefers-color-scheme; Apple Mail (most opens) honours it and gets the
// site's own dark theme from the @media block in shell(). Brand lives in the
// Carbon Black header band, Signal Lime fills (kicker, tracker, button) and
// the type. Lime is only ever a fill under black text, never text on white.
// Avoid pure #FFF/#000: some clients invert them harder than near-whites.
const INK = '#0A0A0A';
const LIME = '#B8FF57';
const PAGE = '#F2F5EF';
const CARD = '#FFFFFE';
const TEXT = INK;
const MUTED = '#5C6158';
const BORDER = '#E3E7DF';
const PANEL = '#F6F8F3';

// Space Grotesk / Inter load from Google Fonts where the client allows it
// (Apple Mail, iOS Mail); Gmail and Outlook fall back to Helvetica/Arial.
const FONT = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
const HEADING_FONT = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap';

const SUPPORT_EMAIL = BASE_PRODUCT.manufacturer.email || 'info@smelloff.in';
const SITE_URL = 'https://smelloff.in';
const ADMIN_URL = 'https://smelloff.in/admin';
const WHATSAPP_URL = 'https://wa.me/919392974031';
const WHATSAPP_LABEL = '+91 93929 74031';
const PRICE = BASE_PRODUCT.price;
const MRP = BASE_PRODUCT.mrp;
const PRODUCT_NAME = 'ODORSTRIKE 50ml';
// Email-only renders (PNG, not WebP, for Outlook). The logo carries its own
// Carbon Black background so it can't vanish when a client inverts the band.
const PRODUCT_IMAGE = `${SITE_URL}/assets/email/odorstrike-bottle-thumb.png`;
const LOGO = `${SITE_URL}/assets/email/logo-on-ink.png`;
const SHIPPING_LABEL = 'Free';
const ETA_COPY = '3–5 business days to metros, 5–7 elsewhere';

export const trackUrl = (orderId = '') =>
  `${SITE_URL}/track-order?code=${encodeURIComponent(String(orderId).replace(/[\r\n]+/g, '').trim())}`;

const escape = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


const cleanHeader = (s = '') => String(s).replace(/[\r\n]+/g, ' ').trim();

const safeUrl = (url = '', fallback = SITE_URL) => {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return escape(trimmed);
  return fallback;
};

const rupee = (value) => {
  const n = String(value ?? '').replace(/[^\d.]/g, '');
  return n || '0';
};

const firstName = (name = '') => String(name || '').trim().split(/\s+/)[0] || 'there';

function formatOrderDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isCodMethod(paymentMethod = '') {
  return /cod|cash on delivery/i.test(String(paymentMethod));
}

function customerPaymentLabel(paymentMethod = '') {
  if (isCodMethod(paymentMethod)) return 'Cash on Delivery';
  const raw = String(paymentMethod || '').trim();
  if (!raw || /prepaid|razorpay/i.test(raw)) return 'UPI / card';
  return raw;
}

const table = (inner, style = '') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;

function productRow({ quantity = 1, product = PRODUCT_NAME, price = '' } = {}) {
  const qty = Number(quantity) || 1;
  return table(`
  <tr>
    <td width="72" valign="middle" style="width:72px;padding:0;">
      <img src="${PRODUCT_IMAGE}" alt="${escape(product)}" width="72" height="72" style="display:block;width:72px;height:72px;border:0;border-radius:12px;">
    </td>
    <td valign="middle" style="padding:0 0 0 16px;font-family:${FONT};">
      <p class="smf-text" style="margin:0 0 4px 0;font-family:${HEADING_FONT};font-size:16px;font-weight:700;line-height:1.3;color:${TEXT};">${escape(product)}</p>
      <p class="smf-muted" style="margin:0;font-size:13px;line-height:1.45;color:${MUTED};">Fabric odor spray · Qty ${escape(String(qty))}</p>
    </td>
    ${price ? `<td valign="middle" align="right" class="smf-text" style="padding:0 0 0 12px;font-family:${FONT};font-size:15px;font-weight:600;color:${TEXT};white-space:nowrap;">${price}</td>` : ''}
  </tr>`, 'margin:0 0 4px 0;');
}

// Label / value row. `emphasize` is the total line: a heavier rule above it.
const kvRow = (label, value, emphasize = false) => `
<tr>
  <td class="${emphasize ? 'smf-text smf-rule-strong' : 'smf-muted smf-rule'}" style="font-family:${FONT};font-size:${emphasize ? '15px' : '14px'};font-weight:${emphasize ? '600' : '400'};color:${emphasize ? TEXT : MUTED};padding:${emphasize ? '14px' : '10px'} 0 ${emphasize ? '4px' : '10px'} 0;border-top:${emphasize ? `2px solid ${TEXT}` : `1px solid ${BORDER}`};width:46%;">${escape(label)}</td>
  <td class="smf-text${emphasize ? ' smf-rule-strong' : ' smf-rule'}" style="font-family:${emphasize ? HEADING_FONT : FONT};font-size:${emphasize ? '22px' : '14px'};font-weight:${emphasize ? '700' : '500'};color:${TEXT};padding:${emphasize ? '12px' : '10px'} 0 ${emphasize ? '4px' : '10px'} 12px;border-top:${emphasize ? `2px solid ${TEXT}` : `1px solid ${BORDER}`};text-align:right;">${value}</td>
</tr>`;

function priceBreakdown({ quantity = 1, amount = '', codFee = 0 } = {}) {
  const qty = Number(quantity) || 1;
  const total = Number(String(amount).replace(/[^\d.]/g, '')) || 0;
  const fee = Number(codFee) || 0;
  const subtotal = Math.max(0, total - fee);
  return summaryTable(`
    ${kvRow(`Subtotal (${qty} item${qty > 1 ? 's' : ''})`, `&#8377;${escape(String(subtotal))}`)}
    ${kvRow('Shipping', escape(SHIPPING_LABEL))}
    ${fee > 0 ? kvRow('COD handling', `&#8377;${escape(String(fee))}`) : ''}
    ${kvRow(fee > 0 ? 'Amount due' : 'Total paid', `&#8377;${escape(String(total || subtotal))}`, true)}
  `);
}

export function formatAddress(address) {
  if (!address) return '';
  if (typeof address === 'string') return address.replace(/\s+/g, ' ').trim();
  return [address.line, address.city, address.state, address.pincode].filter(Boolean).join(', ');
}

// Bulletproof button: the <td> carries the fill, so it survives image-off and
// Outlook. Full width on phones (.smf-btn-wrap).
const button = (href, label) => `
<table role="presentation" class="smf-btn-wrap" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td class="smf-btn" align="center" style="background-color:${LIME};border-radius:12px;mso-padding-alt:16px 32px;">
      <a href="${safeUrl(href)}" style="display:inline-block;padding:16px 32px;font-family:${FONT};font-weight:600;font-size:16px;line-height:1;color:${INK};text-decoration:none;border-radius:12px;">
        ${escape(label)}&nbsp;&rarr;
      </a>
    </td>
  </tr>
</table>`;

const statusPill = (label) =>
  `<span style="display:inline-block;background-color:${LIME};color:${INK};padding:4px 10px;border-radius:999px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;line-height:1.4;">${label}</span>`;

// Contact panel at the foot of every customer email (admin emails skip it).
const helpPanel = () => `
        <tr>
          <td class="smf-pad smf-card" style="padding:0 36px 32px 36px;background-color:${CARD};">
            ${table(`<tr><td class="smf-panel" style="background-color:${PANEL};border:1px solid ${BORDER};border-radius:14px;padding:18px 20px;font-family:${FONT};">
              <p class="smf-text" style="margin:0 0 4px 0;font-family:${HEADING_FONT};font-size:15px;font-weight:700;color:${TEXT};">Questions? We reply fast.</p>
              <p class="smf-muted" style="margin:0;font-size:14px;line-height:1.55;color:${MUTED};">Reply to this email, write to <a class="smf-link" href="mailto:${SUPPORT_EMAIL}" style="color:${TEXT};font-weight:600;text-decoration:underline;">${SUPPORT_EMAIL}</a> or WhatsApp <a class="smf-link" href="${WHATSAPP_URL}" style="color:${TEXT};font-weight:600;text-decoration:underline;">${WHATSAPP_LABEL}</a>.</p>
            </td></tr>`)}
          </td>
        </tr>`;

const shell = (inner, preheader = '', { help = true } = {}) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Smelloff</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<!--[if !mso]><!--><link href="${FONT_LINK}" rel="stylesheet"><!--<![endif]-->
<style type="text/css">
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { color:${INK}; }
  @media only screen and (max-width: 620px) {
    .smf-wrap { width: 100% !important; border-radius: 0 !important; }
    .smf-outer { padding: 0 !important; }
    .smf-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .smf-hero { font-size: 26px !important; }
    .smf-col { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; }
    .smf-btn-wrap { width: 100% !important; }
    .smf-btn a { display: block !important; }
    .smf-step-label { font-size: 10px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .smf-page { background-color: ${INK} !important; }
    .smf-wrap, .smf-card { background-color: #121212 !important; }
    .smf-panel { background-color: #1A1A1A !important; border-color: #2A2D27 !important; }
    .smf-text, .smf-hero { color: #F2F5EF !important; }
    .smf-muted { color: #9DA398 !important; }
    .smf-rule { border-color: #2A2D27 !important; }
    .smf-rule-strong { border-color: #F2F5EF !important; }
    .smf-step-off { background-color: #2A2D27 !important; }
    .smf-link { color: #F2F5EF !important; }
  }
</style>
</head>
<body class="smf-page" style="margin:0;padding:0;background-color:${PAGE};font-family:${FONT};color:${TEXT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escape(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table class="smf-page" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
  <tr>
    <td align="center" class="smf-outer" style="padding:32px 12px;">
      <table role="presentation" class="smf-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${CARD};border-radius:20px;overflow:hidden;">
        <tr>
          <td class="smf-pad" style="background-color:${INK};padding:22px 36px;">
            ${table(`<tr>
              <td valign="middle"><a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO}" alt="SMELLOFF" width="132" height="25" style="display:block;width:132px;height:auto;border:0;"></a></td>
              <td valign="middle" align="right" style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${LIME};">ODORSTRIKE</td>
            </tr>`)}
          </td>
        </tr>
        <tr>
          <td class="smf-pad smf-card" style="padding:36px 36px 32px 36px;background-color:${CARD};">
            ${inner}
          </td>
        </tr>
        ${help ? helpPanel() : ''}
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr>
          <td class="smf-pad" align="center" style="padding:24px 36px 8px 36px;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};">
            <p class="smf-muted" style="margin:0 0 6px 0;">
              <a class="smf-link" href="${SITE_URL}/track-order" style="color:${TEXT};text-decoration:none;font-weight:600;">Track order</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a class="smf-link" href="${SITE_URL}/returns" style="color:${TEXT};text-decoration:none;font-weight:600;">Returns</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a class="smf-link" href="${SITE_URL}/faq" style="color:${TEXT};text-decoration:none;font-weight:600;">FAQ</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a class="smf-link" href="https://instagram.com/smelloffx" style="color:${TEXT};text-decoration:none;font-weight:600;">Instagram</a>
            </p>
            <p class="smf-muted" style="margin:0;color:${MUTED};">Smelloff · Hyderabad, India · Pocket-sized fabric odor spray</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

const kicker = (label) =>
  `<p style="margin:0 0 16px 0;">${statusPill(escape(label))}</p>`;

const hero = (text, label = '') =>
  `${label ? kicker(label) : ''}<h1 class="smf-hero" style="font-family:${HEADING_FONT};font-weight:700;font-size:30px;line-height:1.12;letter-spacing:-0.6px;color:${TEXT};margin:0 0 14px 0;">${text}</h1>`;

const para = (text) =>
  `<p class="smf-text" style="font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};margin:0 0 16px 0;">${text}</p>`;

const muted = (text) =>
  `<p class="smf-muted" style="font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 14px 0;">${text}</p>`;

const sectionLabel = (text) =>
  `<p class="smf-muted" style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};margin:28px 0 12px 0;">${text}</p>`;

const panel = (content) =>
  table(`<tr><td class="smf-panel" style="background-color:${PANEL};border:1px solid ${BORDER};border-radius:14px;padding:6px 20px 14px 20px;">${content}</td></tr>`, 'margin:20px 0;');

function summaryTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

// Order journey: Confirmed → Shipped → Out for delivery → Delivered.
// `current` is the index of the step the email is about.
const STEPS = ['Confirmed', 'Shipped', 'Out for delivery', 'Delivered'];
function tracker(current = 0) {
  const cells = STEPS.map((label, i) => {
    const done = i <= current;
    return `<td width="25%" valign="top" style="width:25%;padding:0 ${i < STEPS.length - 1 ? '4px' : '0'} 0 0;">
      <div class="${done ? '' : 'smf-step-off'}" style="height:6px;line-height:6px;font-size:0;border-radius:3px;background-color:${done ? LIME : BORDER};">&nbsp;</div>
      <p class="smf-step-label ${i === current ? 'smf-text' : 'smf-muted'}" style="margin:8px 0 0 0;font-family:${FONT};font-size:11px;line-height:1.3;font-weight:${i === current ? '600' : '400'};color:${i === current ? TEXT : MUTED};">${label}</p>
    </td>`;
  }).join('');
  return table(`<tr>${cells}</tr>`, 'margin:24px 0 8px 0;');
}

// Short numbered "what happens next" list.
function nextSteps(items = []) {
  const rows = items.map((item, i) => `<tr>
    <td width="28" valign="top" style="width:28px;padding:0 0 12px 0;">
      <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background-color:${LIME};color:${INK};font-family:${FONT};font-size:12px;font-weight:600;text-align:center;">${i + 1}</div>
    </td>
    <td valign="top" class="smf-text" style="padding:1px 0 12px 8px;font-family:${FONT};font-size:14px;line-height:1.55;color:${TEXT};">${item}</td>
  </tr>`).join('');
  return table(rows);
}

// Two side-by-side facts (stack on phones).
function infoColumns(left, right) {
  const col = ({ label, value }) => `<td class="smf-col" width="50%" valign="top" style="width:50%;padding:0 12px 0 0;">
      <p class="smf-muted" style="margin:0 0 6px 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${label}</p>
      <p class="smf-text" style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${TEXT};">${value}</p>
    </td>`;
  return table(`<tr>${col(left)}${col(right)}</tr>`, 'margin:24px 0 0 0;');
}

const orderMeta = (orderId, dateLabel = '') =>
  muted(`Order <strong class="smf-text" style="color:${TEXT};font-weight:600;">#${escape(orderId || '—')}</strong>${dateLabel ? ` · ${escape(dateLabel)}` : ''}`);

function textBlock(lines) {
  return lines.filter((line) => line !== null && line !== undefined).join('\n');
}

export function codConfirmation(data = {}) {
  return orderConfirmation({
    ...data,
    paymentMethod: data.paymentMethod || 'Cash on Delivery',
  });
}

export function orderConfirmation({
  orderId = '',
  customerName = 'there',
  amount = '',
  address = '',
  paymentMethod = '',
  codFee = 0,
  quantity = 1,
  timestamp = '',
  transactionRef = '',
  paymentStatus = '',
  estimatedDelivery = '',
} = {}) {
  const fee = Number(codFee) || 0;
  const cod = isCodMethod(paymentMethod) || fee > 0;
  const qty = Number(quantity) || 1;
  const methodLabel = customerPaymentLabel(paymentMethod || (cod ? 'Cash on Delivery' : ''));
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const dateLabel = formatOrderDate(timestamp) || formatOrderDate(new Date());
  const statusLabel = cod ? 'Confirmed · pay on delivery' : (paymentStatus && /paid|confirmed/i.test(paymentStatus) ? 'Paid' : 'Paid');
  const eta = estimatedDelivery || ETA_COPY;

  const subtotalRupees = Math.max(0, (Number(rupee(amount)) || 0) - fee);
  const inner = `
    ${hero(`Thanks, ${escape(firstName(name))}. Your order is in.`, cod ? 'Order confirmed · Cash on Delivery' : 'Order confirmed · Paid')}
    ${para(cod
      ? `Nothing has been charged. Pay <strong>&#8377;${escape(rupee(amount))}</strong> in cash or UPI when it arrives.`
      : `We've received your payment of <strong>&#8377;${escape(rupee(amount))}</strong>. Your ODORSTRIKE is locked in.`)}
    ${orderMeta(cleanOrderId, dateLabel)}
    ${tracker(0)}
    ${button(trackUrl(cleanOrderId), 'Track order')}

    ${sectionLabel('Your order')}
    ${productRow({ quantity: qty, price: subtotalRupees ? `&#8377;${escape(String(subtotalRupees))}` : '' })}
    ${table(`<tr><td style="padding-top:16px;">${priceBreakdown({ quantity: qty, amount, codFee: fee })}</td></tr>`)}

    ${infoColumns(
      { label: 'Delivering to', value: escape(address || '—').replace(/\n/g, '<br>') },
      { label: 'Payment', value: `${escape(methodLabel)}<br><span class="smf-muted" style="color:${MUTED};">${escape(statusLabel)}${!cod && transactionRef ? ` · Ref ${escape(transactionRef)}` : ''}</span>` },
    )}

    ${sectionLabel('What happens next')}
    ${nextSteps([
      'We pack your order within 48 hours (Mon–Sat).',
      `The courier picks it up and the tracking link lands in your inbox. Delivery: ${escape(eta.charAt(0).toLowerCase() + eta.slice(1))}.`,
      cod
        ? `Keep <strong>&#8377;${escape(rupee(amount))}</strong> ready, cash or UPI, when it arrives.`
        : 'Spray 15–20 cm from the fabric: collar, underarms, cuffs. Fabric only, never skin.',
    ])}
  `;

  const subject = cleanHeader(
    cod
      ? `COD order confirmed — #${cleanOrderId}`
      : `Order confirmed — #${cleanOrderId}`
  );

  const text = textBlock([
    'SMELLOFF — ORDER CONFIRMED',
    '',
    `Hey ${name},`,
    '',
    cod
      ? `Your ODORSTRIKE is locked in. Nothing has been charged — pay ₹${rupee(amount)} in cash or UPI when it arrives.`
      : 'Payment received. Your ODORSTRIKE is locked in.',
    '',
    'ORDER SUMMARY',
    `Order ID: ${cleanOrderId}`,
    `Product: ${PRODUCT_NAME}`,
    `Quantity: ${qty}`,
    `Shipping: ${SHIPPING_LABEL}`,
    fee > 0 ? `COD handling: ₹${fee}` : null,
    `${fee > 0 ? 'Amount due' : 'Total paid'}: ₹${rupee(amount)}`,
    `Payment method: ${methodLabel}`,
    `Status: ${statusLabel}`,
    !cod && transactionRef ? `Reference: ${transactionRef}` : null,
    `Order date: ${dateLabel}`,
    `Delivery: ${eta}`,
    '',
    'SHIPS TO',
    address || '—',
    '',
    `Track order: ${trackUrl(cleanOrderId)}`,
    '',
    `Need help? Contact Smelloff Support: ${SUPPORT_EMAIL}`,
  ]);

  return {
    subject,
    html: shell(
      inner,
      cod
        ? `Pay ₹${rupee(amount)} on delivery. Nothing charged yet. Order #${cleanOrderId}.`
        : `₹${rupee(amount)} paid. Your ODORSTRIKE order #${cleanOrderId} is confirmed.`
    ),
    text,
  };
}

export function paymentConfirmation({
  orderId = '',
  customerName = 'there',
  amount = '',
  paymentMethod = 'UPI / card',
  transactionRef = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const methodLabel = customerPaymentLabel(paymentMethod);
  const inner = `
    ${hero(`&#8377;${escape(rupee(amount))} received.`, 'Payment received')}
    ${para(`Thanks, ${escape(firstName(name))}. Payment for your ODORSTRIKE order came through.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Payment method', escape(methodLabel))}
      ${transactionRef ? kvRow('Reference', escape(transactionRef)) : ''}
      ${kvRow('Amount paid', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${button(trackUrl(cleanOrderId), 'View order')}
  `;
  return {
    subject: cleanHeader(`Payment received — #${cleanOrderId}`),
    html: shell(inner, `₹${rupee(amount)} paid successfully for order #${cleanOrderId}.`),
    text: textBlock([
      'SMELLOFF — PAYMENT RECEIVED',
      '',
      `Hey ${name},`,
      '',
      `₹${rupee(amount)} paid successfully.`,
      `Order #${cleanOrderId}`,
      `Payment method: ${methodLabel}`,
      transactionRef ? `Reference: ${transactionRef}` : null,
      '',
      `View order: ${trackUrl(cleanOrderId)}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function orderShipped({
  orderId = '',
  customerName = 'there',
  trackingId = '',
  courier = '',
  trackingUrl = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const href = trackingUrl || trackUrl(cleanOrderId);
  const inner = `
    ${hero(`It's on the way, ${escape(firstName(name))}.`, 'Shipped')}
    ${para('Your ODORSTRIKE has left our Hyderabad warehouse.')}
    ${orderMeta(cleanOrderId)}
    ${tracker(1)}
    ${button(href, 'Track shipment')}
    ${panel(summaryTable(`
      ${kvRow('Courier', escape(courier || 'Assigned'))}
      ${kvRow('Tracking number', `<span style="font-weight:600;letter-spacing:0.4px;">${escape(trackingId || 'Updating shortly')}</span>`)}
      ${kvRow('Expected', '3–5 business days to metros, 5–7 elsewhere')}
    `))}
    ${muted('Delivery time depends on your city. You will get another email when it is out for delivery.')}
  `;
  return {
    subject: cleanHeader(
      trackingId
        ? `Shipped — #${cleanOrderId} · ${trackingId}`
        : `Shipped — #${cleanOrderId}`
    ),
    html: shell(inner, `${courier || 'Courier'} has your ODORSTRIKE. Tracking is live.`),
    text: textBlock([
      'SMELLOFF — YOUR ORDER IS ON THE MOVE',
      '',
      `${name}, your ODORSTRIKE has left the warehouse.`,
      '',
      `Order: #${cleanOrderId}`,
      `Courier: ${courier || 'Assigned'}`,
      `AWB: ${trackingId || 'Updating'}`,
      'Tracking status: Shipped',
      '',
      `Track shipment: ${href}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function outForDelivery({
  orderId = '',
  customerName = 'there',
  courier = '',
  trackingId = '',
  trackingUrl = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const href = trackingUrl || trackUrl(cleanOrderId);
  const inner = `
    ${hero('Arriving today.', 'Out for delivery')}
    ${para(`${escape(firstName(name))}, your ODORSTRIKE is on the last stretch. Keep your phone close for the courier's call.`)}
    ${orderMeta(cleanOrderId)}
    ${tracker(2)}
    ${button(href, 'Track shipment')}
    ${panel(summaryTable(`
      ${kvRow('Courier', escape(courier || 'Courier'))}
      ${trackingId ? kvRow('Tracking number', escape(trackingId)) : ''}
    `))}
    ${muted('Paying cash on delivery? Keep the exact amount ready, cash or UPI.')}
  `;
  return {
    subject: cleanHeader(`Out for delivery today — #${cleanOrderId}`),
    html: shell(inner, `Your ODORSTRIKE is out for delivery. Keep your phone close.`),
    text: textBlock([
      'SMELLOFF — OUT FOR DELIVERY',
      '',
      `${name}, your ODORSTRIKE is out for delivery today.`,
      '',
      `Order: #${cleanOrderId}`,
      `Courier: ${courier || 'Courier'}`,
      trackingId ? `AWB: ${trackingId}` : null,
      '',
      `Track shipment: ${href}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function orderDelivered({
  orderId = '',
  customerName = 'there',
  reviewUrl = `${SITE_URL}/reviews`,
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero(`It's here, ${escape(firstName(name))}.`, 'Delivered')}
    ${para('Your ODORSTRIKE has arrived. Here is how to get the most from it.')}
    ${orderMeta(cleanOrderId)}
    ${tracker(3)}
    ${sectionLabel('How to use it')}
    ${nextSteps([
      'Hold the bottle 15–20 cm from the fabric.',
      'Two or three sprays on the collar, underarms and cuffs.',
      'Let it air for 30 seconds, then wear. Fabric only, never skin.',
    ])}
    ${button(`${SITE_URL}/blog/how-to-use-odorstrike`, 'Read the full guide')}
  `;
  return {
    subject: cleanHeader(`Delivered — #${cleanOrderId}`),
    html: shell(inner, 'Your ODORSTRIKE has arrived. Two sprays. Thirty seconds.'),
    text: textBlock([
      'SMELLOFF — DELIVERED',
      '',
      `${name}, your ODORSTRIKE is in.`,
      '',
      `Order: #${cleanOrderId}`,
      '',
      'Hold 15–20cm from the fabric. Two or three sprays on collar, underarms, cuffs. Let it air for 30 seconds. Not for skin.',
      '',
      'How to use ODORSTRIKE:',
      `${SITE_URL}/blog/how-to-use-odorstrike`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function adminNewOrder({
  orderId = '',
  customerName = '',
  phone = '',
  email = '',
  paymentMethod = '',
  amount = '',
  product = PRODUCT_NAME,
  quantity = 1,
  address = '',
  city = '',
  codFee = 0,
  timestamp = '',
  paymentStatus = '',
  fulfillmentStatus = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const cod = isCodMethod(paymentMethod) || Number(codFee) > 0;
  const methodShort = cod ? 'COD' : 'Prepaid';
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  const when = timestamp ? new Date(timestamp) : new Date();
  const whenLabel = Number.isNaN(when.getTime()) ? String(timestamp)
    : when.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST';
  const who = [customerName, city].filter(Boolean).join(', ');
  const contactButtons = digits ? `
    ${table(`<tr>
      <td width="50%" style="padding:0 6px 0 0;">${button(`tel:+91${digits}`, 'Call').replace('margin:28px 0 8px 0;', 'margin:20px 0 0 0;width:100%;')}</td>
      <td width="50%" style="padding:0 0 0 6px;">${button(`https://wa.me/91${digits}?text=${encodeURIComponent(`Hi ${customerName || ''}, this is Smelloff about your ODORSTRIKE order ${cleanOrderId}.`)}`, 'WhatsApp').replace('margin:28px 0 8px 0;', 'margin:20px 0 0 0;width:100%;')}</td>
    </tr>`)}` : '';
  const inner = `
    ${hero(`&#8377;${escape(rupee(amount))} &middot; ${escape(methodShort)}`, 'New order')}
    ${para(`<strong>${escape(who || 'New customer')}</strong> ordered ${escape(String(quantity || 1))} &times; ${escape(product || PRODUCT_NAME)}.`)}
    ${orderMeta(cleanOrderId, whenLabel)}
    ${panel(summaryTable(`
      ${kvRow('Customer', escape(customerName || '—'))}
      ${kvRow('Phone', digits ? `<a class="smf-link" href="tel:+91${escape(digits)}" style="color:${TEXT};">+91 ${escape(digits)}</a>` : '—')}
      ${kvRow('Email', escape(email || '—'))}
      ${kvRow('Payment', escape(cod ? 'Cash on Delivery' : (paymentStatus || 'Prepaid')))}
      ${kvRow(cod ? 'Collect on delivery' : 'Paid', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${sectionLabel('Ship to')}
    ${para(escape(address || '—'))}
    ${contactButtons}
    ${sectionLabel('Next')}
    ${nextSteps([
      cod ? 'Call or WhatsApp to confirm the COD order.' : 'Payment is confirmed. No call needed.',
      'It reaches Shiprocket within 15 minutes. Open it there and tap Ship Now.',
      'Tracking and the customer emails then go out automatically.',
    ])}
    ${button(`${ADMIN_URL}#orders`, 'Open in admin')}
  `;
  const subjectWho = who ? ` · ${who}` : '';
  return {
    subject: cleanHeader(`New order · ₹${rupee(amount)} ${methodShort}${subjectWho} · ${cleanOrderId}`),
    html: shell(inner, `${methodShort} order ${cleanOrderId} · ₹${rupee(amount)}${subjectWho}`, { help: false }),
    text: textBlock([
      'SMELLOFF — NEW ORDER',
      '',
      `Order ID: ${cleanOrderId}`,
      `Customer: ${customerName || '—'}`,
      `Phone: ${digits ? '+91 ' + digits : '—'}`,
      `Email: ${email || '—'}`,
      `Payment: ${cod ? 'Cash on Delivery' : 'Prepaid'}`,
      `Amount: ₹${rupee(amount)}`,
      `Product: ${product || PRODUCT_NAME}`,
      `Quantity: ${quantity || 1}`,
      `Payment status: ${paymentStatus || '—'}`,
      `Fulfillment: ${fulfillmentStatus || '—'}`,
      `Timestamp: ${timestamp || new Date().toISOString()}`,
      '',
      'ADDRESS',
      address || '—',
      '',
      `Open order: ${ADMIN_URL}#orders`,
    ]),
  };
}

export function adminPaymentConfirmed({
  orderId = '',
  amount = '',
  customerName = '',
  paymentMethod = '',
  transactionRef = '',
  timestamp = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const inner = `
    ${hero(`&#8377;${escape(rupee(amount))} verified`, 'Payment verified')}
    ${panel(summaryTable(`
      ${kvRow('Order ID', escape(cleanOrderId))}
      ${kvRow('Amount', `&#8377;${escape(rupee(amount))}`)}
      ${kvRow('Customer', escape(customerName || '—'))}
      ${kvRow('Payment method', escape(paymentMethod || 'Prepaid'))}
      ${transactionRef ? kvRow('Transaction', escape(transactionRef)) : ''}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
    ${button(`${ADMIN_URL}#orders`, 'Open order')}
  `;
  return {
    subject: cleanHeader(`PAYMENT VERIFIED — ${cleanOrderId}`),
    html: shell(inner, `Payment verified for ${cleanOrderId} · ₹${rupee(amount)}`, { help: false }),
    text: textBlock([
      'SMELLOFF OPS — PAYMENT VERIFIED',
      '',
      `Order ID: ${cleanOrderId}`,
      `Amount: ₹${rupee(amount)}`,
      `Customer: ${customerName || '—'}`,
      `Payment method: ${paymentMethod || 'Prepaid'}`,
      transactionRef ? `Transaction: ${transactionRef}` : null,
      `Timestamp: ${timestamp || new Date().toISOString()}`,
      '',
      `Open order: ${ADMIN_URL}#orders`,
    ]),
  };
}

export function emailFailure({
  emailType = '',
  orderId = '',
  recipientMasked = '',
  provider = 'resend',
  errorCode = '',
  errorMessage = '',
  timestamp = '',
} = {}) {
  const inner = `
    ${hero('An email did not send', 'Email delivery failure')}
    ${panel(summaryTable(`
      ${kvRow('Email type', escape(emailType || '—'))}
      ${kvRow('Order ID', escape(orderId || '—'))}
      ${kvRow('Recipient', escape(recipientMasked || '—'))}
      ${kvRow('Provider', escape(provider || 'resend'))}
      ${kvRow('Error code', escape(errorCode || '—'))}
      ${kvRow('Error', escape(String(errorMessage || '—').slice(0, 280)))}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
  `;
  return {
    subject: cleanHeader(`EMAIL DELIVERY FAILURE — ${emailType || 'unknown'} ${orderId || ''}`.trim()),
    html: shell(inner, `Email failure: ${emailType} ${orderId}`, { help: false }),
    text: textBlock([
      'SMELLOFF OPS — EMAIL DELIVERY FAILURE',
      '',
      `Email type: ${emailType || '—'}`,
      `Order ID: ${orderId || '—'}`,
      `Recipient: ${recipientMasked || '—'}`,
      `Provider: ${provider || 'resend'}`,
      `Error code: ${errorCode || '—'}`,
      `Error message: ${errorMessage || '—'}`,
      `Timestamp: ${timestamp || new Date().toISOString()}`,
    ]),
  };
}

export function diagnosticTest({
  emailId = '',
  environment = 'production',
  timestamp = '',
} = {}) {
  const inner = `
    ${hero('Email system test', 'System test')}
    ${panel(summaryTable(`
      ${kvRow('Status', statusPill('RESEND API → ACCEPTED'))}
      ${kvRow('Email ID', escape(emailId || 'pending'))}
      ${kvRow('Environment', escape(environment || 'production'))}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
  `;
  return {
    subject: cleanHeader('SMELLOFF EMAIL SYSTEM TEST'),
    html: shell(inner, 'Smelloff email system test — Resend API accepted.', { help: false }),
    text: textBlock([
      'SMELLOFF EMAIL SYSTEM TEST',
      '',
      'Status: RESEND API → ACCEPTED',
      `Email ID: ${emailId || 'pending'}`,
      `Environment: ${environment || 'production'}`,
      `Timestamp: ${timestamp || new Date().toISOString()}`,
    ]),
  };
}

export function welcomeEmail({ customerName = 'there' } = {}) {
  const name = customerName || 'there';
  const inner = `
    ${hero("You're in.", 'Welcome to Smelloff')}
    ${para(`Hey ${escape(firstName(name))}. Welcome to Smelloff.`)}
    ${muted('ODORSTRIKE is a 50ml fabric-only odor reset spray. Not perfume. Not body deodorant. One pocket-sized bottle for clothes — sweat, smoke, food, day-two shirts.')}
    ${table(`<tr><td style="padding:8px 0 0 0;">${productRow({ price: `&#8377;${PRICE}&nbsp;<span class="smf-muted" style="font-size:13px;font-weight:400;color:${MUTED};text-decoration:line-through;">&#8377;${MRP}</span>` })}</td></tr>`)}
    ${button(SITE_URL, 'Shop now')}
  `;
  return {
    subject: 'Welcome to Smelloff',
    html: shell(inner, 'Pocket-sized fabric odor reset spray for clothes.'),
    text: textBlock([
      'SMELLOFF — YOU ARE IN.',
      '',
      `Hey ${name}. Welcome to Smelloff.`,
      '',
      `ODORSTRIKE 50ml — ₹${PRICE} (MRP ₹${MRP})`,
      SITE_URL,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function abandonedCart({
  customerName = 'there',
  productUrl = SITE_URL,
} = {}) {
  const name = customerName || 'there';
  const inner = `
    ${hero('You left something.', 'Still in your cart')}
    ${para(`${escape(firstName(name))}, your ODORSTRIKE is still in the cart.`)}
    ${table(`<tr><td style="padding:8px 0 0 0;">${productRow({ price: `&#8377;${PRICE}` })}</td></tr>`)}
    ${muted('Free shipping on prepaid orders · Cash on Delivery available · 7-day returns')}
    ${button(productUrl, 'Finish order')}
  `;
  return {
    subject: 'You left something behind.',
    html: shell(inner, 'Your ODORSTRIKE is still in the cart.'),
    text: textBlock([
      'SMELLOFF — YOU LEFT SOMETHING.',
      '',
      `${name}, your ODORSTRIKE is still in the cart.`,
      '',
      `${PRODUCT_NAME} — ₹${PRICE}`,
      `Finish order: ${productUrl}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function paymentReminder({
  orderId = '',
  customerName = 'there',
  amount = String(PRICE),
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero('One step left.', 'Payment pending')}
    ${para(`${escape(firstName(name))}, order #${escape(cleanOrderId)} is reserved. Payment has not landed yet.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Amount due', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${button(trackUrl(cleanOrderId), 'Complete order')}
  `;
  return {
    subject: cleanHeader(`Payment pending — complete your order #${cleanOrderId}`),
    html: shell(inner, `Finish payment for order #${cleanOrderId}.`),
    text: textBlock([
      'SMELLOFF — ONE STEP LEFT',
      '',
      `${name}, payment for order #${cleanOrderId} is still pending.`,
      `Amount due: ₹${rupee(amount)}`,
      '',
      `Complete order: ${trackUrl(cleanOrderId)}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function orderCancelled({
  orderId = '',
  customerName = 'there',
  reason = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero('Your order was cancelled.', 'Order cancelled')}
    ${para(`${escape(firstName(name))}, ODORSTRIKE order #${escape(cleanOrderId)} has been cancelled.`)}
    ${reason ? panel(summaryTable(kvRow('Reason', escape(reason)))) : ''}
    ${muted('If you already paid, the refund is in motion and usually lands in 5–7 business days. Cash on Delivery orders have nothing to reverse.')}
    ${button(SITE_URL, 'Shop again')}
  `;
  return {
    subject: cleanHeader(`Order cancelled — #${cleanOrderId}`),
    html: shell(inner, `Your ODORSTRIKE order #${cleanOrderId} was cancelled.`),
    text: textBlock([
      'SMELLOFF — ORDER CANCELLED',
      '',
      `${name}, order #${cleanOrderId} has been cancelled.`,
      reason ? `Reason: ${reason}` : null,
      '',
      'If you already paid, the refund is in motion and usually lands in 5–7 business days. Cash on Delivery orders have nothing to reverse.',
      '',
      SITE_URL,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function refundProcessed({
  orderId = '',
  customerName = 'there',
  amount = '',
  method = 'original payment method',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero(`&#8377;${escape(rupee(amount))} is on its way back.`, 'Refund processed')}
    ${para(`${escape(firstName(name))}, we processed the refund for order #${escape(cleanOrderId)}.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Back to', escape(method))}
      ${kvRow('Refund', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${muted('It usually lands in 5–7 business days, depending on your bank. Same source as the original payment.')}
  `;
  return {
    subject: cleanHeader(`Refund processed — #${cleanOrderId}`),
    html: shell(inner, `Your refund of ₹${rupee(amount)} for order #${cleanOrderId} is on its way.`),
    text: textBlock([
      'SMELLOFF — REFUND ON ITS WAY',
      '',
      `${name}, we processed the refund for order #${cleanOrderId}.`,
      `Refund amount: ₹${rupee(amount)}`,
      `Back to: ${method}`,
      '',
      'It usually lands in 5–7 business days, depending on your bank. Same source as the original payment.',
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function paymentFailed({
  orderId = '',
  customerName = 'there',
  amount = '',
  retryUrl = SITE_URL,
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero("Your payment didn't go through.", 'Not charged')}
    ${para(`${escape(firstName(name))}, the prepaid attempt for order #${escape(cleanOrderId)} did not complete.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Status', statusPill('Not charged'))}
      ${kvRow('Amount', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${muted('Nothing was taken from your account. You can try UPI again, or switch to Cash on Delivery at checkout.')}
    ${button(retryUrl, 'Try again')}
  `;
  return {
    subject: cleanHeader(`Payment didn't go through — #${cleanOrderId}`),
    html: shell(inner, `Nothing was charged for order #${cleanOrderId}. You can try again.`),
    text: textBlock([
      "SMELLOFF — PAYMENT DIDN'T LAND",
      '',
      `${name}, the prepaid attempt for order #${cleanOrderId} did not complete.`,
      `Amount: ₹${rupee(amount)}`,
      'Status: Not charged',
      '',
      `Try again: ${retryUrl}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export function reviewRequest({
  orderId = '',
  customerName = 'there',
  reviewUrl = `${SITE_URL}/reviews`,
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero("How's it working?", 'Quick question')}
    ${para(`${escape(firstName(name))}, you've had ODORSTRIKE for a few days.`)}
    ${para('If it earned a spot in your day (office, commute, travel), a short review helps the next person decide. No pressure if it did not.')}
    ${button(reviewUrl, 'Leave a review')}
    ${muted(`Order #${escape(cleanOrderId)} · this is a one-time ask.`)}
  `;
  return {
    subject: cleanHeader("How's ODORSTRIKE treating your clothes?"),
    html: shell(inner, 'Thirty seconds if it earned a review. One-time ask.'),
    text: textBlock([
      "SMELLOFF — HOW'S IT WORKING?",
      '',
      `${name}, you've had ODORSTRIKE for a few days.`,
      '',
      'If it earned a spot in your day, a short review helps the next person decide.',
      '',
      `Leave a review: ${reviewUrl}`,
      `Order: #${cleanOrderId}`,
      '',
      `Need help? ${SUPPORT_EMAIL}`,
    ]),
  };
}

export const TEMPLATES = {
  orderConfirmation,
  codConfirmation,
  paymentConfirmation,
  orderShipped,
  outForDelivery,
  orderDelivered,
  adminNewOrder,
  adminPaymentConfirmed,
  emailFailure,
  diagnosticTest,
  welcomeEmail,
  abandonedCart,
  paymentReminder,
  paymentFailed,
  reviewRequest,
  orderCancelled,
  refundProcessed,
};

export function renderTemplate(type, data = {}) {
  const builder = TEMPLATES[type];
  if (!builder) throw new Error(`Unknown email template: ${type}`);
  const rendered = builder(data || {});
  if (!rendered?.subject || !rendered?.html) {
    throw new Error(`Template ${type} produced invalid output`);
  }
  return rendered;
}
