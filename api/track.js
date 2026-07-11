// /api/track — first-party, cookieless pageview beacon.
//
// The browser sends only { p: pathname, r: referrer }. Everything else is
// derived server-side: device from the User-Agent, country from Vercel's geo
// header, and an anonymous `visitor` id that is a DAILY-ROTATING one-way hash of
// (date + ip + ua + secret salt). The raw IP is never stored — only the hash —
// so there is no cookie, no client storage, and no PII at rest. This is the
// privacy-first analytics model (à la Plausible), which is why it needs no
// consent banner. Rows go into public.page_views via the service role.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (required), SUPABASE_URL (optional),
//      ANALYTICS_SALT (optional — else derived from the service-role key).

import crypto from 'node:crypto';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|preview|monitor|lighthouse|headless|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http/i;

function deviceFrom(ua) {
  if (!ua) return 'other';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(ua)) return 'mobile';
  if (/windows|macintosh|linux|cros|x11/i.test(ua)) return 'desktop';
  return 'other';
}

function refHost(referrer, selfHost) {
  if (!referrer || typeof referrer !== 'string') return null;
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === selfHost || h.endsWith('smelloff.in')) return null; // internal nav
    return h.slice(0, 255);
  } catch {
    return null;
  }
}

function salt() {
  if (process.env.ANALYTICS_SALT) return process.env.ANALYTICS_SALT;
  return crypto
    .createHash('sha256')
    .update(`smelloff-pv-salt:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`)
    .digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // The beacon is same-origin; keep the surface tiny.
  if (req.method !== 'POST') return res.status(405).end();

  // Fail silently on any problem — analytics must never surface an error to a
  // shopper or slow a page down. Always answer 204.
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(204).end();

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT_RE.test(ua)) return res.status(204).end(); // drop bots/monitors

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let path = typeof body.p === 'string' ? body.p : '';
    if (!path.startsWith('/')) path = '/' + path;
    path = path.split('#')[0].split('?')[0].slice(0, 512);
    // Never record admin/api traffic as site pageviews.
    if (/^\/(admin|api)(\/|$)/.test(path)) return res.status(204).end();

    const fwd = req.headers['x-forwarded-for'] || '';
    const ip = (Array.isArray(fwd) ? fwd[0] : String(fwd).split(',')[0]).trim() || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const visitor = crypto
      .createHash('sha256')
      .update(`${day}|${ip}|${ua}|${salt()}`)
      .digest('base64url')
      .slice(0, 32);

    const country = String(req.headers['x-vercel-ip-country'] || '').slice(0, 4) || null;
    const row = {
      path,
      referrer_host: refHost(body.r, 'smelloff.in'),
      device: deviceFrom(ua),
      country,
      visitor,
    };

    // Fire-and-forget insert; don't block the 204 on it.
    await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {});

    return res.status(204).end();
  } catch {
    return res.status(204).end();
  }
}
