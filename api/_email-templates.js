import { BASE_PRODUCT } from '../shared/products-config.js';

const BLACK = '#080808';
const GREEN = '#B8FF57';
const OFFWHITE = '#F5F5F0';
const MUTED = '#A8A8A0';
const BORDER = '#1F1F1F';
const PANEL = '#111111';

const FONT = "Arial, Helvetica, sans-serif";
const HEADING_FONT = "Arial, Helvetica, sans-serif";

const SUPPORT_EMAIL = BASE_PRODUCT.manufacturer.email || 'smelloffsupport@gmail.com';
const SITE_URL = 'https://smelloff.in';
const ADMIN_URL = 'https://admin.smelloff.in';
const PRICE = BASE_PRODUCT.price;
const MRP = BASE_PRODUCT.mrp;
const PRODUCT_NAME = 'ODORSTRIKE 50ml';
const PRODUCT_IMAGE = `${SITE_URL}/assets/odorstrike-bottle.jpg`;
const SHIPPING_LABEL = 'Free';
const ETA_COPY = 'Typically 3–7 days across India';

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

function formatOrderDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function productRow({ quantity = 1, product = PRODUCT_NAME, amount = '' } = {}) {
  const qty = Number(quantity) || 1;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0;">
  <tr>
    <td width="72" valign="top" style="width:72px;padding:0 14px 0 0;">
      <img src="${PRODUCT_IMAGE}" alt="${escape(product)}" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain;border:1px solid ${BORDER};background-color:${PANEL};">
    </td>
    <td valign="middle" style="font-family:${FONT};color:${OFFWHITE};">
      <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;letter-spacing:0.4px;">${escape(product)}</p>
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Fabric-only odor mist · 50ml · Qty ${escape(String(qty))}</p>
    </td>
    <td valign="middle" align="right" style="font-family:${FONT};font-size:16px;font-weight:700;color:${GREEN};white-space:nowrap;">&#8377;${escape(rupee(amount))}</td>
  </tr>
</table>`;
}

function priceBreakdown({ quantity = 1, amount = '', codFee = 0 } = {}) {
  const qty = Number(quantity) || 1;
  const total = Number(String(amount).replace(/[^\d.]/g, '')) || 0;
  const fee = Number(codFee) || 0;
  const subtotal = Math.max(0, total - fee);
  const unit = qty > 0 ? Math.round(subtotal / qty) : subtotal;
  return summaryTable(`
    ${kvRow(`${PRODUCT_NAME} × ${qty}`, `&#8377;${escape(String(unit * qty || subtotal))}`)}
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

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td style="background-color:${GREEN};border-radius:2px;">
      <a href="${safeUrl(href)}" style="display:inline-block;padding:14px 28px;font-family:${HEADING_FONT};font-weight:700;font-size:13px;letter-spacing:1.6px;color:${BLACK};text-decoration:none;text-transform:uppercase;">
        ${escape(label)}
      </a>
    </td>
  </tr>
</table>`;

const kvRow = (label, value, emphasize = false) => `
<tr>
  <td style="font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};padding:8px 0;border-bottom:1px solid ${BORDER};width:42%;">${escape(label)}</td>
  <td style="font-family:${FONT};font-size:${emphasize ? '18px' : '14px'};font-weight:${emphasize ? '700' : '400'};color:${emphasize ? GREEN : OFFWHITE};padding:8px 0;border-bottom:1px solid ${BORDER};text-align:right;">${value}</td>
</tr>`;

const shell = (inner, preheader = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>SMELLOFF</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .smf-wrap { width: 100% !important; }
    .smf-pad { padding: 28px 20px !important; }
    .smf-hero { font-size: 28px !important; line-height: 1.05 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BLACK};font-family:${FONT};color:${OFFWHITE};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escape(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLACK};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="smf-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${BLACK};border:1px solid ${BORDER};">
        <tr>
          <td class="smf-pad" style="padding:22px 32px;border-bottom:1px solid ${BORDER};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <a href="${SITE_URL}" style="text-decoration:none;">
                    <img src="${SITE_URL}/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" height="22" style="height:22px;width:auto;display:block;border:0;">
                  </a>
                </td>
                <td align="right" style="vertical-align:middle;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">
                  ODORSTRIKE
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="smf-pad" style="padding:40px 32px 32px 32px;">
            ${inner}
          </td>
        </tr>
        <tr>
          <td class="smf-pad" style="padding:24px 32px 28px 32px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:12px;color:${MUTED};line-height:1.6;">
            <p style="margin:0 0 8px 0;color:${OFFWHITE};letter-spacing:1px;text-transform:uppercase;font-size:11px;">Smelloff · Hyderabad, India</p>
            <p style="margin:0 0 8px 0;">Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${GREEN};text-decoration:none;">${SUPPORT_EMAIL}</a></p>
            <p style="margin:0;">
              <a href="${SITE_URL}" style="color:${MUTED};text-decoration:none;">smelloff.in</a>
              &nbsp;·&nbsp;
              <a href="https://instagram.com/smelloffindia" style="color:${MUTED};text-decoration:none;">@smelloffindia</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="font-family:${FONT};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};margin:16px 0 0 0;">
        Pocket-sized fabric odor reset spray
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

const hero = (text) =>
  `<div style="width:36px;height:3px;background-color:${GREEN};margin:0 0 18px 0;"></div>
<h1 class="smf-hero" style="font-family:${HEADING_FONT};font-weight:700;font-size:34px;line-height:1.05;letter-spacing:0.5px;color:${OFFWHITE};text-transform:uppercase;margin:0 0 18px 0;">${text}</h1>`;

const para = (text) =>
  `<p style="font-family:${FONT};font-size:15px;line-height:1.6;color:${OFFWHITE};margin:0 0 16px 0;">${text}</p>`;

const muted = (text) =>
  `<p style="font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};margin:0 0 14px 0;">${text}</p>`;

const panel = (content) =>
  `<div style="background-color:${PANEL};border:1px solid ${BORDER};border-left:3px solid ${GREEN};padding:20px 22px;margin:22px 0;">${content}</div>`;

function summaryTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function footerHelp() {
  return muted(`Need help? Contact Smelloff Support at <a href="mailto:${SUPPORT_EMAIL}" style="color:${GREEN};text-decoration:none;">${SUPPORT_EMAIL}</a>.`);
}

function textBlock(lines) {
  return lines.filter((line) => line !== null && line !== undefined).join('\n');
}

function isCodMethod(paymentMethod = '') {
  return /cod|cash on delivery/i.test(String(paymentMethod));
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
  const methodLabel = paymentMethod || (cod ? 'Cash on Delivery' : 'Prepaid (Razorpay)');
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const dateLabel = formatOrderDate(timestamp) || formatOrderDate(new Date());
  const statusLabel = cod ? 'Confirmed · pay on delivery' : (paymentStatus && /paid|confirmed/i.test(paymentStatus) ? 'Paid' : 'Paid');
  const eta = estimatedDelivery || ETA_COPY;

  const inner = `
    ${hero('Order confirmed')}
    ${para(`Hey ${escape(name)},`)}
    ${para(cod
      ? `Your ODORSTRIKE is locked in. Nothing has been charged — pay &#8377;${escape(rupee(amount))} in cash or UPI when it arrives.`
      : `Payment received. Your ODORSTRIKE is locked in.`)}

    ${productRow({ quantity: qty, amount: String(Number(rupee(amount)) - fee || amount) })}

    ${panel(`
      <p style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:0 0 10px 0;">Order ${escape(cleanOrderId || '—')}</p>
      ${priceBreakdown({ quantity: qty, amount, codFee: fee })}
      ${summaryTable(`
        ${kvRow('Payment', escape(methodLabel))}
        ${kvRow('Status', escape(statusLabel))}
        ${!cod && transactionRef ? kvRow('Reference', escape(transactionRef)) : ''}
        ${kvRow('Order date', escape(dateLabel))}
        ${kvRow('Delivery', escape(eta))}
      `)}
    `)}

    <p style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:24px 0 6px 0;">Ships to</p>
    ${muted(escape(address || '—').replace(/\n/g, '<br>'))}

    ${muted(cod
      ? 'We pack within 48 hours. Keep this email — it is your receipt and your tracking key.'
      : 'We pack within 48 hours. Tracking lands here the moment the courier scans it.')}

    ${button(trackUrl(cleanOrderId), 'Track order')}
    ${footerHelp()}
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
  paymentMethod = 'Prepaid (Razorpay)',
  transactionRef = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const name = customerName || 'there';
  const inner = `
    ${hero('Payment received')}
    ${para(`Hey ${escape(name)},`)}
    ${para('Payment for your ODORSTRIKE order came through.')}
    ${panel(`
      <p style="font-family:${HEADING_FONT};font-size:36px;font-weight:700;color:${GREEN};margin:0 0 8px 0;letter-spacing:-0.5px;">&#8377;${escape(rupee(amount))}</p>
      <p style="font-family:${FONT};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:0 0 16px 0;">Paid successfully</p>
      ${summaryTable(`
        ${kvRow('Order', `#${escape(cleanOrderId)}`)}
        ${kvRow('Payment method', escape(paymentMethod || 'Prepaid (Razorpay)'))}
        ${transactionRef ? kvRow('Reference', escape(transactionRef)) : ''}
      `)}
    `)}
    ${button(trackUrl(cleanOrderId), 'View order')}
    ${footerHelp()}
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
      `Payment method: ${paymentMethod || 'Prepaid (Razorpay)'}`,
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
    ${hero('On the move')}
    ${para(`${escape(name)}, your ODORSTRIKE has left the warehouse.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Courier', escape(courier || 'Assigned'))}
      ${kvRow('Tracking', `<span style="color:${GREEN};letter-spacing:1px;">${escape(trackingId || 'Updating shortly')}</span>`)}
      ${kvRow('Status', 'Shipped')}
    `))}
    ${muted('Delivery is typically 3–7 days from this scan, depending on your city.')}
    ${button(href, 'Track shipment')}
    ${footerHelp()}
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
    ${hero('Out for delivery')}
    ${para(`${escape(name)}, your ODORSTRIKE is on the last stretch today. Keep your phone close.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Courier', escape(courier || 'Courier'))}
      ${trackingId ? kvRow('Tracking', escape(trackingId)) : ''}
      ${kvRow('Status', '<span style="color:#B8FF57;">Out for delivery</span>')}
    `))}
    ${muted('If this is Cash on Delivery, keep the exact amount ready — cash or UPI.')}
    ${button(href, 'Track shipment')}
    ${footerHelp()}
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
    ${hero('Delivered')}
    ${para(`${escape(name)}, your ODORSTRIKE is in.`)}
    ${muted('Hold 15–20cm from the fabric. Two or three sprays on collar, underarms, cuffs. Let it air for 30 seconds. Not for skin.')}
    ${button(`${SITE_URL}/blog/how-to-use-odorstrike`, 'How to use ODORSTRIKE')}
    ${footerHelp()}
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
  timestamp = '',
  paymentStatus = '',
  fulfillmentStatus = '',
} = {}) {
  const cleanOrderId = String(orderId).replace(/[\r\n]+/g, '').trim();
  const inner = `
    ${hero('New ODORSTRIKE order')}
    ${panel(summaryTable(`
      ${kvRow('Order ID', escape(cleanOrderId))}
      ${kvRow('Customer', escape(customerName || '—'))}
      ${kvRow('Phone', escape(phone || '—'))}
      ${kvRow('Email', escape(email || '—'))}
      ${kvRow('Payment', escape(paymentMethod || '—'))}
      ${kvRow('Amount', `&#8377;${escape(rupee(amount))}`, true)}
      ${kvRow('Product', escape(product || PRODUCT_NAME))}
      ${kvRow('Quantity', escape(String(quantity || 1)))}
      ${kvRow('Payment status', escape(paymentStatus || '—'))}
      ${kvRow('Fulfillment', escape(fulfillmentStatus || '—'))}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
    <p style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:24px 0 6px 0;">Address</p>
    ${muted(escape(address || '—'))}
    ${button(`${ADMIN_URL}/#orders`, 'Open order')}
  `;
  return {
    subject: cleanHeader(`NEW ODORSTRIKE ORDER — ${cleanOrderId}`),
    html: shell(inner, `New order ${cleanOrderId} · ₹${rupee(amount)} · ${paymentMethod || ''}`),
    text: textBlock([
      'SMELLOFF OPS — NEW ORDER',
      '',
      `Order ID: ${cleanOrderId}`,
      `Customer: ${customerName || '—'}`,
      `Phone: ${phone || '—'}`,
      `Email: ${email || '—'}`,
      `Payment: ${paymentMethod || '—'}`,
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
      `Open order: ${ADMIN_URL}/#orders`,
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
    ${hero('Payment verified')}
    ${panel(summaryTable(`
      ${kvRow('Order ID', escape(cleanOrderId))}
      ${kvRow('Amount', `&#8377;${escape(rupee(amount))}`, true)}
      ${kvRow('Customer', escape(customerName || '—'))}
      ${kvRow('Payment method', escape(paymentMethod || 'Prepaid'))}
      ${transactionRef ? kvRow('Transaction', escape(transactionRef)) : ''}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
    ${button(`${ADMIN_URL}/#orders`, 'Open order')}
  `;
  return {
    subject: cleanHeader(`PAYMENT VERIFIED — ${cleanOrderId}`),
    html: shell(inner, `Payment verified for ${cleanOrderId} · ₹${rupee(amount)}`),
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
      `Open order: ${ADMIN_URL}/#orders`,
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
    ${hero('Email delivery failure')}
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
    html: shell(inner, `Email failure: ${emailType} ${orderId}`),
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
    ${hero('Smelloff email system test')}
    ${panel(summaryTable(`
      ${kvRow('Status', '<span style="color:#B8FF57;">RESEND API → ACCEPTED</span>')}
      ${kvRow('Email ID', escape(emailId || 'pending'))}
      ${kvRow('Environment', escape(environment || 'production'))}
      ${kvRow('Timestamp', escape(timestamp || new Date().toISOString()))}
    `))}
  `;
  return {
    subject: cleanHeader('SMELLOFF EMAIL SYSTEM TEST'),
    html: shell(inner, 'Smelloff email system test — Resend API accepted.'),
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
    ${hero("You're in.")}
    ${para(`Hey ${escape(name)}. Welcome to Smelloff.`)}
    ${muted('ODORSTRIKE is a 50ml fabric-only odor reset spray. Not perfume. Not deodorant. One pocket-sized bottle for clothes — sweat, smoke, food, gym, day-two shirts.')}
    ${panel(`
      <p style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:0 0 8px 0;">ODORSTRIKE 50ml</p>
      <p style="margin:0;font-family:${HEADING_FONT};font-size:32px;font-weight:700;color:${GREEN};">&#8377;${PRICE} <span style="font-size:14px;color:${MUTED};text-decoration:line-through;font-weight:400;">&#8377;${MRP}</span></p>
    `)}
    ${button(SITE_URL, 'Shop now')}
    ${footerHelp()}
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
    ${hero('You left something.')}
    ${para(`${escape(name)}, your ODORSTRIKE is still in the cart.`)}
    ${panel(`
      <p style="font-family:${HEADING_FONT};font-size:18px;font-weight:700;color:${OFFWHITE};margin:0 0 6px 0;">${PRODUCT_NAME}</p>
      <p style="margin:0;color:${GREEN};font-size:24px;font-weight:700;">&#8377;${PRICE}</p>
    `)}
    ${button(productUrl, 'Finish order')}
    ${footerHelp()}
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
    ${hero('One step left.')}
    ${para(`${escape(name)}, order #${escape(cleanOrderId)} is reserved. Payment has not landed yet.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Amount due', `&#8377;${escape(rupee(amount))}`, true)}
    `))}
    ${button(trackUrl(cleanOrderId), 'Complete order')}
    ${footerHelp()}
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
    ${hero('Order cancelled.')}
    ${para(`${escape(name)}, ODORSTRIKE order #${escape(cleanOrderId)} has been cancelled.`)}
    ${reason ? panel(`<p style="margin:0;color:${OFFWHITE};font-size:14px;">${escape(reason)}</p>`) : ''}
    ${muted('If you already paid, the refund is in motion and usually lands in 5–7 business days. Cash on Delivery orders have nothing to reverse.')}
    ${button(SITE_URL, 'Shop again')}
    ${footerHelp()}
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
    ${hero('Refund on its way')}
    ${para(`${escape(name)}, we processed the refund for order #${escape(cleanOrderId)}.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Refund', `&#8377;${escape(rupee(amount))}`, true)}
      ${kvRow('Back to', escape(method))}
    `))}
    ${muted('It usually lands in 5–7 business days, depending on your bank. Same source as the original payment.')}
    ${footerHelp()}
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
    ${hero("Payment didn't land")}
    ${para(`${escape(name)}, the prepaid attempt for order #${escape(cleanOrderId)} did not complete.`)}
    ${panel(summaryTable(`
      ${kvRow('Order', `#${escape(cleanOrderId)}`)}
      ${kvRow('Amount', `&#8377;${escape(rupee(amount))}`, true)}
      ${kvRow('Status', 'Not charged')}
    `))}
    ${muted('Nothing was taken from your account. You can try UPI again, or switch to Cash on Delivery at checkout.')}
    ${button(retryUrl, 'Try again')}
    ${footerHelp()}
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
    ${hero("How's it working?")}
    ${para(`${escape(name)}, you've had ODORSTRIKE for a few days.`)}
    ${para('If it earned a place in your bag — gym, office, travel — a short review helps the next person decide. No pressure if it did not.')}
    ${button(reviewUrl, 'Leave a review')}
    ${muted(`Order #${escape(cleanOrderId)} · this is a one-time ask.`)}
    ${footerHelp()}
  `;
  return {
    subject: cleanHeader("How's ODORSTRIKE treating your clothes?"),
    html: shell(inner, 'Thirty seconds if it earned a review. One-time ask.'),
    text: textBlock([
      "SMELLOFF — HOW'S IT WORKING?",
      '',
      `${name}, you've had ODORSTRIKE for a few days.`,
      '',
      'If it earned a place in your bag, a short review helps the next person decide.',
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
