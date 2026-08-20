import crypto from 'node:crypto';
import { calculateOrderTotal, BASE_PRODUCT } from '../shared/products-config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ALLOWED_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_ENV !== 'production') {
    if (origin.endsWith('.vercel.app') || origin.endsWith('.run.app') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  }
  return false;
}

function genOrderCode() {
  const d = new Date();
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(crypto.randomInt(1000, 10000));
  return `SMF-${yyyymmdd}-${rand}`;
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const quantity = Math.max(1, Math.min(20, parseInt(body.quantity, 10) || 1));
    const paymentMethod = String(body.paymentMethod || 'prepaid').toLowerCase();
    const isCod = paymentMethod === 'cod';

    const customer = body.customer || {};
    const name = String(customer.name || '').trim().slice(0, 100);
    const phone = String(customer.phone || '').trim().slice(0, 20);
    const email = String(customer.email || '').trim().toLowerCase().slice(0, 120);
    const address = String(customer.address || '').trim().slice(0, 300);
    const city = String(customer.city || '').trim().slice(0, 100);
    const state = String(customer.state || '').trim().slice(0, 100);
    const pincode = String(customer.pincode || '').replace(/\D/g, '').slice(0, 6);

    if (!phone || phone.replace(/\D/g, '').length < 10) {
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

    // Authoritative pricing calculation
    const pricing = calculateOrderTotal(quantity, isCod ? 'cod' : 'prepaid');
    const orderCode = genOrderCode();

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
      payment_method: isCod ? 'cod' : 'razorpay',
      status: isCod ? 'placed' : 'placed',
      created_at: new Date().toISOString()
    };

    // Save order into Supabase
    const dbOrder = await createSupabaseOrderRecord(orderRow);

    // If COD, return confirmation immediately
    if (isCod) {
      return res.status(200).json({
        ok: true,
        orderId: orderCode,
        status: 'placed',
        method: 'cod',
        amount: pricing.total,
        amountPaise: pricing.amountPaise,
        currency: 'INR',
        dbId: dbOrder ? dbOrder.id : null
      });
    }

    // Prepaid / Razorpay Flow
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      // Create Razorpay order via API
      try {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: pricing.amountPaise,
            currency: 'INR',
            receipt: orderCode,
            notes: {
              order_code: orderCode,
              customer_phone: phone,
              customer_name: name,
              quantity: String(pricing.qty)
            }
          })
        });

        if (rzpRes.ok) {
          const rzpOrder = await rzpRes.json();
          return res.status(200).json({
            ok: true,
            orderId: orderCode,
            razorpayOrderId: rzpOrder.id,
            keyId,
            amount: pricing.total,
            amountPaise: pricing.amountPaise,
            currency: 'INR',
            customer: { name, phone, email },
            method: 'razorpay'
          });
        } else {
          const errTxt = await rzpRes.text().catch(() => '');
          console.error('[create-order] Razorpay order creation failed:', rzpRes.status, errTxt);
        }
      } catch (rzpErr) {
        console.error('[create-order] Razorpay fetch exception:', rzpErr.message);
      }
    }

    // Fallback: If Razorpay keys are not yet configured in env, return structured order for direct payment
    return res.status(200).json({
      ok: true,
      orderId: orderCode,
      amount: pricing.total,
      amountPaise: pricing.amountPaise,
      currency: 'INR',
      fallbackUpi: true,
      method: 'prepaid',
      customer: { name, phone, email }
    });

  } catch (err) {
    console.error('[create-order] Internal error:', err);
    return res.status(500).json({ error: 'Failed to create order. Please try again.' });
  }
}
