// GA4 coverage pass (2026-11-02, owner: "every bit of info should be in Google
// Analytics"). Pins: the owner's devices and test orders stay out, every page
// has a content group, first-party events GA4 should see are mirrored (never
// their meta), buy clicks are sent from every page, and the cart, checkout and
// payment window send the events GA4's funnel reports need.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const LOADERS = ['index.html', 'faq.html', 'odorstrike.html', 'assets/js/consent-analytics.js'];

test('every GA4 loader copy leaves out the owner, sets consent, content group and debug mode', () => {
  for (const f of LOADERS) {
    const s = read(f);
    assert.match(s, /function smfGaExcluded\s*\(\)/, `${f}: owner exclusion`);
    assert.match(s, /smelloff_owner/, `${f}: reads the owner flag`);
    assert.match(s, /if\s*\(\s*smfGaExcluded\(\)\s*\)\s*return false;/, `${f}: primeAnalytics stops for the owner`);
    assert.match(s, /function smfGaConfig\s*\(\)/, `${f}: config builder`);
    assert.match(s, /content_group/, `${f}: content group`);
    assert.match(s, /ga_debug=1/, `${f}: DebugView switch`);
    assert.match(s, /gtag\('consent',\s*'default',\s*\{\s*analytics_storage:\s*'granted'/, `${f}: consent signals`);
    assert.match(s, /gtag\('config',\s*(GA4_ID|'G-S1MJ58PD89'),\s*smfGaConfig\(\)\)/, `${f}: config carries smfGaConfig()`);
    // consent before config
    assert.ok(s.indexOf("'consent', 'default'") > -1 || s.indexOf("'consent','default'") > -1);
    const c = s.search(/gtag\('consent',\s*'default'/);
    const k = s.search(/gtag\('config',/);
    assert.ok(c > -1 && c < k, `${f}: consent default comes before config`);
  }
});

function loadGaConfig(pathname, search = '') {
  const src = read('assets/js/consent-analytics.js');
  const body = src.slice(src.indexOf('  function smfGaExcluded()'), src.indexOf('  // Kept separate from loadAnalytics()'));
  const store = {};
  const ss = {};
  const ctx = {
    location: { pathname, search },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); } },
  };
  vm.runInNewContext(`${body}\nthis.smfGaConfig = smfGaConfig; this.smfGaExcluded = smfGaExcluded;`, ctx);
  return { ctx, store };
}

test('content groups name every page type', () => {
  const cases = {
    '/': 'home', '/odorstrike': 'product', '/odorstrike.html': 'product', '/blog': 'blog_index',
    '/blog/why-i-built-odorstrike': 'blog_post', '/shipping': 'policy', '/privacy': 'policy',
    '/faq': 'faq', '/track-order': 'track-order', '/about': 'about',
  };
  for (const [p, g] of Object.entries(cases)) {
    assert.equal(loadGaConfig(p).ctx.smfGaConfig().content_group, g, p);
  }
  assert.equal(loadGaConfig('/').ctx.smfGaConfig().debug_mode, undefined, 'no debug_mode unless asked (false would still turn it on)');
  assert.equal(loadGaConfig('/', '?ga_debug=1').ctx.smfGaConfig().debug_mode, true);
});

test('the owner flag (or ?smf_owner=1) keeps GA4 off; ?smf_owner=0 turns it back on', () => {
  assert.equal(loadGaConfig('/').ctx.smfGaExcluded(), false);
  assert.equal(loadGaConfig('/', '?smf_owner=1').ctx.smfGaExcluded(), true);
  const { ctx, store } = loadGaConfig('/');
  store.smelloff_owner = '1';
  assert.equal(ctx.smfGaExcluded(), true);
  ctx.location.search = '?smf_owner=0';
  assert.equal(ctx.smfGaExcluded(), false);
  assert.match(read('admin/index.html'), /localStorage\.setItem\('smelloff_owner', '1'\)/, '/admin login marks the device as the owner\'s');
});

// Runs assets/js/track.js against a fake browser and records gtag calls.
function runTrack({ gtag = true, pathname = '/' } = {}) {
  const calls = [];
  const beacons = [];
  const listeners = {};
  const meta = () => ({ name: '', content: '', parentNode: null });
  const win = {};
  Object.assign(win, {
    navigator: { webdriver: false, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', languages: ['en-IN'], sendBeacon: (u, b) => { beacons.push(b); return true; } },
    location: { pathname, search: '', hostname: 'smelloff.in' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { referrer: '', querySelector: () => null, createElement: meta, head: { appendChild() {} } },
    history: { pushState() {} },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    URLSearchParams, URL, JSON, Date, Math, String, Number, Object, Array, RegExp,
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    fetch: () => Promise.resolve(),
  });
  if (gtag) win.gtag = (...a) => calls.push(a);
  win.window = win;
  vm.runInNewContext(read('assets/js/track.js'), win);
  return { win, calls, beacons, listeners };
}

test('track.js mirrors section, chat and checkout-exit events to GA4, label only', () => {
  const { win, calls } = runTrack();
  win.smfTrack({ type: 'view_content', label: 'home_sec_faq' });
  win.smfTrack({ type: 'chat_message', label: 'tile', meta: { q: 'my number is 9876543210' } });
  win.smfTrack({ type: 'chat_feedback', label: 'down', meta: { q: 'secret question' } });
  win.smfTrack({ type: 'checkout_exit', label: 'cod' });
  win.smfTrack({ type: 'click', label: 'pdp_pin_check' });
  win.smfTrack({ type: 'click', label: 'Some button' });
  win.smfTrack({ type: 'purchase', value: 22900 });
  win.smfTrack({ type: 'whatsapp_click', label: '/' });
  const ev = JSON.parse(JSON.stringify(calls.filter((c) => c[0] === 'event').map((c) => [c[1], c[2]])));
  assert.deepEqual(ev, [
    ['section_view', { section: 'faq' }],
    ['chat_message', { chat_action: 'tile' }],
    ['chat_feedback', { rating: 'down' }],
    ['checkout_exit', { reason: 'cod' }],
    ['pincode_check', {}],
  ]);
  assert.ok(!JSON.stringify(calls).includes('9876543210'), 'chat meta never reaches GA4');
});

test('without consent (no gtag) track.js sends nothing to Google and still beacons first-party', () => {
  const { win, beacons } = runTrack({ gtag: false });
  assert.equal(typeof win.gtag, 'undefined');
  win.smfTrack({ type: 'view_content', label: 'home_sec_faq' });
  assert.ok(beacons.length >= 2, 'pageview + event still go to /api/track');
});

test('buy_cta_click and the consent answer are tracked from track.js on every page', () => {
  const t = read('assets/js/track.js');
  assert.match(t, /ga\('buy_cta_click'/);
  assert.match(t, /link_location: zone\(el\)/);
  assert.match(t, /type: 'consent_choice'/);
  assert.doesNotMatch(read('assets/js/consent-analytics.js'), /gtag\('event', 'buy_cta_click'/, 'moved, so it is not sent twice on blog pages');
  assert.match(read('api/track.js'), /'consent_choice'/, 'the beacon accepts it');
  // track.js is on every page that has a GA4 loader.
  for (const f of ['index.html', 'faq.html', 'odorstrike.html', 'blog/index.html', 'contact.html', 'track-order.html']) {
    assert.match(read(f), /\/assets\/js\/track\.js\?v=/, `${f}: loads track.js`);
  }
});

test('PDP and checkout send the full GA4 ecommerce funnel', () => {
  const s = read('odorstrike.html');
  for (const ev of ['view_item', 'select_item', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'checkout_error', 'order_error']) {
    assert.match(s, new RegExp(`'${ev}'`), `odorstrike.html: ${ev}`);
  }
  assert.match(s, /item_brand: 'Smelloff', item_category: 'Clothing deodorant', item_variant: '50ml'/);
  assert.match(s, /function gaCartChange\(oldQ, newQ, where\)/);
  for (const fn of ['cartInc', 'cartDec', 'cartRemove', 'cartAddFromEmpty']) {
    const body = s.slice(s.indexOf(`function ${fn}()`), s.indexOf('\n', s.indexOf(`function ${fn}()`)));
    assert.match(body, /gaCartChange\(/, `${fn} reports the change`);
  }
  assert.match(s.slice(s.indexOf('function ckStepQty'), s.indexOf('window.ckStepQty')), /gaCartChange\(/, 'checkout stepper reports the change');
  // Test orders never become GA4 revenue.
  const tp = s.slice(s.indexOf('function trackPurchase'), s.indexOf('function trackShippingInfo'));
  assert.match(tp, /\\btest\\b\|key check\|do not ship/);
  assert.match(tp, /@smelloff\\\.in\$/);
  assert.match(tp, /typeof gtag !== 'undefined' && !_isTest/);
});

test('payment window, newsletter, contact and tracking pages report to GA4', () => {
  const c = read('assets/js/chrome.js');
  for (const ev of ['payment_window_open', 'payment_failed', 'payment_cancelled', 'payment_error']) {
    assert.match(c, new RegExp(`gaPay\\('${ev}'`), `chrome.js: ${ev}`);
  }
  assert.match(c, /'sign_up', \{ method: 'newsletter_footer' \}/);
  assert.match(read('blog/index.html'), /'sign_up', \{ method: 'newsletter_blog' \}/);
  assert.match(read('contact.html'), /'generate_lead', \{ lead_source: 'contact_form'/);
  assert.match(read('track-order.html'), /'track_order', \{ result: 'found'/);
});

test('homepage offer box is a GA4 item list priced from config', () => {
  const s = read('index.html');
  const cfg = JSON.parse(read('config/product.json')).product;
  const m = /var PACKS = \[\[1, (\d+)\], \[2, (\d+)\], \[5, (\d+)\]\];/.exec(s);
  assert.ok(m, 'PACKS table');
  assert.deepEqual(m.slice(1).map(Number), [cfg.price, cfg.pairPrice, cfg.fivePackPrice]);
  assert.match(s, /'view_item_list', \{ item_list_id: 'home_offer'/);
  assert.match(s, /'select_item', \{ item_list_id: 'home_offer'/);
  assert.match(s, new RegExp(`item_id: '${cfg.sku}'`));
});
