// /api/prelaunch-lead.js — Endpoint for SMELLOFF 22.09 Pre-Launch Campaign Lead Capture
import crypto from 'node:crypto';
import { checkRateLimit, clientIp, isAllowedOrigin } from './_security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';

/**
 * Normalizes Indian WhatsApp mobile numbers.
 * Accepts formats: 9876543210, +919876543210, 919876543210, 09876543210
 * Returns standard e164 +919876543210 or null if invalid.
 */
export function normalizeWhatsAppNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  // Remove all non-numeric characters except leading '+'
  const cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (!digits) return null;

  // 10 digits starting with 6, 7, 8, or 9
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  // 11 digits starting with 0 followed by 6-9
  if (digits.length === 11 && /^0[6-9]\d{9}$/.test(digits)) {
    return `+91${digits.slice(1)}`;
  }

  // 12 digits starting with 91 followed by 6-9
  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) {
    return `+91${digits.slice(2)}`;
  }

  return null;
}

/**
 * Validates email format.
 */
export function isValidEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return false;
  const cleaned = rawEmail.trim().toLowerCase();
  if (cleaned.length < 5 || cleaned.length > 120) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned);
}

async function sbLeadWrite(row) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.warn('[prelaunch-lead] Supabase key not set. Skipping DB persist.');
    return;
  }

  // Attempt write to prelaunch_leads table with on_conflict merge
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/prelaunch_leads?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[prelaunch-lead] Supabase prelaunch_leads write error (${res.status}): ${errText}`);

      // Fallback: write to standard waitlist table if prelaunch_leads table does not exist
      await fetch(`${SUPABASE_URL}/rest/v1/waitlist?on_conflict=email`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          email: row.email,
          source: `prelaunch_2209:${row.whatsapp}`,
        }),
      });
    }
  } catch (err) {
    console.error('[prelaunch-lead] DB Write failed:', err.message);
  }
}

export async function checkThresholdStatus() {
  if (process.env.MOCK_THRESHOLD_REACHED === 'true') {
    return true;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/prelaunch_leads?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
      },
    });

    if (res.ok) {
      const contentRange = res.headers.get('content-range');
      if (contentRange) {
        const parts = contentRange.split('/');
        if (parts.length === 2) {
          const count = parseInt(parts[1], 10);
          if (!isNaN(count) && count >= 1000) {
            return true;
          }
        }
      }
    }
  } catch (err) {
    console.error('[prelaunch-lead] Threshold query error:', err.message);
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) return res.status(403).end();
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const isDevTest = req.query?.test_threshold === '1' && process.env.NODE_ENV !== 'production';
    const thresholdReached = isDevTest || await checkThresholdStatus();
    return res.status(200).json({ threshold_reached: thresholdReached });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`pl-lead:${ip}`, 10, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many registration attempts. Please wait a moment.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Honeypot bot protection check
    if (body.hp_field && String(body.hp_field).trim().length > 0) {
      // Quietly return success to bots without recording
      return res.status(200).json({ success: true, message: "YOU'RE IN." });
    }

    const name = String(body.name || '').trim().slice(0, 100);
    const rawWhatsapp = String(body.whatsapp || body.phone || '').trim();
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const source = String(body.source || 'direct').trim().slice(0, 100);
    const campaign = 'SMELLOFF_22_09_2026';

    if (!name) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }

    const whatsapp = normalizeWhatsAppNumber(rawWhatsapp);
    if (!whatsapp) {
      return res.status(400).json({
        error: 'Please enter a valid 10-digit Indian WhatsApp mobile number.',
      });
    }

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const leadRecord = {
      name,
      whatsapp,
      email: rawEmail,
      campaign,
      source,
      consent_agreed: true,
      consent_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 250),
      ip_address: ip,
    };

    await sbLeadWrite(leadRecord);

    const thresholdReached = await checkThresholdStatus();

    return res.status(200).json({
      success: true,
      message: "YOU'RE IN.",
      date: '22.09.2026',
      threshold_reached: thresholdReached,
    });
  } catch (err) {
    console.error('[prelaunch-lead] Handler error:', err);
    // Still return graceful status if unexpected error occurs
    return res.status(200).json({
      success: true,
      message: "YOU'RE IN.",
      date: '22.09.2026',
      threshold_reached: false,
    });
  }
}
