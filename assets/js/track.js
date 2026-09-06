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

  /* PDP checkout: replace the broken fire-and-forget mirror with one awaited,
     server-authoritative order request. This keeps the existing PDP UI intact. */
  if (/^\/odorstrike\/?$/.test(location.pathname)) {
    function pdpSubmitOrder() {
      if (typeof hideError === 'function') hideError();
      if (typeof validateForm !== 'function' || !validateForm()) return;
      var btn = document.getElementById('submitBtn');
      var btnText = document.getElementById('submitText');
      if (btn) btn.disabled = true;
      if (btnText) btnText.textContent = 'Processing…';

      var orderId = typeof genOrderId === 'function' ? genOrderId() : ('SMF-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Math.floor(Math.random()*9000)+1000));
      var order = typeof collectOrder === 'function' ? collectOrder(orderId, '') : null;
      if (!order) {
        if (btn) btn.disabled = false;
        if (typeof showError === 'function') showError('Checkout could not start. Please refresh and try again.');
        return;
      }

      var items = [{ name: 'ODORSTRIKE Fabric Odor Mist', variant: '50ml', label: order.variantLabel || 'ODORSTRIKE 50ml', quantity: order.quantity || 1, price: 229 }];
      var payload = {
        email: order.email || null,
        phone: order.phone || '',
        items: items,
        amount: Math.round(Number(order.total) * 100),
        payment_method: order.paymentMethod === 'cod' ? 'cod' : 'upi',
        address: { name: order.name || '', line: order.address || '', city: order.city || '', state: order.state || '', pincode: order.pincode || '' },
        upi_ref: null,
        order_code: order.orderId || orderId
      };

      if (typeof showLoadingScreen === 'function') showLoadingScreen(order.paymentMethod === 'cod' ? 'Placing your order…' : 'Saving your order…', 'Securing your order');

      fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      }).then(function (response) {
        return response.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (e) {}
          if (!response.ok) throw new Error(data.error || ('Order service returned HTTP ' + response.status));
          if (!data.id) throw new Error('Order was not persisted. Please try again.');
          return data;
        });
      }).then(function (data) {
        if (typeof logOrderToSheets === 'function') logOrderToSheets(order);
        if (order.email && typeof SmelloffEmail !== 'undefined' && SmelloffEmail && typeof SmelloffEmail.send === 'function') {
          SmelloffEmail.send('orderConfirmation', order.email, { orderId: data.order_code || orderId, customerName: order.name || 'there', amount: String(order.total), codFee: order.codFee || 0, address: [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', '), paymentMethod: order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI (' + ((window.SMELLOFF_CONFIG || {}).UPI_ID || 'mr.brainy@ibl') + ')' }).catch(noop);
        }
        if (order.paymentMethod === 'cod') {
          if (typeof showSuccess === 'function') showSuccess(data.order_code || orderId, 'cod');
          return;
        }
        var total = Number(order.total) || 0;
        var link = typeof buildUpiLink === 'function' ? buildUpiLink(total, data.order_code || orderId, 'any') : ('upi://pay?pa=' + encodeURIComponent(((window.SMELLOFF_CONFIG || {}).UPI_ID || 'mr.brainy@ibl')) + '&pn=Smelloff&am=' + total + '&cu=INR');
        if (typeof showUpiSuccess === 'function') showUpiSuccess(data.order_code || orderId, total, link);
        setTimeout(function () { try { location.href = link; } catch (e) {} }, 400);
      }).catch(function (error) {
        console.error('[Smelloff] PDP checkout failed:', error);
        if (typeof hideLoadingScreen === 'function') hideLoadingScreen();
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = order.paymentMethod === 'cod' ? 'Place COD order · ₹289' : 'Open UPI app';
        if (typeof showError === 'function') showError(error && error.message ? error.message : 'We could not place your order. Please try again.');
      });
    }
    window.submitOrder = pdpSubmitOrder;
  }
})();
