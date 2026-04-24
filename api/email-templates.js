// Email templates for ODORSTRIKE / Smelloff
// All CSS inlined for email client compatibility
// Brand: matte black #080808, acid green #B8FF57

const BLACK = '#080808';
const GREEN = '#B8FF57';
const WHITE = '#FFFFFF';
const GREY = '#9A9A9A';
const BORDER = '#1F1F1F';

const HEADING_FONT = `'Barlow Condensed', 'Arial Black', Impact, sans-serif`;
const BODY_FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

const SUPPORT_EMAIL = 'smelloffsupport@gmail.com';
const SITE_URL = 'https://www.smelloff.in';

const escape = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const shell = (inner, preheader = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>ODORSTRIKE</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${BLACK};font-family:${BODY_FONT};color:${WHITE};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLACK};">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${BLACK};border:1px solid ${BORDER};">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid ${BORDER};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;font-family:${HEADING_FONT};font-weight:900;font-size:28px;letter-spacing:3px;color:${WHITE};text-transform:uppercase;line-height:1;">
                  <a href="${SITE_URL}" style="color:${WHITE};text-decoration:none;">SMELLOFF</a><span style="display:inline-block;width:8px;height:8px;background-color:${GREEN};border-radius:50%;vertical-align:top;margin-left:4px;margin-top:2px;">&nbsp;</span>
                </td>
                <td align="right" style="vertical-align:middle;font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;">
                  ODORSTRIKE
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            ${inner}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;border-top:1px solid ${BORDER};font-family:${BODY_FONT};font-size:12px;color:${GREY};line-height:1.6;">
            <p style="margin:0 0 8px 0;">Smelloff &middot; Hyderabad, India</p>
            <p style="margin:0 0 8px 0;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${GREEN};text-decoration:none;">${SUPPORT_EMAIL}</a></p>
            <p style="margin:0;">
              <a href="${SITE_URL}" style="color:${GREY};text-decoration:none;">smelloff.in</a>
              &nbsp;&middot;&nbsp;
              <a href="https://instagram.com/smell0ff" style="color:${GREY};text-decoration:none;">@smell0ff</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="font-family:${BODY_FONT};font-size:10px;color:${GREY};margin:16px 0 0 0;letter-spacing:1px;text-transform:uppercase;">
        Pocket-sized odor killer for your clothes
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

const heading = (text) =>
  `<h1 style="font-family:${HEADING_FONT};font-weight:900;font-size:42px;line-height:1;letter-spacing:-0.5px;color:${WHITE};text-transform:uppercase;margin:0 0 20px 0;">${text}</h1>`;

const para = (text) =>
  `<p style="font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${WHITE};margin:0 0 16px 0;">${text}</p>`;

const mutedPara = (text) =>
  `<p style="font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:${GREY};margin:0 0 16px 0;">${text}</p>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${GREEN};">
      <a href="${href}" style="display:inline-block;padding:16px 32px;font-family:${HEADING_FONT};font-weight:900;font-size:16px;letter-spacing:2px;color:${BLACK};text-decoration:none;text-transform:uppercase;">
        ${label} &rarr;
      </a>
    </td>
  </tr>
</table>`;

const divider = `<div style="height:1px;background-color:${BORDER};margin:24px 0;"></div>`;

const accentBar = `<div style="width:48px;height:3px;background-color:${GREEN};margin:0 0 20px 0;"></div>`;

// ---------- TEMPLATES ----------

export function orderConfirmation({
  orderId = '',
  customerName = 'there',
  amount = '',
  address = '',
  paymentMethod = '',
} = {}) {
  const inner = `
    ${accentBar}
    ${heading('Order<br>Confirmed.')}
    ${para(`Hey ${escape(customerName)}, your ODORSTRIKE is locked in. We&rsquo;re packing it now.`)}

    <div style="background-color:#0F0F0F;border-left:3px solid ${GREEN};padding:20px 24px;margin:24px 0;">
      <p style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px 0;">Order ID</p>
      <p style="font-family:${HEADING_FONT};font-weight:900;font-size:22px;color:${WHITE};letter-spacing:1px;margin:0 0 16px 0;">#${escape(orderId)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${BODY_FONT};font-size:13px;color:${GREY};padding:4px 0;">Product</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${WHITE};padding:4px 0;">ODORSTRIKE 50ml</td>
        </tr>
        <tr>
          <td style="font-family:${BODY_FONT};font-size:13px;color:${GREY};padding:4px 0;">Amount</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${WHITE};padding:4px 0;">&#8377;${escape(amount)}</td>
        </tr>
        <tr>
          <td style="font-family:${BODY_FONT};font-size:13px;color:${GREY};padding:4px 0;">Payment</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${WHITE};padding:4px 0;">${escape(paymentMethod)}</td>
        </tr>
      </table>
    </div>

    <p style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;margin:24px 0 6px 0;">Shipping To</p>
    ${mutedPara(escape(address).replace(/\n/g, '<br>'))}

    ${divider}

    <p style="font-family:${HEADING_FONT};font-weight:900;font-size:18px;letter-spacing:1px;color:${GREEN};text-transform:uppercase;margin:0 0 8px 0;">What happens next</p>
    ${mutedPara('Dispatch in 24&ndash;48 hours. Tracking link lands in your inbox the moment it ships.')}
    ${mutedPara('Need help? Just reply to this email or write to <a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + GREEN + ';text-decoration:none;">' + SUPPORT_EMAIL + '</a>.')}
  `;
  return {
    subject: `Order confirmed — #${orderId}`,
    html: shell(inner, `Your ODORSTRIKE order #${orderId} is confirmed.`),
  };
}

export function orderShipped({
  orderId = '',
  customerName = 'there',
  trackingId = '',
  courier = '',
  trackingUrl = '#',
} = {}) {
  const inner = `
    ${accentBar}
    ${heading('It&rsquo;s on<br>the way.')}
    ${para(`${escape(customerName)}, your ODORSTRIKE just left the warehouse.`)}

    <div style="background-color:#0F0F0F;border-left:3px solid ${GREEN};padding:20px 24px;margin:24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;padding:4px 0;">Order</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${WHITE};padding:4px 0;">#${escape(orderId)}</td>
        </tr>
        <tr>
          <td style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;padding:4px 0;">Courier</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${WHITE};padding:4px 0;">${escape(courier)}</td>
        </tr>
        <tr>
          <td style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:1.5px;text-transform:uppercase;padding:4px 0;">Tracking</td>
          <td align="right" style="font-family:${BODY_FONT};font-size:13px;color:${GREEN};padding:4px 0;letter-spacing:1px;">${escape(trackingId)}</td>
        </tr>
      </table>
    </div>

    ${button(trackingUrl, 'Track Package')}

    ${divider}
    ${mutedPara('Heads up: on delivery, one spritz on your shirt collar before stepping out. That&rsquo;s the move.')}
    ${mutedPara('Questions? <a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + GREEN + ';text-decoration:none;">' + SUPPORT_EMAIL + '</a>')}
  `;
  return {
    subject: `Your ODORSTRIKE is on the way — #${orderId}`,
    html: shell(inner, `Tracking: ${trackingId} via ${courier}`),
  };
}

export function welcomeEmail({ customerName = 'there' } = {}) {
  const inner = `
    ${accentBar}
    ${heading('You&rsquo;re in.')}
    ${para(`Hey ${escape(customerName)}. Welcome to Smelloff.`)}

    <p style="font-family:${HEADING_FONT};font-weight:900;font-size:26px;line-height:1.15;color:${WHITE};margin:32px 0 16px 0;letter-spacing:-0.3px;">
      People don&rsquo;t fear smelling bad.<br>
      <span style="color:${GREEN};">They fear others noticing.</span>
    </p>

    ${mutedPara('ODORSTRIKE is a 50ml fabric-only odor killer. Not perfume. Not deodorant. One pocket-sized spray that neutralizes smell on clothes &mdash; sweat, smoke, food, gym, day-two shirts.')}

    <div style="background-color:#0F0F0F;border:1px solid ${BORDER};padding:24px;margin:24px 0;text-align:center;">
      <p style="font-family:${BODY_FONT};font-size:11px;color:${GREY};letter-spacing:2px;text-transform:uppercase;margin:0 0 8px 0;">ODORSTRIKE 50ml</p>
      <p style="font-family:${HEADING_FONT};font-weight:900;font-size:48px;color:${GREEN};margin:0 0 4px 0;letter-spacing:-1px;">&#8377;179</p>
      <p style="font-family:${BODY_FONT};font-size:12px;color:${GREY};margin:0;">Free shipping above &#8377;299 &middot; COD available</p>
    </div>

    ${button(SITE_URL, 'Shop Now')}

    ${divider}
    ${mutedPara('Built in Hyderabad. Shipped pan-India. Questions? Just reply to this email or write to <a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + GREEN + ';text-decoration:none;">' + SUPPORT_EMAIL + '</a>.')}
  `;
  return {
    subject: 'Welcome to Smelloff',
    html: shell(inner, 'Pocket-sized odor killer for your clothes.'),
  };
}

export function abandonedCart({
  customerName = 'there',
  productUrl = SITE_URL,
} = {}) {
  const inner = `
    ${accentBar}
    ${heading('You left<br>something.')}
    ${para(`${escape(customerName)}, your ODORSTRIKE is still in the cart.`)}

    ${mutedPara('50ml. Fabric-only. Kills odor on contact. No perfume cover-up. One spray and you&rsquo;re out the door.')}

    <div style="background-color:#0F0F0F;border-left:3px solid ${GREEN};padding:20px 24px;margin:24px 0;">
      <p style="font-family:${HEADING_FONT};font-weight:900;font-size:20px;color:${WHITE};text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0;">ODORSTRIKE 50ml</p>
      <p style="font-family:${BODY_FONT};font-size:13px;color:${GREY};margin:0 0 12px 0;">Pocket-sized odor killer for your clothes</p>
      <p style="font-family:${HEADING_FONT};font-weight:900;font-size:28px;color:${GREEN};margin:0;letter-spacing:-0.5px;">&#8377;179</p>
    </div>

    ${button(productUrl, 'Finish Order')}

    ${divider}
    ${mutedPara('Need a hand? Reply to this email or write to <a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + GREEN + ';text-decoration:none;">' + SUPPORT_EMAIL + '</a>.')}
  `;
  return {
    subject: 'You left something behind.',
    html: shell(inner, 'Your ODORSTRIKE is still in the cart.'),
  };
}
