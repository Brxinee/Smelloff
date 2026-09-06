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

  var sid = '';
  try {
    sid = sessionStorage.getItem('smf_sid') || '';
    if (!sid) {
      if (window.crypto && window.crypto.randomUUID) {
        sid = window.crypto.randomUUID();
      } else if (window.crypto && window.crypto.getRandomValues) {
        var arr = new Uint32Array(4);
        window.crypto.getRandomValues(arr);
        sid = arr[0].toString(36) + arr[1].toString(36) + arr[2].toString(36) + arr[3].toString(36);
      } else {
        sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      }
      sessionStorage.setItem('smf_sid', sid);
    }
  } catch (e) {}

  function send(payload) {
    try {
      payload = payload || {};
      payload.path = payload.path || location.pathname;
      payload.ref = payload.ref || document.referrer || '';
      if (sid) payload.session = sid;
      try {
        var utmS = localStorage.getItem('smelloff_utm_source');
        var utmM = localStorage.getItem('smelloff_utm_medium');
        var utmC = localStorage.getItem('smelloff_utm_campaign');
        if (utmS || utmM || utmC) {
          payload.meta = payload.meta || {};
          if (utmS && !payload.meta.utm_source) payload.meta.utm_source = utmS;
          if (utmM && !payload.meta.utm_medium) payload.meta.utm_medium = utmM;
          if (utmC && !payload.meta.utm_campaign) payload.meta.utm_campaign = utmC;
        }
      } catch (e) {}
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
    addEventListener('click', function (e) {
      if (e.isTrusted === false) return;
      var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track]') : null;
      if (!el || (el.closest && el.closest('#smelloff-consent-bar'))) return;
      var label = (el.getAttribute('data-track') || el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      if (!label) return;
      send({ type: 'click', label: label, meta: el.getAttribute('href') ? { href: el.getAttribute('href') } : {} });
    }, true);
  }

})();
