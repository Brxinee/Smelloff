// Minimal Razorpay REST client on fetch().
// The `razorpay` npm SDK sends requests through axios, which fails inside the
// Cloudflare Worker before any response arrives; the SDK's error handler then
// reads `err.response.status` and throws "Cannot read properties of undefined
// (reading 'status')", so every prepaid checkout died at order creation.

const API_BASE = 'https://api.razorpay.com/v1';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay credentials are not configured.');
    error.statusCode = 500;
    throw error;
  }
  return { keyId, keySecret };
}

async function request(method, path, body) {
  const { keyId, keySecret } = credentials();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    const error = new Error('Payment gateway is unreachable. Please try again.');
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = data?.error?.description || `Razorpay returned HTTP ${response.status}`;
    console.error('[razorpay]', method, path, response.status, description);
    const error = new Error(description);
    error.statusCode = 502;
    error.razorpayStatus = response.status;
    throw error;
  }
  return data;
}

export function createRazorpayOrder(payload) {
  return request('POST', '/orders', payload);
}

export function fetchRazorpayPayment(paymentId) {
  return request('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export function fetchRazorpayOrderPayments(orderId) {
  return request('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
}
