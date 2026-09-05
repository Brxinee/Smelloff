/* Smelloff — first-party, cookieless event beacon (page views, clicks, funnel).
 * Include on every page with: <script src="/assets/js/track.js?v=2" defer></script>
 *
 * Posts same-origin to /api/track, which derives an anonymous daily-rotating
 * visitor hash server-side — no cookie, no PII, runs independently of the
 * marketing-consent choice. Exposes window.smfTrack(payload) for the cart /
 * checkout hooks in app.js. Fire-and-forget: it never blocks or errors a page.
 */
(function () {
  'use strict';
  if (window.smfTrack) return; // double-include guard
  if (window.location.search) {
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
    var googlebot = document.querySelector('meta[name="googlebot"]');
    if (!googlebot) { googlebot = document.createElement('meta'); googlebot.name = 'googlebot'; document.head.appendChild(googlebot); }
    googlebot.content = 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
  }
  var ENDPOINT = '/api/track';
  var noop = function () {};
  function smfIsBot() {
    try {
      var n = navigator;
      if (n.webdriver === true) return true;
      if (/Headless|PhantomJS|Puppeteer|Playwright|Electron\//i.test(n.userAgent || '')) return true;
      if (window._phantom || window.callPhantom || window.__nightmare) return true;
      if (n.languages && n.languages.length === 0) return true;
      return false;
    } catch (e) { return false; }
  }
  window.smfIsBot = smfIsBot;
  try {
    var op = new URLSearchParams(location.search).get('smf_owner');
    if (op === '1') localStorage.setItem('smelloff_owner', '1');
    else if (op === '0') localStorage.removeItem('smelloff_owner');
  } catch (e) {}
  var owner = false;
  try { owner = localStorage.getItem('smelloff_owner') === '1'; } catch (e) {}
  if (owner || smfIsBot() || /^\/(admin|api)(\/|$)/.test(location.pathname || '/')) {
    window.smfTrack = noop;
    return;
  }
  var sid = '';
  try {
    sid = sessionStorage.getItem('smf_sid') || '';
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
  window.smfTrack = send;
  if (!window.__smelloffPV) { window.__smelloffPV = true; send({ type: 'pageview' }); }
  var _ps = history.pushState;
  history.pushState = function () { _ps.apply(this, arguments); send({ type: 'pageview' }); };
  addEventListener('popstate', function () { send({ type: 'pageview' }); });
  if (location.pathname === '/' || location.pathname === '' || /^\/odorstrike\/?$/.test(location.pathname)) send({ type: 'product_view', label: 'ODORSTRIKE Fabric Mist' });
  addEventListener('click', function (e) {
    if (e.isTrusted === false) return;
    var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track]') : null;
    if (!el) return;
    if (el.closest && el.closest('#smelloff-consent-bar')) return;
    var label = (el.getAttribute('data-track') || el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!label) return;
    var href = el.getAttribute('href');
    send({ type: 'click', label: label, meta: href ? { href: href } : {} });
  }, true);
})();
