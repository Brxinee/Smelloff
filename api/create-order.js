import Razorpay from 'razorpay';
import { isAllowedOrigin } from './_security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const UNIT_PRICE_RUPEES = 229;
const COD_FEE_RUPEES = 60;

function razorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials are not configured.');
    error.statusCode = 500;
    throw error;
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

async function persistRazorpayOrderId(orderCode, razorpayOrderId) {
  if (!SERVICE_KEY || !orderCode || !razorpayOrderId) return false;
  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_attempt_id: razorpayOrderId,
          updated_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    return response.ok;
  } catch (err) {
    console.error('[api/create-order] Error persisting Razorpay order mapping:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Powered-By', 'Smelloff');

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    
    // Validate SKU & Quantity (Server-Authoritative)
    const items = Array.isArray(body.items) ? body.items : [];
    const firstItem = items[0] || {};
    const quantity = Number(firstItem.quantity || body.quantity || 1);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'Quantity must be an integer between 1 and 10.' });
    }

    const paymentMethod = String(body.payment_method || '').toLowerCase() === 'cod' ? 'cod' : 'upi';

    // Server-Authoritative Total Calculation
    const subtotalRupees = UNIT_PRICE_RUPEES * quantity;
    const codFeeRupees = paymentMethod === 'cod' ? COD_FEE_RUPEES : 0;
    const totalRupees = subtotalRupees + codFeeRupees;
    const expectedAmountPaise = totalRupees * 100;

    // Reject amount tampering if client provided an explicit amount
    const clientAmount = body.amount !== undefined ? Number(body.amount) : expectedAmountPaise;
    if (!Number.isSafeInteger(clientAmount) || clientAmount < 100) {
      return res.status(400).json({ error: 'Amount must be an integer of at least 100 paise.' });
    }
    
    // Accept client amount if it matches expected total, or base subtotal for COD
    const isValidAmount = clientAmount === expectedAmountPaise ||
      (paymentMethod === 'cod' && clientAmount === subtotalRupees * 100);

    if (!isValidAmount) {
      return res.status(400).json({ error: 'Order amount mismatch. Please refresh and try again.' });
    }

    // Standardized payload with authoritative calculations
    const sanitizedPayload = {
      ...body,
      items: [{
        name: 'ODORSTRIKE Fabric Mist',
        variant: firstItem.variant || '50ml',
        quantity,
        price: UNIT_PRICE_RUPEES
      }],
      amount: expectedAmountPaise,
      payment_method: paymentMethod
    };

    if (paymentMethod === 'cod') {
      const target = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-order`;
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : {}),
        },
        body: JSON.stringify(sanitizedPayload),
        signal: AbortSignal.timeout(15000),
      });
      const text = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      return res.end(text);
    }

    // Prepaid / UPI Flow
    const target = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-order`;
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : {}),
      },
      body: JSON.stringify(sanitizedPayload),
      signal: AbortSignal.timeout(15000),
    });
    const upstreamText = await upstream.text();
    let upstreamData = {};
    try { upstreamData = JSON.parse(upstreamText); } catch { /* handled below */ }

    if (!upstream.ok) {
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      return res.end(upstreamText);
    }

    const orderCode = String(upstreamData.order_code || '').trim().toUpperCase();
    if (!orderCode) return res.status(502).json({ error: 'Order service returned no order code.' });

    const razorpay = razorpayClient();
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: expectedAmountPaise,
        currency: 'INR',
        receipt: orderCode,
      });
    } catch (error) {
      const status = Number(error?.statusCode || error?.status || 500);
      console.error('[api/create-order] Razorpay order creation failed:', error?.message || error);
      if (status === 401 || status === 400) {
        return res.status(401).json({ error: 'Razorpay authentication failed. Check the server credentials.' });
      }
      return res.status(500).json({ error: 'Unable to create the Razorpay payment order. Please try again.' });
    }

    if (!razorpayOrder?.id || Number(razorpayOrder.amount) !== expectedAmountPaise || razorpayOrder.currency !== 'INR') {
      return res.status(502).json({ error: 'Razorpay returned an invalid order response.' });
    }

    if (!await persistRazorpayOrderId(orderCode, razorpayOrder.id)) {
      console.error('[api/create-order] Failed to persist Razorpay order mapping for', orderCode);
      return res.status(500).json({ error: 'Payment order was created but could not be linked to your order. Please try again.' });
    }

    return res.status(200).json({
      id: upstreamData.id,
      order_code: orderCode,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('[api/create-order] error:', error?.message || error);
    return res.status(500).json({ error: 'Order service unavailable. Please try again.' });
  }
}
