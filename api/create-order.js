import crypto from 'node:crypto';
import { calculateOrderTotal, BASE_PRODUCT } from '../shared/products-config.js';
import { Resend } from 'resend';
import { orderConfirmation } from './email-templates.js';
import { isAllowedOrigin, clientIp, checkRateLimit, generateOrderToken } from './_security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

// Generates unique, non-colliding order code
function genOrderCode() {
  const d = new Date();
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(crypto.randomInt(1000, 10000));
  return `SMF-${yyyymmdd}-${rand}`;
}

// Supabase persistence with service role
async function createSupabaseOrderRecord(orderData) {
  if (!SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      console.error('[create-order] Supabase insert failed:', res.status, errTxt);
      return null;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[create-order] Supabase error:', err.message);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Idempotency-Key');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`create-order:${ip}`, 15, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many order creation attempts. Please slow down.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    
    // Server-enforced quantity validation (bounded [1..5])
    const rawQty = parseInt(body.quantity, 10);
    const quantity = (isNaN(rawQty) || rawQty < 1) ? 1 : Math.min(rawQty, BASE_PRODUCT.maxQuantity);
    
    const paymentMethod = String(body.paymentMethod || 'upi').toLowerCase();
    const isCod = paymentMethod === 'cod';

    const customer = body.customer || {};
    const name = String(customer.name || '').trim().slice(0, 100);
    const phone = String(customer.phone || '').trim().replace(/\D/g, '').slice(0, 10);
    const email = String(customer.email || '').trim().toLowerCase().slice(0, 120);
    const address = String(customer.address || '').trim().slice(0, 300);
    const city = String(customer.city || '').trim().slice(0, 100);
    const state = String(customer.state || '').trim().slice(0, 100);
    const pincode = String(customer.pincode || '').replace(/\D/g, '').slice(0, 6);

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Customer name required' });
    }
    if (!address || address.length < 5) {
      return res.status(400).json({ error: 'Delivery address required' });
    }
    if (!pincode || pincode.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit PIN code required' });
    }

    // Authoritative pricing and status calculation
    const pricing = calculateOrderTotal(quantity, isCod ? 'cod' : 'upi');
    
    // Idempotent order code generation
    const orderCode = body.orderCode && /^SMF-\d{8}-\d{4}$/.test(body.orderCode) 
      ? body.orderCode 
      : genOrderCode();

    const orderToken = generateOrderToken(orderCode, phone);

    const orderRow = {
      order_code: orderCode,
      customer_phone: phone,
      customer_email: email || null,
      address: {
        name,
        line: address,
        city,
        state,
        pincode
      },
      items: [
        {
          sku: pricing.sku,
          name: pricing.title,
          quantity: pricing.qty,
          unit_price: pricing.unitPrice,
          total_price: pricing.subtotal
        }
      ],
      amount: pricing.amountPaise, // amount in paise
      cod_fee: isCod ? pricing.codFee * 100 : 0,
      payment_method: isCod ? 'cod' : 'upi',
      status: pricing.status, // 'placed' for COD, 'upi_pending' for prepaid UPI
      created_at: new Date().toISOString()
    };

    // Save order into Supabase
    const dbOrder = await createSupabaseOrderRecord(orderRow);

    // Send confirmation email for COD immediately if email is provided
    if (isCod && email && process.env.RESEND_API_KEY) {
      try {
        const { subject, html } = orderConfirmation({
          orderId: orderCode,
          customerName: name || 'there',
          amount: String(pricing.total),
          codFee: pricing.codFee,
          address: [address, city, state, pincode].filter(Boolean).join(', '),
          paymentMethod: 'Cash on Delivery'
        });
        const resend = new Resend(process.env.RESEND_API_KEY);
        resend.emails.send({
          from: FROM,
          to: email,
          replyTo: REPLY_TO,
          subject,
          html
        }).catch(e => console.error('[create-order] Email send error:', e.message));
      } catch (emailErr) {
        console.error('[create-order] Email formatting exception:', emailErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      orderToken,
      status: pricing.status,
      method: isCod ? 'cod' : 'upi',
      quantity: pricing.qty,
      unitPrice: pricing.unitPrice,
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      codFee: pricing.codFee,
      total: pricing.total,
      amountPaise: pricing.amountPaise,
      currency: pricing.currency,
      dbId: dbOrder ? dbOrder.id : null,
      customer: { name, phone, email }
    });

  } catch (err) {
    console.error('[create-order] Internal error:', err);
    return res.status(500).json({ error: 'Failed to create order. Please try again.' });
  }
}
