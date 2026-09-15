import { sendTransactionalEmail, getIdempotencyKey, getSenderConfig, isValidEmail, maskEmail } from './_email.js';
import { renderTemplate, formatAddress } from './email-templates.js';
import { BASE_PRODUCT } from '../shared/products-config.js';

const TERMINAL_CONFIRMED = new Set(['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered']);

function rupeesFromOrder(order) {
  if (order?.amount === 0 || order?.amount) return String(Math.round(Number(order.amount) / 100));
  return String(BASE_PRODUCT.price);
}

function quantityFromOrder(order) {
  const items = order?.items;
  if (Array.isArray(items) && items[0] && items[0].quantity) {
    const qty = Number(items[0].quantity);
    if (Number.isFinite(qty) && qty > 0) return qty;
  }
  return 1;
}

function customerNameFromOrder(order) {
  const addr = order?.address;
  if (addr && typeof addr === 'object' && addr.name) return String(addr.name).trim();
  if (typeof order?.name === 'string' && order.name.trim()) return order.name.trim();
  return 'there';
}

function paymentLabel(order) {
  const method = String(order?.payment_method || '').toLowerCase();
  if (method === 'cod') return 'Cash on Delivery';
  if (method === 'upi') return 'Prepaid (Razorpay)';
  if (method === 'prepaid' || method === 'razorpay') return 'Prepaid (Razorpay)';
  return order?.payment_method ? String(order.payment_method) : 'Prepaid (Razorpay)';
}

function isCod(order) {
  return String(order?.payment_method || '').toLowerCase() === 'cod';
}

function transactionRef(order) {
  return String(order?.upi_txn_id || order?.payment_attempt_id || order?.upi_ref || '').trim();
}

function trackingUrl(order) {
  if (order?.tracking_url) return String(order.tracking_url);
  const awb = order?.shiprocket_awb || order?.tracking_id;
  if (awb) return `https://www.shiprocket.co/tracking/${encodeURIComponent(String(awb))}`;
  return '';
}

export function orderEmailContext(order = {}) {
  const orderId = String(order.order_code || order.orderId || '').trim().toUpperCase();
  const address = formatAddress(order.address || '');
  const amount = rupeesFromOrder(order);
  const quantity = quantityFromOrder(order);
  const customerName = customerNameFromOrder(order);
  const paymentMethod = paymentLabel(order);
  const codFee = isCod(order)
    ? (order.cod_fee ? Math.round(Number(order.cod_fee) / 100) : BASE_PRODUCT.codFee)
    : 0;
  return {
    orderId,
    customerName,
    amount,
    address,
    paymentMethod,
    codFee,
    quantity,
    email: String(order.customer_email || '').trim().toLowerCase(),
    phone: String(order.customer_phone || '').replace(/\D/g, '').slice(-10),
    product: 'ODORSTRIKE 50ml',
    timestamp: order.created_at || order.payment_verified_at || new Date().toISOString(),
    paymentStatus: order.status || '',
    fulfillmentStatus: order.status || '',
    transactionRef: transactionRef(order),
    courier: order.shiprocket_courier || order.courier || '',
    trackingId: order.shiprocket_awb || order.tracking_id || '',
    trackingUrl: trackingUrl(order),
    status: order.status || '',
    payment_method: order.payment_method,
  };
}

async function sendRendered(type, to, data, { route, orderId, extraKey } = {}) {
  let rendered;
  try {
    rendered = renderTemplate(type, data);
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      errorCode: 'TEMPLATE_RENDER_ERROR',
      errorMessage: err?.message || 'Template rendering failed',
    };
  }
  return sendTransactionalEmail({
    type,
    orderId: orderId || data.orderId || '',
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: getIdempotencyKey(type, orderId || data.orderId, extraKey),
    originatingRoute: route || 'internal',
  });
}

export async function sendCustomerPaymentConfirmation(order, { route } = {}) {
  const ctx = orderEmailContext(order);
  if (!isValidEmail(ctx.email)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Order has no valid customer email' };
  }
  if (isCod(order)) {
    return { ok: true, skipped: true, reason: 'COD_NO_PAYMENT_EMAIL' };
  }
  return sendRendered('paymentConfirmation', ctx.email, {
    orderId: ctx.orderId,
    customerName: ctx.customerName,
    amount: ctx.amount,
    paymentMethod: ctx.paymentMethod,
    transactionRef: ctx.transactionRef,
  }, { route, orderId: ctx.orderId });
}

export async function sendAdminNewOrderEmail(order, { route } = {}) {
  const ctx = orderEmailContext(order);
  const sender = getSenderConfig();
  if (!isValidEmail(sender.adminNotify)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Admin notify email is not configured' };
  }
  return sendRendered('adminNewOrder', sender.adminNotify, {
    orderId: ctx.orderId,
    customerName: ctx.customerName,
    phone: ctx.phone,
    email: ctx.email,
    paymentMethod: ctx.paymentMethod,
    amount: ctx.amount,
    product: ctx.product,
    quantity: ctx.quantity,
    address: ctx.address,
    timestamp: ctx.timestamp,
    paymentStatus: isCod(order)
      ? 'COD — collect on delivery'
      : (TERMINAL_CONFIRMED.has(String(ctx.status).toLowerCase()) ? 'Paid' : String(ctx.status || 'pending')),
    fulfillmentStatus: ctx.fulfillmentStatus,
  }, { route, orderId: ctx.orderId });
}

export async function sendAdminPaymentConfirmedEmail(order, { route } = {}) {
  if (isCod(order)) return { ok: true, skipped: true, reason: 'COD_NO_PAYMENT_EMAIL' };
  const ctx = orderEmailContext(order);
  const sender = getSenderConfig();
  if (!isValidEmail(sender.adminNotify)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Admin notify email is not configured' };
  }
  return sendRendered('adminPaymentConfirmed', sender.adminNotify, {
    orderId: ctx.orderId,
    amount: ctx.amount,
    customerName: ctx.customerName,
    paymentMethod: ctx.paymentMethod,
    transactionRef: ctx.transactionRef,
    timestamp: order.payment_verified_at || new Date().toISOString(),
  }, { route, orderId: ctx.orderId });
}

export async function sendFulfillmentEmail(order, status, { route } = {}) {
  const ctx = orderEmailContext(order);
  if (!isValidEmail(ctx.email)) {
    return { ok: false, errorCode: 'INVALID_RECIPIENT', errorMessage: 'Order has no valid customer email' };
  }
  const mapped = {
    dispatched: 'orderShipped',
    orderShipped: 'orderShipped',
    shipped: 'orderShipped',
    out_for_delivery: 'outForDelivery',
    delivered: 'orderDelivered',
  }[String(status || '').toLowerCase()];
  if (!mapped) return { ok: true, skipped: true, reason: 'NO_FULFILLMENT_EMAIL' };

  const data = {
    orderId: ctx.orderId,
    customerName: ctx.customerName,
    trackingId: ctx.trackingId,
    courier: ctx.courier,
    trackingUrl: ctx.trackingUrl,
  };
  return sendRendered(mapped, ctx.email, data, { route, orderId: ctx.orderId });
}

async function sendClaimedOrderConfirmation(order, { route } = {}) {
  const { sendOrderConfirmationForOrder } = await import('./send-email.js');
  return sendOrderConfirmationForOrder(order, { route });
}

export async function dispatchCodPlacementEmails(order, { route } = {}) {
  const confirmation = await sendClaimedOrderConfirmation(order, { route });
  const admin = await sendAdminNewOrderEmail(order, { route });
  return { confirmation, admin };
}

export async function dispatchPrepaidPaymentEmails(order, { route } = {}) {
  const payment = await sendCustomerPaymentConfirmation(order, { route });
  const confirmation = await sendClaimedOrderConfirmation(order, { route });
  const adminNew = await sendAdminNewOrderEmail(order, { route });
  const adminPaid = await sendAdminPaymentConfirmedEmail(order, { route });
  return { payment, confirmation, adminNew, adminPaid };
}

export { maskEmail };
