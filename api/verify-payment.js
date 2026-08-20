import crypto from 'node:crypto';
import { Resend } from 'resend';
import { orderConfirmation } from './email-templates.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

const ALLOWED_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_ENV !== 'production') {
    if (origin.endsWith('.vercel.app') || origin.endsWith('.run.app') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  }
  return false;
}

async function updateSupabaseOrder(orderCode, paymentId, rzpOrderId) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        status: 'confirmed',
        upi_ref: paymentId || rzpOrderId,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      console.error('[verify-payment] Supabase update failed:', res.status);
      return null;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[verify-payment] Supabase patch error:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const {
      orderCode,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerEmail,
      customerName,
      amount,
      address
    } = body;

    if (!orderCode) {
      return res.status(400).json({ error: 'Order reference required' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Cryptographic signature verification if Razorpay secret is set
    if (keySecret && razorpay_order_id && razorpay_payment_id) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.error('[verify-payment] Signature mismatch for order:', orderCode);
        return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      }
    }

    // Update order status idempotently to 'confirmed'
    const updatedOrder = await updateSupabaseOrder(orderCode, razorpay_payment_id, razorpay_order_id);

    // Send confirmation email asynchronously if email is present
    if (process.env.RESEND_API_KEY && customerEmail) {
      try {
        const { subject, html } = orderConfirmation({
          orderId: orderCode,
          customerName: customerName || 'there',
          amount: String(amount || 229),
          address: typeof address === 'string' ? address : [address?.line, address?.city, address?.state, address?.pincode].filter(Boolean).join(', '),
          paymentMethod: 'Prepaid (Razorpay / Online UPI)'
        });
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: FROM,
          to: customerEmail,
          replyTo: REPLY_TO,
          subject,
          html
        }).catch(e => console.error('[verify-payment] Resend email send error:', e.message));
      } catch (emailErr) {
        console.error('[verify-payment] Email exception:', emailErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      verified: true,
      orderId: orderCode,
      paymentId: razorpay_payment_id || null,
      status: 'confirmed'
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return res.status(500).json({ error: 'Internal verification error.' });
  }
}
