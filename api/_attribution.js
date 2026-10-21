// Where an order came from. The browser (assets/js/track.js) keeps the first
// and the latest non-direct visit of the last 30 days: the five UTM fields, the
// kind of ad click id on the URL (never its value), the external referrer
// host, a partner ?ref= and the landing path. create-order stores it on the
// order as `attribution` with a `channel` worked out here, so /admin and the
// Google Sheet can tell Meta ads from creators, Google, organic search and
// WhatsApp campaigns. Nothing here is personal data.
//
// A source the rules don't recognise is shown as it arrived ("Campaign:
// newsletter"); a visit with no campaign and no referrer is "Direct / unknown".
// Never guess a channel the data doesn't name.

const TEXT_KEYS = ['source', 'medium', 'campaign', 'content', 'term', 'referrer', 'partner', 'landing'];
const CLICK_IDS = new Set(['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']);

// UTM values are whatever a link says, so a leading = + - @ (a formula when the
// /admin CSV opens in a spreadsheet) is dropped along with control characters.
function clip(value, max = 100) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/^[=+\-@]+/, '').trim().slice(0, max);
}

export function sanitizeTouch(touch) {
  if (!touch || typeof touch !== 'object' || Array.isArray(touch)) return null;
  const out = {};
  for (const key of TEXT_KEYS) {
    const v = clip(touch[key], key === 'landing' ? 160 : 100);
    if (v) out[key] = key === 'source' || key === 'medium' || key === 'referrer' ? v.toLowerCase() : v;
  }
  if (out.landing && !out.landing.startsWith('/')) delete out.landing;
  if (out.referrer && !/^[a-z0-9.-]+$/.test(out.referrer)) delete out.referrer;
  const click = clip(touch.click_id, 12).toLowerCase();
  if (CLICK_IDS.has(click)) out.click_id = click;
  const at = clip(touch.at, 30);
  if (at && !Number.isNaN(Date.parse(at))) out.at = new Date(at).toISOString();
  const named = out.source || out.medium || out.campaign || out.click_id || out.partner || out.referrer;
  return named ? out : null;
}

export function sanitizeAttribution(value) {
  if (!value || typeof value !== 'object') return null;
  const first = sanitizeTouch(value.first);
  const last = sanitizeTouch(value.last);
  if (!first && !last) return null;
  return { first, last: last || first };
}

const META_SOURCES = /^(meta|facebook|fb|instagram|ig|messenger)$/;
const PAID_MEDIUMS = /(^|_)(cpc|ppc|cpm|paid|ads?|paidsocial|paid_social|display|retargeting|sponsored)($|_)/;
const SEARCH_HOSTS = /(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|yandex\.(com|ru)|baidu\.com)$/;
const AI_HOSTS = /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/;
const SOCIAL_HOSTS = /(^|\.)(facebook\.com|instagram\.com|t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|youtube\.com|reddit\.com|t\.me|telegram\.org)$/;

export function touchChannel(t) {
  if (!t) return '';
  const s = t.source || '';
  const m = t.medium || '';
  if (s === 'whatsapp' || s === 'wa' || m === 'whatsapp') return 'WhatsApp';
  if (/creator|influencer|affiliate|collab/.test(m) || /creator|influencer/.test(s)) return 'Creator';
  if (META_SOURCES.test(s)) return PAID_MEDIUMS.test(m) ? 'Meta ads' : 'Meta social';
  if (t.click_id === 'gclid' || t.click_id === 'gbraid' || t.click_id === 'wbraid') return 'Google Ads';
  if (s === 'google') return PAID_MEDIUMS.test(m) ? 'Google Ads' : (m === 'organic' ? 'Google Search' : 'Google');
  if (s) return `Campaign: ${s}`;
  if (t.click_id === 'fbclid') return 'Facebook/Instagram click';
  if (t.click_id === 'msclkid') return 'Microsoft Ads';
  if (t.partner) return `Partner ${t.partner}`;
  const r = t.referrer || '';
  if (/(^|\.)google\.[a-z.]+$/.test(r)) return 'Google Search';
  if (SEARCH_HOSTS.test(r)) return 'Organic search';
  if (AI_HOSTS.test(r)) return 'AI assistant';
  if (SOCIAL_HOSTS.test(r)) return 'Social referral';
  if (r) return `Referral: ${r}`;
  return '';
}

// The latest named visit decides the channel; a Meta click id on the order
// (fbc, set only with consent) names Meta when the visit itself named nothing.
export function attributionChannel(attribution, { fbc } = {}) {
  const a = attribution || {};
  const channel = touchChannel(a.last) || touchChannel(a.first);
  if (channel) return channel.slice(0, 60);
  if (fbc) return 'Facebook/Instagram click';
  return 'Direct / unknown';
}

// What the order row stores: the two visits plus the channel. Always an
// object, so a direct order reads "Direct / unknown" instead of looking like
// an order from before attribution existed.
export function orderAttribution(value, { fbc } = {}) {
  const a = sanitizeAttribution(value) || { first: null, last: null };
  return { ...a, channel: attributionChannel(a, { fbc }) };
}
