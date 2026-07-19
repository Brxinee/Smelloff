/* Smelloff — first-party, cookieless event beacon (page views, clicks, funnel).
 * Include on every page with: <script src="/assets/js/track.js?v=1" defer></script>
 *
 * Posts same-origin to /api/track, which derives an anonymous daily-rotating
 * visitor hash server-side — no cookie, no PII, runs independently of the
 * marketing-consent choice. Exposes window.smfTrack(payload) for the cart /
 * checkout hooks in app.js. Fire-and-forget: it never blocks or errors a page.
 */
(function () {
  'use strict';
  if (window.smfTrack) return; // double-include guard

  var ENDPOINT = '/api/track';
  var noop = function () {};

  // Automated-browser detection. Headless Chrome / Selenium / Puppeteer /
  // Playwright render JS and auto-dismiss the cookie banner, which was
  // inflating pageviews and "Accept all" clicks. Exposed so the consent/pixel
  // loaders can gate on it too. Conservative signals — low false-positive.
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

  // Owner opt-out: browsers that have logged into the admin never count.
  var owner = false;
  try { owner = localStorage.getItem('smelloff_owner') === '1'; } catch (e) {}
  if (owner || smfIsBot() || /^\/(admin|api)(\/|$)/.test(location.pathname || '/')) {
    window.smfTrack = noop;
    return;
  }

  // Per-tab session id — ties cart/checkout events together. sessionStorage
  // only (dies with the tab); not a tracking cookie.
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
      payload.path = payload.path || (location.pathname + location.search);
      payload.ref = payload.ref || document.referrer || '';
      if (sid) payload.session = sid;
      var body = JSON.stringify(payload);
      // sendBeacon survives page unloads; fetch keepalive is the fallback.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(noop);
      }
    } catch (e) {}
  }
  window.smfTrack = send;

  // Page view now + on SPA-style navigation. __smelloffPV keeps cached pages
  // that still carry the old inline snippet from double-counting.
  if (!window.__smelloffPV) {
    window.__smelloffPV = true;
    send({ type: 'pageview' });
  }
  var _ps = history.pushState;
  history.pushState = function () { _ps.apply(this, arguments); send({ type: 'pageview' }); };
  addEventListener('popstate', function () { send({ type: 'pageview' }); });

  // The PDP is the top of the shopping funnel.
  if (/^\/odorstrike\/?$/.test(location.pathname)) {
    send({ type: 'product_view', label: 'ODORSTRIKE Fabric Mist' });
  }

  // "Track everything": clicks on links, buttons and [data-track] elements.
  addEventListener('click', function (e) {
    // Only real, user-initiated clicks. Programmatic clicks — button.click(),
    // dispatchEvent, headless-browser auto-dismiss of the cookie banner — carry
    // isTrusted === false and are never counted. (Older browsers leave it
    // undefined, which we allow through.)
    if (e.isTrusted === false) return;
    var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track]') : null;
    if (!el) return;
    // The cookie consent buttons ("Accept all" / "Reject") are banner noise,
    // not a shopping interaction — never log them as click events.
    if (el.closest && el.closest('#smelloff-consent-bar')) return;
    var label = (el.getAttribute('data-track') || el.innerText || el.getAttribute('aria-label') || '')
      .trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!label) return;
    var href = el.getAttribute('href');
    send({ type: 'click', label: label, meta: href ? { href: href } : {} });
  }, true);
})();
