/* Smelloff — first-party, cookieless event beacon. */
(function () {
  'use strict';
  var ENDPOINT = '/api/track';
  var noop = function () {};

  function smfIsBot() {
    try {
      var n = navigator;
      return n.webdriver === true || /Headless|PhantomJS|Puppeteer|Playwright|Electron\//i.test(n.userAgent || '') || !!window._phantom || !!window.callPhantom || !!window.__nightmare || !!(n.languages && n.languages.length === 0);
    } catch (e) { return false; }
  }
  window.smfIsBot = smfIsBot;

  try {
    var op = new URLSearchParams(location.search).get('smf_owner');
    if (op === '1') localStorage.setItem('smelloff_owner', '1');
    else if (op === '0') localStorage.removeItem('smelloff_owner');
  } catch (e) {}

  if (window.location.search) {
    var robots = document.querySelector('meta[name="robots"]') || document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
    if (!robots.parentNode) document.head.appendChild(robots);
    var googlebot = document.querySelector('meta[name="googlebot"]') || document.createElement('meta');
    googlebot.name = 'googlebot';
    googlebot.content = 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
    if (!googlebot.parentNode) document.head.appendChild(googlebot);
  }

  var owner = false;
  try { owner = localStorage.getItem('smelloff_owner') === '1'; } catch (e) {}

  // Where this visitor came from (2026-10-20): the five UTM fields, the kind
  // of ad click id on the URL (never its value), an external referrer host and
  // a partner ?ref=. Kept 30 days as the first and the latest non-direct visit;
  // a direct visit never overwrites one. Checkout sends it with the order
  // (api/_attribution.js names the channel) and every event carries the UTMs.
  var ATTR_KEY = 'smf_attr';
  var ATTR_TTL = 30 * 864e5;
  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'];
  function clip(v, n) { return String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n || 100); }
  function readAttr() {
    try {
      var a = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null');
      return a && a.last && Date.now() - Date.parse(a.last.at) < ATTR_TTL ? a : null;
    } catch (e) { return null; }
  }
  var newTouch = null;
  try {
    var q = new URLSearchParams(location.search), t = {};
    ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) {
      var v = clip(q.get('utm_' + k));
      if (v) t[k] = k === 'source' || k === 'medium' ? v.toLowerCase() : v;
    });
    for (var ci = 0; ci < CLICK_IDS.length; ci++) if (q.get(CLICK_IDS[ci])) { t.click_id = CLICK_IDS[ci]; break; }
    if (clip(q.get('ref'), 40)) t.partner = clip(q.get('ref'), 40);
    var rh = '';
    try { rh = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) {}
    // Our own pages (on any host: previews too) and the payment window are not
    // where anyone came from.
    if (rh && rh !== location.hostname.replace(/^www\./, '').toLowerCase() && !/(^|\.)(smelloff\.in|razorpay\.com)$/.test(rh)) t.referrer = rh;
    if (t.source || t.medium || t.campaign || t.click_id || t.partner || t.referrer) {
      t.landing = location.pathname.slice(0, 160);
      t.at = new Date().toISOString();
      var stored = readAttr() || {};
      stored.first = stored.first || t;
      stored.last = t;
      localStorage.setItem(ATTR_KEY, JSON.stringify(stored));
      if (t.source || t.medium || t.campaign || t.click_id || t.partner) newTouch = t;
    }
  } catch (e) {}
  window.smfAttribution = function () {
    var a = readAttr();
    return a ? { first: a.first || null, last: a.last } : null;
  };

  // A reference for "order on WhatsApp" messages: the owner sees "(Ref WA-…)"
  // in the chat and can find the click, its page and its campaign in events.
  function waRef() {
    try {
      var r = sessionStorage.getItem('smf_wa_ref');
      if (!r) { r = 'WA-' + Math.random().toString(36).slice(2, 7).toUpperCase(); sessionStorage.setItem('smf_wa_ref', r); }
      return r;
    } catch (e) { return ''; }
  }

  var sid = '';
  try {
    sid = sessionStorage.getItem('smf_sid') || '';
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('smf_sid', sid);
    }
  } catch (e) {}

  // GA4 (2026-11-02). gtag exists only after the visitor accepted analytics
  // (and never for bots or the owner's devices), so this is a no-op otherwise:
  // nothing reaches Google without consent. smfGa() is for any page script.
  function ga(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {}
  }
  window.smfGa = ga;
  // First-party events that GA4 should see too, renamed to read well in its
  // reports. Only the short label goes over, never meta (a chat question can
  // hold a phone number). Ecommerce, WhatsApp and buy clicks are sent by their
  // own code, so they are not mirrored here (that would count them twice).
  var GA_MIRROR = {
    view_content: function (l) { var m = /^home_sec_(.+)$/.exec(l); return m ? ['section_view', { section: m[1] }] : null; },
    chat_open: function (l) { return ['chat_open', { chat_action: l || 'launcher' }]; },
    chat_message: function (l) { return ['chat_message', { chat_action: l || 'typed' }]; },
    chat_feedback: function (l) { return ['chat_feedback', { rating: l }]; },
    chat_card_click: function (l) { return ['chat_card_click', { card: l }]; },
    chat_teaser: function (l) { return ['chat_teaser', { chat_action: l }]; },
    checkout_exit: function (l) { return ['checkout_exit', { reason: l }]; },
    click: function (l) { return l === 'pdp_pin_check' ? ['pincode_check', {}] : null; }
  };
  function mirror(payload) {
    var f = GA_MIRROR[payload.type];
    if (!f || typeof window.gtag !== 'function') return;
    var r = f(clip(payload.label, 100));
    if (r) ga(r[0], r[1]);
  }
  // Which part of the page a link sits in, for buy_cta_click.
  function zone(el) {
    if (el.closest('.sf-hdr__menu')) return 'menu';
    if (el.closest('.sf-hdr,header.sf-hdr')) return 'header';
    if (el.closest('.sf-ftr,footer')) return 'footer';
    if (el.closest('.sf-endcap,.end-cta')) return 'end_card';
    if (el.closest('.sfc,[class*="sfc-"]')) return 'chat';
    var sec = el.closest('[id]');
    return sec && sec.id !== 'sf-main' ? sec.id.slice(0, 60) : 'body';
  }

  function send(payload) {
    try {
      payload = payload || {};
      payload.path = payload.path || location.pathname;
      payload.ref = payload.ref || document.referrer || '';
      if (sid) payload.session = sid;
      var la = readAttr();
      if (la) {
        payload.meta = payload.meta || {};
        ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) {
          if (la.last[k] && !payload.meta['utm_' + k]) payload.meta['utm_' + k] = la.last[k];
        });
      }
      mirror(payload);
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      else fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(noop);
    } catch (e) {}
  }

  if (owner || smfIsBot() || /^\/(admin|api)(\/|$)/.test(location.pathname || '/')) {
    window.smfTrack = noop;
  } else {
    window.smfTrack = send;
    if (!window.__smelloffPV) { window.__smelloffPV = true; send({ type: 'pageview' }); }
    var _ps = history.pushState;
    history.pushState = function () { _ps.apply(this, arguments); send({ type: 'pageview' }); };
    addEventListener('popstate', function () { send({ type: 'pageview' }); });
    if (location.pathname === '/' || location.pathname === '' || /^\/odorstrike\/?$/.test(location.pathname)) send({ type: 'product_view', label: 'ODORSTRIKE Fabric Mist' });
    // One row per campaign landing (a reload of the same URL doesn't repeat it).
    if (newTouch) {
      var seenKey = 'smf_cl_' + location.pathname + location.search;
      var seen = false;
      try { seen = sessionStorage.getItem(seenKey) === '1'; sessionStorage.setItem(seenKey, '1'); } catch (e) {}
      if (!seen) send({ type: 'campaign_landing', label: newTouch.source || newTouch.click_id || 'partner', meta: { click_id: newTouch.click_id || '', partner: newTouch.partner || '', landing: newTouch.landing } });
    }
    addEventListener('click', function (e) {
      if (e.isTrusted === false) return;
      var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track]') : null;
      if (!el) return;
      // The consent answer itself, so the share of visitors GA4 can see is
      // known (GA4 only counts those who accept).
      if (el.closest && el.closest('#smelloff-consent-bar')) {
        var cl = el.classList;
        if (cl && (cl.contains('cb-accept') || cl.contains('cb-reject'))) send({ type: 'consent_choice', label: cl.contains('cb-accept') ? 'accepted' : 'rejected' });
        return;
      }
      // A tap that opens a chat with the business number. Counted as a click,
      // never as an order: WhatsApp orders are entered by hand.
      var href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
      if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\/(send\?phone=)?919392974031/.test(href)) {
        var text = '';
        try { text = decodeURIComponent(((href.match(/[?&]text=([^&]*)/) || [])[1] || '').replace(/\+/g, ' ')); } catch (er) {}
        var intent = el.getAttribute('data-wa-intent') || (/\bto order\b/i.test(text) ? 'order' : 'chat');
        var sec = el.closest('[id]');
        var where = el.getAttribute('data-wa') || (location.pathname + (sec && sec.id !== 'sf-main' ? '#' + sec.id : '')).slice(0, 120);
        var ref = intent === 'order' ? waRef() : '';
        if (ref && text.indexOf(ref) === -1) el.setAttribute('href', href.replace(/([?&]text=)[^&]*/, function (m, k) { return k + encodeURIComponent(text + ' (Ref ' + ref + ')'); }));
        send({ type: 'whatsapp_click', label: where, meta: { intent: intent, ref: ref } });
        try { if (typeof window.gtag === 'function') window.gtag('event', 'whatsapp_click', { link_location: where, intent: intent }); } catch (er) {}
        try { if (typeof window.fbq === 'function') window.fbq('track', 'Contact', { content_category: intent }); } catch (er) {}
      }
      var label = (el.getAttribute('data-track') || el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      // A link to the product page or a #buy box, on any page: GA4 sees which
      // page and which part of it sent the visitor to buy.
      if (href && (href.indexOf('#buy') !== -1 || /^(https?:\/\/(www\.)?smelloff\.in)?\/odorstrike(\/|\?|#|$)/.test(href))) {
        ga('buy_cta_click', { link_url: href.slice(0, 100), link_text: label.slice(0, 80), link_location: zone(el) });
      }
      if (!label) return;
      send({ type: 'click', label: label, meta: el.getAttribute('href') ? { href: el.getAttribute('href') } : {} });
    }, true);
  }

})();
