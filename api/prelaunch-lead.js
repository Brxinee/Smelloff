// /api/prelaunch-lead.js — Endpoint for SMELLOFF 22.09 Pre-Launch Campaign Lead Capture
import { checkRateLimit, clientIp, isAllowedOrigin } from './_security.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co')
  .trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const CAMPAIGN = 'SMELLOFF_22_09_2026';

export function normalizeWhatsAppNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && /^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(2)}`;
  return null;
}

export function isValidEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return false;
  const cleaned = rawEmail.trim().toLowerCase();
  if (cleaned.length < 5 || cleaned.length > 120) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned);
}

function getKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
}

// In-memory fallback for local development / unconfigured environments
const localMemoryLeads = new Map();

async function sb(path, options = {}) {
  const key = getKey();
  if (!key) throw new Error('Supabase key is not configured.');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(typeof data === 'string' ? data : (data?.message || data?.hint || data?.error || `Supabase ${res.status}`));
    err.status = res.status;
    throw err;
  }
  return { data, headers: res.headers };
}

async function sbLeadWrite(row) {
  const key = getKey();
  if (!key) {
    // Store in local memory map to allow seamless local testing
    localMemoryLeads.set(row.email, row);
    return;
  }
  const payload = JSON.stringify(row);
  // Emails are normalized to lowercase and the DB now has exact unique
  // indexes on email and WhatsApp, so this upsert is deterministic.
  await sb('prelaunch_leads?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: payload,
  });
}

async function countCampaignLeads() {
  const key = getKey();
  if (!key) {
    return localMemoryLeads.size;
  }
  const { headers } = await sb(`prelaunch_leads?select=id&campaign=eq.${encodeURIComponent(CAMPAIGN)}&limit=1`, {
    method: 'GET',
    headers: { Prefer: 'count=exact' },
  });
  const range = headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function checkThresholdStatus() {
  if (process.env.MOCK_THRESHOLD_REACHED === 'true') return true;
  if (!getKey()) return localMemoryLeads.size >= 1000;
  try {
    return (await countCampaignLeads()) >= 1000;
  } catch (err) {
    console.warn('[prelaunch-lead] Threshold query warning:', err.message);
    return false;
  }
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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = clientIp(req);
  if (!checkRateLimit(`pl-lead:${ip}`, 10, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many registration attempts. Please wait a moment.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.hp_field && String(body.hp_field).trim()) {
      return res.status(200).json({ success: true, message: "YOU'RE IN." });
    }

    const name = String(body.name || '').trim().slice(0, 100);
    const rawWhatsapp = String(body.whatsapp || body.phone || '').trim();
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const source = String(body.source || 'direct').trim().slice(0, 100);

    if (!name) return res.status(400).json({ error: 'Please enter your name.' });
    const whatsapp = normalizeWhatsAppNumber(rawWhatsapp);
    if (!whatsapp) return res.status(400).json({ error: 'Please enter a valid 10-digit Indian WhatsApp mobile number.' });
    if (!isValidEmail(rawEmail)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const leadRecord = {
      name,
      whatsapp,
      email: rawEmail,
      campaign: CAMPAIGN,
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
    return res.status(err.status || 500).json({
      success: false,
      error: 'We could not save your details. Please try again.',
    });
  }
}
