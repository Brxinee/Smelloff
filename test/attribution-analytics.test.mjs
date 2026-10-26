import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/create-order.js';
import { orderAttribution, attributionChannel, sanitizeTouch } from '../api/_attribution.js';

// 2026-10-20 conversion/analytics pass. Before it: GA4 dropped every event
// fired before gtag.js loaded (?buy=1's begin_checkout among them), the
// prepaid success screen read "Total paid ₹22900" for a ₹229 order (paise
// passed as rupees, also into GA4 and the Meta Lead), view_item fired only
// when #buy scrolled into view, COD orders sent no fbp/fbc/event_source_url,
// and no order knew which campaign it came from.

const read = (f) => fs.readFileSync(f, 'utf8');
const at = '2026-10-20T10:00:00.000Z';
const touch = (o) => ({ landing: '/', at, ...o });

test('attribution: channels are named only from what the visit says', () => {
  const ch = (last, opts) => attributionChannel(last ? { last: touch(last) } : null, opts);
  assert.equal(ch({ source: 'facebook', medium: 'paid_social' }), 'Meta ads');
  assert.equal(ch({ source: 'instagram', medium: 'cpc' }), 'Meta ads');
  assert.equal(ch({ source: 'instagram', medium: 'bio' }), 'Meta social');
  assert.equal(ch({ source: 'instagram', medium: 'creator' }), 'Creator');
  assert.equal(ch({ source: 'whatsapp', medium: 'broadcast' }), 'WhatsApp');
  assert.equal(ch({ click_id: 'gclid' }), 'Google Ads');
  assert.equal(ch({ source: 'google', medium: 'cpc' }), 'Google Ads');
  assert.equal(ch({ referrer: 'google.co.in' }), 'Google Search');
  assert.equal(ch({ referrer: 'bing.com' }), 'Organic search');
  assert.equal(ch({ referrer: 'chatgpt.com' }), 'AI assistant');
  assert.equal(ch({ source: 'newsletter' }), 'Campaign: newsletter', 'an unknown source is shown as it came, not mapped to Direct');
  assert.equal(ch({ click_id: 'fbclid' }), 'Facebook/Instagram click', 'fbclid alone does not prove an ad');
  assert.equal(ch(null, { fbc: 'fb.1.1.x' }), 'Facebook/Instagram click');
  assert.equal(ch(null), 'Direct / unknown');
  assert.deepEqual(orderAttribution(null), { first: null, last: null, channel: 'Direct / unknown' });
});

test('attribution: only the known fields survive, and none can become a formula', () => {
  const t = sanitizeTouch({ source: '=HYPERLINK("x")', campaign: '+cmd', landing: 'https://evil.test/', click_id: 'abc', email: 'a@b.in', at: 'nope' });
  assert.deepEqual(t, { source: 'hyperlink("x")', campaign: 'cmd' });
  assert.equal(sanitizeTouch({ landing: '/', at }), null, 'a touch that names nothing is dropped');
});

function makeResponse() {
  let statusCode = 200; let body = null;
  return {
    res: { setHeader() {}, status(c) { statusCode = c; return { json(d) { body = d; }, end(d) { body = d; } }; } },
    result: () => ({ statusCode, body }),
  };
}
const jsonResponse = (data, status = 200) => ({ ok: status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });

async function placeCod({ columnMissing = false } = {}) {
  const posts = [];
  const originalFetch = global.fetch;
  const env = { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/orders') && init.method === 'POST') {
      const row = JSON.parse(init.body);
      posts.push(row);
      if (columnMissing && 'attribution' in row) {
        return jsonResponse({ code: 'PGRST204', message: "Could not find the 'attribution' column of 'orders' in the schema cache" }, 400);
      }
      return jsonResponse([{ ...row, id: 'uuid-1', created_at: at }], 201);
    }
    if (u.includes('/rest/v1/orders')) return jsonResponse([]);
    return jsonResponse({});
  };
  try {
    const { res, result } = makeResponse();
    await handler({
      method: 'POST',
      headers: { origin: 'https://smelloff.in', 'x-forwarded-for': `203.0.113.${columnMissing ? 7 : 8}` },
      body: {
        payment_method: 'cod', amount: 31800, email: 'buyer@smelloff.test', phone: '9392974031',
        items: [{ name: 'ODORSTRIKE Fabric Mist', variant: '50ml', quantity: 1, price: 229 }],
        address: { name: 'Test Buyer', line: '1 Test Street', city: 'Hyderabad', state: 'Telangana', pincode: '500018' },
        order_code: 'SMF-20261020-4321',
        fbc: 'fb.1.1.abc',
        attribution: { first: touch({ source: 'facebook', medium: 'paid_social', campaign: 'oct' }), last: touch({ source: 'facebook', medium: 'paid_social', campaign: 'oct' }) },
      },
    }, res);
    return { ...result(), posts };
  } finally {
    global.fetch = originalFetch;
    if (env.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

test('create-order stores where a COD order came from', async () => {
  const r = await placeCod();
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const row = r.posts[0];
  assert.equal(row.attribution.channel, 'Meta ads');
  assert.equal(row.attribution.last.campaign, 'oct');
  assert.equal(row.fbc, 'fb.1.1.abc');
});

test('create-order still saves the order if orders.attribution is missing', async () => {
  const r = await placeCod({ columnMissing: true });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  assert.equal(r.posts.length, 2, 'one retry');
  assert.ok(!('attribution' in r.posts[1]), 'the retry leaves the column out');
});

test('analytics: gtag and fbq queue from the top of the page in all four loader copies', () => {
  for (const f of ['index.html', 'faq.html', 'odorstrike.html', 'assets/js/consent-analytics.js']) {
    const s = read(f);
    assert.match(s, /function primeAnalytics\s*\(\)/, `${f}: primeAnalytics`);
    assert.match(s, /window\.gtag\s*=\s*window\.gtag\s*\|\|\s*function/, `${f}: gtag is a queue, not defined in the script's onload`);
    assert.ok(!/\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.dataLayer/.test(s), `${f}: gtag no longer defined only when gtag.js loads`);
    assert.match(s, /primeAnalytics\(\);\s*\n\s*if\s*\(document\.readyState\s*===\s*'complete'\)/, `${f}: primed before waiting for load`);
    assert.match(s, /Headless\|PhantomJS\|Puppeteer\|Playwright/, `${f}: bots never get the queues`);
  }
});

test('analytics: PDP view_item fires on the page view, not when #buy scrolls into view', () => {
  const s = read('odorstrike.html');
  const view = s.slice(s.indexOf('function viewItem(){'), s.indexOf("document.addEventListener('smf:analytics', viewItem);"));
  assert.match(view, /gtag\('event', 'view_item'/);
  const observer = s.slice(s.indexOf("var buySection = document.getElementById('buy');"), s.indexOf('obs.observe(buySection);'));
  assert.ok(!/view_item|ViewContent/.test(observer), 'the #buy observer only sends the first-party beacon now');
  assert.match(s, /trackShippingInfo\(\);/, 'add_shipping_info once validation passes');
});

test('purchase: rupees, not paise, and never twice for one order', () => {
  const chrome = read('assets/js/chrome.js');
  assert.match(chrome, /amount: paise > 0 \? paise \/ 100 : undefined/, 'markSuccess converts the verified paise to rupees');
  const s = read('odorstrike.html');
  assert.match(s, /if \(orderId && _trackedBefore\(orderId\)\) return;/, 'a reload or second tab never resends purchase');
});

test('orders carry attribution from both checkout paths, COD included', () => {
  const s = read('odorstrike.html');
  const cod = s.slice(s.indexOf("payment_method: isCod ? 'cod' : 'upi',"), s.indexOf("showLoadingScreen(\n      isCod"));
  for (const k of ['event_source_url: location.href', 'attribution:', "fbp: _consented() ? _ck('_fbp') : ''", "fbc: _consented() ? _fbc() : ''"]) assert.ok(cod.includes(k), `COD payload: ${k}`);
  assert.match(read('assets/js/chrome.js'), /attribution: \(typeof window\.smfAttribution === 'function'/);
  assert.ok(!/os_source/.test(s + read('index.html')), 'the old utm_source → "Direct" mapper is gone');
});

test('track.js keeps all five UTM fields and logs campaign landings and WhatsApp taps', () => {
  const t = read('assets/js/track.js');
  assert.match(t, /\['source', 'medium', 'campaign', 'content', 'term'\]/);
  assert.match(t, /type: 'campaign_landing'/);
  assert.match(t, /type: 'whatsapp_click'/);
  assert.match(t, /\(Ref ' \+ ref \+ '\)/, 'order-intent WhatsApp messages carry a reference');
  const api = read('api/track.js');
  for (const e of ['campaign_landing', 'whatsapp_click']) assert.ok(api.includes(`'${e}'`), `/api/track accepts ${e}`);
});

test('health says which Razorpay environment the live key is for', () => {
  assert.match(read('src/index.js'), /razorpayMode: \/\^rzp_live_\//);
});

test('PDP buy strip is lifted with translate, not bottom (no layout shift)', () => {
  const s = read('odorstrike.html');
  assert.ok(!/mobileBar[^;]*\.style\.bottom|mb\.style\.bottom/.test(s), 'no style.bottom on the strip');
  assert.match(s, /mb\.style\.setProperty\('--mb-lift'/);
  assert.match(read('assets/css/chrome.css'), /translate:0 calc\(-1 \* var\(--mb-lift, 0px\)\)/);
});
