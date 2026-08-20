import { Resend } from 'resend';
import { orderConfirmation } from '../email-templates.js';
import { isAdminAuthorized, validateAndNormalizeUtr } from '../_security.js';
import { isValidTransition } from '../../shared/products-config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FROM = 'ODORSTRIKE <orders@smelloff.in>';
const REPLY_TO = 'smelloffsupport@gmail.com';

async function fetchOrderByCode(orderCode) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[admin-verify] Supabase fetch error:', err.message);
    return null;
  }
}

async function checkUtrConflict(utr, currentOrderCode) {
  if (!SERVICE_KEY || !utr) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?upi_ref=eq.${encodeURIComponent(utr)}&order_code=neq.${encodeURIComponent(currentOrderCode)}&status=in.(confirmed,verification_pending)&select=order_code`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function listPendingVerificationOrders() {
  if (!SERVICE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?status=in.(verification_pending,upi_pending)&order=created_at.desc&limit=100`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!res.ok) return [];
    return await res.json().catch(() => []);
  } catch (err) {
    console.error('[admin-verify] List pending error:', err.message);
    return [];
  }
}

async function updateSupabaseOrderStatus(orderCode, status, upiRef) {
  if (!SERVICE_KEY || !orderCode) return null;
  try {
    const patchBody = {
      status,
      updated_at: new Date().toISOString()
    };
    if (upiRef) patchBody.upi_ref = upiRef;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) {
      console.error('[admin-verify] Supabase update failed:', res.status);
      return null;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (err) {
    console.error('[admin-verify] Supabase patch error:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Admin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
    return res.status(204).end();
  }

  return res.status(410).json({
    error: 'Manual UTR admin approval is deprecated and disabled. All UPI payments are verified automatically via merchant status integration.'
  });
}

