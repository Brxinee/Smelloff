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

  /* --- Search Console query-variant guard ---------------------------
     The static site serves one document for clean and parameterized URLs.
     Tracking/referral/cart/search/order-code parameters are state, not unique
     content. Mark the parameterized document noindex while leaving the query
     string intact so real visitor functionality continues to work.

     This directly addresses URLs such as:
       /?q=...
       /?cart=open
       /odorstrike?ref=...
       /track-order?code=...
     without sacrificing the canonical clean URL.
  ---------------------------------------------------------------------- */
  if (window.location.search) {
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';

    var googlebot = document.querySelector('meta[name="googlebot"]');
    if (!googlebot) {
      googlebot = document.createElement('meta');
      googlebot.name = 'googlebot';
      document.head.appendChild(googlebot);
    }
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

  if (!window.__smelloffPV) {
    window.__smelloffPV = true;
    send({ type: 'pageview' });
  }
  var _ps = history.pushState;
  history.pushState = function () { _ps.apply(this, arguments); send({ type: 'pageview' }); };
  addEventListener('popstate', function () { send({ type: 'pageview' }); });

  if (location.pathname === '/' || location.pathname === '' || /^\/odorstrike\/?$/.test(location.pathname)) {
    send({ type: 'product_view', label: 'ODORSTRIKE Fabric Mist' });
  }

  addEventListener('click', function (e) {
    if (e.isTrusted === false) return;
    var el = e.target && e.target.closest ? e.target.closest('a,button,[data-track]') : null;
    if (!el) return;
    if (el.closest && el.closest('#smelloff-consent-bar')) return;
    var label = (el.getAttribute('data-track') || el.innerText || el.getAttribute('aria-label') || '')
      .trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!label) return;
    var href = el.getAttribute('href');
    send({ type: 'click', label: label, meta: href ? { href: href } : {} });
  }, true);

  /*
   * PDP checkout regression guard.
   *
   * odorstrike.html contains the checkout UI inline and historically fired
   * createSupabaseOrder() without awaiting it. That made the UI announce an
   * order even when the persistence request failed, and it tied the browser
   * directly to the Supabase function instead of the site's same-origin API.
   *
   * track.js is already loaded on the PDP after that inline code, so this is a
   * surgical compatibility layer: only /odorstrike is affected, the visual
   * PDP stays byte-for-byte untouched, and existing inline checkout functions
   * remain the source of truth for totals, validation, and rendering.
   */
  if (/^\/odorstrike\/?$/.test(location.pathname)) {
    var originalCreateSupabaseOrder = window.createSupabaseOrder;
    if (typeof originalCreateSupabaseOrder === 'function') {
      window.createSupabaseOrder = function (opts) {
        opts = opts || {};
        var payload = {
          email: opts.email || null,
          phone: opts.phone || '',
          items: Array.isArray(opts.items) ? opts.items : [],
          amountRupees: Number(opts.amountRupees) || 0,
          paymentMethod: opts.paymentMethod || 'cod',
          address: opts.address || {},
          upiRef: opts.upiRef || null,
          orderCode: opts.orderCode || null
        };

        if (!payload.phone) {
          var missingPhone = Promise.reject(new Error('Phone number is required.'));
          window.__smelloffPdpOrderPromise = missingPhone;
          return missingPhone;
        }

        var request = fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin'
        }).then(function (response) {
          return response.text().then(function (text) {
            var data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) {}
            if (!response.ok) {
              throw new Error(data.error || ('Order service returned HTTP ' + response.status));
            }
            if (!data.id) {
              throw new Error('Order was not persisted. Please try again.');
            }
            try { localStorage.setItem('smelloff_order_uuid', data.id); } catch (e) {}
            if (data.order_code) payload.orderCode = data.order_code;
            return data;
          });
        }).catch(function (error) {
          console.error('[Smelloff] PDP order creation failed:', error);
          throw error;
        });

        window.__smelloffPdpOrderPromise = request;
        return request;
      };
    }

    if (typeof window.showSuccess === 'function') {
      var originalShowSuccess = window.showSuccess;
      window.showSuccess = function (orderId, method) {
        var pending = window.__smelloffPdpOrderPromise;
        if (!pending || typeof pending.then !== 'function') {
          return originalShowSuccess(orderId, method);
        }
        pending.then(function (result) {
          originalShowSuccess(result && result.order_code ? result.order_code : orderId, method);
        }).catch(function (error) {
          if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
          var btn = document.getElementById('submitBtn');
          if (btn) btn.disabled = false;
          var btnText = document.getElementById('submitText');
          if (btnText) btnText.textContent = method === 'cod' ? 'Place COD order · ₹289' : 'Open UPI app';
          if (typeof window.showError === 'function') {
            window.showError(error && error.message ? error.message : 'We could not save your order. Please try again.');
          }
        });
      };
    }

    if (typeof window.showUpiSuccess === 'function') {
      var originalShowUpiSuccess = window.showUpiSuccess;
      window.showUpiSuccess = function (orderId, total, upiLink) {
        var pending = window.__smelloffPdpOrderPromise;
        if (!pending || typeof pending.then !== 'function') {
          return originalShowUpiSuccess(orderId, total, upiLink);
        }
        pending.then(function (result) {
          originalShowUpiSuccess(result && result.order_code ? result.order_code : orderId, total, upiLink);
        }).catch(function (error) {
          if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
          var btn = document.getElementById('submitBtn');
          if (btn) btn.disabled = false;
          if (typeof window.showError === 'function') {
            window.showError(error && error.message ? error.message : 'We could not save your order. Please try again.');
          }
        });
      };
    }
  }
})();
