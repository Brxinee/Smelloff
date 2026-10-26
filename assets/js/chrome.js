/* =====================================================================
   Smelloff — shared site chrome behaviour  (v4, 2026-09-17)
   =====================================================================
   Shared header/menu/cart behaviour plus a hardened Razorpay Standard
   Checkout flow for the existing checkout overlay.

   Important: this site uses Razorpay Standard Checkout end-to-end.
   Magic Checkout is intentionally not requested by this client because
   Magic Checkout uses a different SDK and completion flow.
   ===================================================================== */
(function () {
  'use strict';

  // Skeleton loading: soft.css §10 shimmers every <img> until it is marked
  // loaded. Capture-phase listeners because load/error don't bubble; the
  // sweep catches images that finished before this deferred script ran.
  function markImg(img) { img.classList.add('is-loaded'); }
  ['load', 'error'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.target && e.target.tagName === 'IMG') markImg(e.target); }, true);
  });
  Array.prototype.forEach.call(document.images, function (img) { if (img.complete) markImg(img); });

  var burger = document.querySelector('.sf-burger');
  var menu = document.getElementById('sfMenu');
  // Phone menu = a drawer from the left. The dimmed page beside it is a
  // box-shadow, so a tap there lands on the page; the capture listener below
  // swallows that tap and closes the drawer instead of following a link.
  function setMenu(open, refocus) {
    if (!burger || !menu) return;
    menu.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('sf-menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      var close = menu.querySelector('.sf-menu__close');
      // After the visibility flip has applied, or focus() is ignored.
      if (close) window.setTimeout(function () { close.focus({ preventScroll: true }); }, 50);
    } else if (refocus) burger.focus();
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
    var closeBtn = menu.querySelector('.sf-menu__close');
    if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false, true); });
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(e.target) || burger.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      setMenu(false);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false, true);
    });
    // Widening to desktop hides the drawer in CSS; drop the open state too.
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width:900px)');
      var onWide = function () { if (wide.matches) setMenu(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }
  }

  // Shadow under the sticky bar once the page has moved — a quiet cue that
  // the bar is floating over content, not part of it.
  var hdr = document.querySelector('.sf-hdr');
  if (hdr) {
    var scrolled = false;
    var onScroll = function () {
      var now = window.scrollY > 8;
      if (now !== scrolled) { scrolled = now; hdr.classList.toggle('is-scrolled', now); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  // A tap on a menu link that stays on this page (an #anchor) must close it.
  if (menu && burger) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setMenu(false);
    });
  }

  // Footer newsletter — the same `waitlist` table and approach as the blog
  // index form: direct REST insert with the public anon key (insert-only
  // under RLS), duplicates ignored so a returning reader isn't told it failed.
  var news = document.querySelector('[data-sf-news]');
  if (news) {
    news.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = news.querySelector('input[type="email"]');
      var btn = news.querySelector('button');
      var status = news.querySelector('.sf-ftr__news-status');
      var email = (input.value || '').trim();
      var say = function (msg, state) { status.textContent = msg; status.setAttribute('data-state', state); };
      if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
        input.setAttribute('aria-invalid', 'true');
        say('That email address doesn\u2019t look right.', 'err');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      btn.disabled = true;
      var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4';
      fetch('https://tnuqjydmoxczdjnsgpci.supabase.co/rest/v1/waitlist', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json',
          Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify({ email: email, source: 'footer' })
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        news.querySelector('.sf-ftr__news-row').hidden = true;
        say('You\u2019re on the list.', 'ok');
      }).catch(function () {
        btn.disabled = false;
        say('That didn\u2019t go through. Try again, or email info@smelloff.in.', 'err');
      });
    });
  }

  var badge = document.getElementById('sfCartCount');
  if (badge) {
    var refresh = function () {
      var qty = 0;
      try { qty = parseInt(localStorage.getItem('smelloff_cart_v1'), 10) || 0; } catch (e) { /* storage blocked */ }
      if (qty > 0) { badge.textContent = qty; badge.hidden = false; }
      else { badge.hidden = true; }
    };
    refresh();
    window.addEventListener('pageshow', refresh);
  }

  var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (path.length > 1) path = path.replace(/\/$/, '');
  var links = document.querySelectorAll('.sf-nav a[href], .sf-hdr__menu a[href]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (!href || href.charAt(0) !== '/') continue;
    var norm = href.split(/[?#]/)[0].replace(/\/$/, '');
    if (norm === path || (norm !== '' && path.indexOf(norm + '/') === 0)) links[i].setAttribute('aria-current', 'page');
  }

  var checkoutButton = document.getElementById('submitBtn');
  if (!checkoutButton) return;

  var RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
  var SDK_TIMEOUT_MS = 15000;
  var razorpayInFlight = false;
  var finalizedThisCheckout = false;

  function getRazorpayReady() {
    if (window.Razorpay) return Promise.resolve(window.Razorpay);
    if (window.smfRazorpayReady) return window.smfRazorpayReady;

    window.smfRazorpayReady = new Promise(function (resolve, reject) {
      var finished = false;
      var timeoutId = window.setTimeout(function () {
        if (finished) return;
        finished = true;
        reject(new Error('Razorpay Checkout took too long to load. Check your connection and try again.'));
      }, SDK_TIMEOUT_MS);

      function succeed() {
        if (finished) return;
        if (!window.Razorpay) {
          finished = true;
          window.clearTimeout(timeoutId);
          reject(new Error('Razorpay Checkout loaded but is unavailable. Please try again.'));
          return;
        }
        finished = true;
        window.clearTimeout(timeoutId);
        resolve(window.Razorpay);
      }

      function failLoad() {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        reject(new Error('Unable to load Razorpay Checkout. Please try again.'));
      }

      // Loaded on demand: the SDK pulls ~1.3 MB of Razorpay JS/CSS, which the
      // product page used to download on every visit before anyone tapped Buy.
      // openCheckout() warms it, so it is ready by the time the form is filled.
      var script = document.querySelector('script[src="' + RAZORPAY_SCRIPT + '"]');
      if (!script) {
        script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', succeed, { once: true });
      script.addEventListener('error', function () {
        // Drop the failed tag so the next attempt fetches it again.
        if (script.parentNode) script.parentNode.removeChild(script);
        failLoad();
      }, { once: true });
    }).catch(function (error) {
      window.smfRazorpayReady = null;
      throw error;
    });

    return window.smfRazorpayReady;
  }
  window.smfWarmRazorpay = function () { getRazorpayReady().catch(function () {}); };

  // Start the download on the first sign of intent (hover, touch or focus on
  // a Buy button), a beat before the tap that opens checkout.
  ['pdpBuyBtn', 'showcaseBuyBtn', 'finalBuyBtn', 'mobileBarBuyBtn', 'pdpCartBtn', 'cartCheckoutBtn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    ['pointerenter', 'touchstart', 'focus'].forEach(function (type) {
      el.addEventListener(type, window.smfWarmRazorpay, { once: true, passive: true });
    });
  });

  function textValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidCheckoutEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
  }

  function quantityFromCheckout() {
    var maxQty = (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.maxQuantity) ||
      (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.MAX_QTY) || 10;
    var variant = textValue('checkoutVariant');
    var match = variant.match(/(\d+)\s*[×x]/i);
    if (match) return Math.max(1, Math.min(maxQty, Number(match[1])));

    try {
      var stored = parseInt(localStorage.getItem('smelloff_cart_v1'), 10);
      if (Number.isInteger(stored) && stored > 0) return Math.min(maxQty, stored);
    } catch (e) { /* storage blocked */ }
    return 1;
  }

  function clientOrderCode() {
    if (typeof window.genOrderId === 'function') return window.genOrderId();
    var d = new Date();
    var date = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'SMF-' + date + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  }

  function unitPriceRupees() {
    return (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES && window.SMELLOFF_CONFIG.PRICES.solo) ||
      (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.pricePrepaid) ||
      (window.SMELLOFF_TRUTH && window.SMELLOFF_TRUTH.pricePrepaid) || 229;
  }

  // Product subtotal: fives at PRICES.five ("5 for ₹899"), pairs left at
  // PRICES.pair ("2 for ₹419"), an odd bottle at the unit price. Same rule as
  // subtotalForQuantity() in the Worker.
  function subtotalRupees(qty) {
    var q = Math.max(0, Math.floor(Number(qty) || 0));
    var unit = Number(unitPriceRupees());
    var PR = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES) || {};
    var T = window.SMELLOFF_PRODUCT_TRUTH || {};
    var pair = Number(PR.pair) || Number(T.pairPrice) || unit * 2;
    var five = Number(PR.five) || Number(T.fivePackPrice) || pair * 2 + unit;
    var r = q % 5;
    return Math.floor(q / 5) * five + Math.floor(r / 2) * pair + (r % 2) * unit;
  }

  // COD pays a shipping charge by delivery pincode (prepaid ships free); the
  // server prices it the same way (codFeeForPincode) and rejects a mismatch.
  function codFeeRupees() {
    var C = window.SMELLOFF_CONFIG || {};
    var T = window.SMELLOFF_PRODUCT_TRUTH || {};
    var zones = C.COD_ZONES || (T.codShipping && T.codShipping.zones) || [];
    var pinEl = document.getElementById('f_pin');
    var pin = String(pinEl ? pinEl.value : '').replace(/\D/g, '').slice(-6);
    if (pin.length === 6) {
      for (var i = 0; i < zones.length; i++) {
        var pre = zones[i].prefixes || [];
        for (var j = 0; j < pre.length; j++) if (pin.indexOf(pre[j]) === 0) return Number(zones[i].fee);
      }
    }
    var n = Number(C.COD_FEE);
    if (Number.isFinite(n) && n >= 0) return n;
    n = Number(T.codFee);
    return Number.isFinite(n) && n >= 0 ? n : 90;
  }

  function currentPaymentMethod() {
    var method = String(window.payMethod || 'prepaid').toLowerCase();
    return method === 'cod' ? 'cod' : 'prepaid';
  }

  function ensurePaymentUi() {
    var form = document.getElementById('checkoutForm');
    if (!form) return;
    var selector = document.getElementById('smfPaymentChoice') || form.querySelector('.checkout-payment');
    if (selector && !selector.dataset.bound) {
      selector.dataset.bound = '1';
      selector.querySelectorAll('.pay-opt').forEach(function (button) {
        button.setAttribute('aria-checked', button.dataset.method === currentPaymentMethod() ? 'true' : 'false');
      });
    }
  }
  function renderPaymentUi() {
    ensurePaymentUi();
    var method = currentPaymentMethod();
    var qty = quantityFromCheckout();
    var subtotal = subtotalRupees(qty);
    var fee = method === 'cod' ? codFeeRupees() : 0;
    var total = subtotal + fee;

    document.querySelectorAll('.checkout-payment .pay-opt').forEach(function (button) {
      var active = button.dataset.method === method;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    var upiPanel = document.getElementById('upiPayPanel');
    var codPanel = document.getElementById('codPayPanel');
    if (upiPanel) upiPanel.style.display = method === 'cod' ? 'none' : 'block';
    if (codPanel) codPanel.style.display = method === 'cod' ? 'block' : 'none';

    var feeRow = document.getElementById('codFeeRow');
    var feeAmount = document.getElementById('codFeeAmount');
    if (feeRow) feeRow.style.display = method === 'cod' ? 'flex' : 'none';
    if (feeAmount) feeAmount.textContent = '₹' + fee;

    var reassure = document.querySelector('.checkout-reassure');
    if (reassure) reassure.textContent = method === 'cod'
      ? 'Pay ₹' + total + ' in cash or UPI when it arrives · 7-day returns'
      : 'Payments secured by Razorpay · 7-day returns';

    var totalEl = document.getElementById('checkoutTotal');
    if (totalEl) totalEl.textContent = '₹' + total;

    var submitText = document.getElementById('submitText');
    if (submitText && !checkoutButton.disabled) {
      submitText.textContent = method === 'cod'
        ? 'Place COD order · ₹' + total
        : 'Pay ₹' + subtotal + ' securely';
    }

    if (method === 'cod') {
      document.querySelectorAll('#upiInlineId, #wa-utr-btn, .upi-cta, #openUpiApp').forEach(function (el) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      });
    }
  }

  function orderPayload() {
    var qty = quantityFromCheckout();
    var unitPrice = Number(unitPriceRupees());
    var amountRupees = subtotalRupees(qty);
    return {
      email: normalizeEmail(textValue('f_email')),
      phone: textValue('f_phone'),
      items: [{
        name: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.productName) || 'ODORSTRIKE Fabric Mist',
        variant: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.size) || '50ml',
        quantity: qty,
        price: unitPrice
      }],
      amount: Math.round(amountRupees * 100),
      payment_method: 'pending',
      address: {
        name: textValue('f_name'),
        line: textValue('f_addr'),
        city: textValue('f_city'),
        state: textValue('f_state'),
        pincode: textValue('f_pin')
      },
      order_code: clientOrderCode(),
      event_source_url: window.location.href,
      // Where the order came from (assets/js/track.js) and, with consent, the
      // Meta click cookies the server-side Purchase matches on.
      attribution: (typeof window.smfAttribution === 'function' && window.smfAttribution()) || null,
      fbp: metaCookie('_fbp'),
      fbc: metaCookie('_fbc') || fbcFromUrl()
    };
  }

  function consented() {
    try { return localStorage.getItem('smelloff_consent_v1') === 'accepted'; } catch (e) { return false; }
  }
  function metaCookie(name) {
    if (!consented()) return '';
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  // The Pixel sets _fbc from ?fbclid=; if it hadn't loaded yet, build it the
  // same way (fb.1.<ms>.<fbclid>) so a paid click isn't lost.
  function fbcFromUrl() {
    if (!consented()) return '';
    try { var f = new URLSearchParams(location.search).get('fbclid'); return f ? 'fb.1.' + Date.now() + '.' + f : ''; } catch (e) { return ''; }
  }

  // `loading` is false, true ("Opening secure payment…") or a label to show
  // while busy, e.g. while a finished payment is being confirmed.
  function setButtonState(loading) {
    var btn = document.getElementById('submitBtn');
    var label = document.getElementById('submitText');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (loading) setPayNote('');
    if (label) label.textContent = loading
      ? (typeof loading === 'string' ? loading : 'Opening secure payment…')
      : (currentPaymentMethod() === 'cod'
        ? 'Place COD order · ₹' + (subtotalRupees(quantityFromCheckout()) + codFeeRupees())
        : 'Pay ₹' + subtotalRupees(quantityFromCheckout()) + ' securely');
  }

  function showPaymentError(message) {
    var safeMessage = String(message || 'Unable to start secure checkout. Please try again.');
    if (typeof window.showError === 'function') { window.showError(safeMessage); return; }
    var error = document.getElementById('checkoutError');
    if (error) { error.textContent = safeMessage; error.style.display = 'block'; }
    else window.alert(safeMessage);
  }

  // A calm one-line status under the pay button (not an error: nothing failed).
  function setPayNote(text) {
    var btn = document.getElementById('submitBtn');
    var note = document.getElementById('smfPayNote');
    if (!note && text && btn && btn.parentNode) {
      note = document.createElement('p');
      note.id = 'smfPayNote';
      note.className = 'smf-pay-note';
      note.setAttribute('role', 'status');
      btn.parentNode.insertBefore(note, btn.nextSibling);
    }
    if (note) { note.textContent = text || ''; note.hidden = !text; }
  }

  function hidePaymentError() {
    if (typeof window.hideError === 'function') window.hideError();
    var error = document.getElementById('checkoutError');
    if (error) error.style.display = 'none';
  }

  function installCheckoutOverrides() {
    ensurePaymentUi();
    renderPaymentUi();
    // COD shipping depends on the pincode: re-price as it is typed.
    var pinInput = document.getElementById('f_pin');
    if (pinInput && !pinInput.dataset.codBound) {
      pinInput.dataset.codBound = '1';
      pinInput.addEventListener('input', function () { renderPaymentUi(); });
      pinInput.addEventListener('change', function () { renderPaymentUi(); });
    }

    checkoutButton.onclick = function () {
      if (typeof window.submitOrder === 'function') return window.submitOrder();
      return window.startRazorpay();
    };
    checkoutButton.setAttribute('type', 'button');

    if (typeof window.selectPay === 'function' && !window.__smfPaymentSelectInstalled) {
      var originalSelectPay = window.selectPay;
      window.__smfPaymentSelectInstalled = true;
      window.selectPay = function () {
        var result = originalSelectPay.apply(this, arguments);
        setPayNote('');
        renderPaymentUi();
        return result;
      };
    }

    if (typeof window.openCheckout === 'function' && !window.__smfPaymentOpenInstalled) {
      var originalOpenCheckout = window.openCheckout;
      window.__smfPaymentOpenInstalled = true;
      window.openCheckout = function () {
        var result = originalOpenCheckout.apply(this, arguments);
        ensurePaymentUi();
        renderPaymentUi();
        window.requestAnimationFrame(renderPaymentUi);
        return result;
      };
    }
  }

  // verify-payment and create-order return amounts in paise (the database's
  // unit); the success screen and the purchase event take rupees. Passing the
  // paise through showed "Total paid ₹22900" for a ₹229 order (2026-10-20).
  function markSuccess(orderCode, qty, payload, verification) {
    if (typeof window.showSuccess !== 'function') return;
    var paise = Number((verification && verification.amount) || (payload && payload.amount) || 0);
    window.showSuccess(orderCode, 'razorpay', {
      amount: paise > 0 ? paise / 100 : undefined,
      qty: qty,
      email: payload && payload.email,
      name: payload && payload.address && payload.address.name,
      paymentId: (verification && verification.razorpayPaymentId) || '',
      orderToken: (verification && verification.orderToken) || '',
      confirmationToken: (verification && verification.confirmationToken) || ''
    });
  }

  async function verifyStandardPayment(created, payload, response) {
    if (finalizedThisCheckout) return true;
    if (!response || !response.razorpay_payment_id || !response.razorpay_order_id || !response.razorpay_signature) {
      throw new Error('Razorpay returned an incomplete payment response. Please contact support if money was deducted.');
    }

    var verifyResponse = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        orderCode: created.order_code,
        orderToken: created.order_token,
        phone: payload.phone,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      })
    });

    var result = await verifyResponse.json().catch(function () { return {}; });
    if (!verifyResponse.ok || result.verified !== true) {
      throw new Error(result.error || 'Payment completed but could not be confirmed yet. Please retry or contact support.');
    }

    finalizedThisCheckout = true;
    razorpayInFlight = false;
    setButtonState(false);
    markSuccess(result.orderId || created.order_code, payload.items[0].quantity, payload, {
      amount: Number(result.amount || created.amount),
      razorpayPaymentId: result.razorpayPaymentId || response.razorpay_payment_id,
      orderToken: result.orderToken || created.order_token,
      confirmationToken: result.confirmationToken || created.confirmation_token
    });
    return true;
  }

  async function startRazorpay() {
    if (razorpayInFlight) return;
    hidePaymentError();
    installCheckoutOverrides();

    if (typeof window.validateForm === 'function' && !window.validateForm()) return;

    razorpayInFlight = true;
    finalizedThisCheckout = false;
    setButtonState(true);

    var payload = orderPayload();
    if (!isValidCheckoutEmail(payload.email)) {
      razorpayInFlight = false;
      setButtonState(false);
      showPaymentError('Enter a valid email so we can send your receipt and delivery updates.');
      return;
    }

    try {
      // The Razorpay script and our order request run side by side: whichever
      // is slower decides when the window opens, not the two added together.
      var sdkReady = getRazorpayReady();
      sdkReady.catch(function () {});
      var createResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Checkout-Version': 'standard-v4' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      var created = await createResponse.json().catch(function () { return {}; });
      if (!createResponse.ok || !created.order_id || !created.key_id) {
        throw new Error(created.error || 'Unable to create the payment order. Please try again.');
      }
      var RazorpayClass = await sdkReady;
      if (!RazorpayClass) throw new Error('Razorpay Checkout could not be loaded.');

      var options = {
        key: created.key_id,
        amount: Number(created.amount),
        currency: created.currency || 'INR',
        name: 'Smelloff',
        // UPI apps strip everything but letters, digits and spaces from this
        // (it becomes the payment remark), so keep it to those.
        description: 'ODORSTRIKE 50ml Fabric Odor Spray',
        // The brand icon, square as Razorpay's logo slot expects. It was the
        // bottle photo, which Razorpay crops into a tiny square.
        image: 'https://smelloff.in/assets/brand/icon-smelloff-256.png',
        order_id: created.order_id,
        prefill: {
          name: payload.address.name,
          email: payload.email,
          contact: '+91' + String(payload.phone || '').replace(/\D/g, '').slice(-10)
        },
        // Already entered in our form, so Razorpay shows them without asking again.
        readonly: { contact: true, email: true },
        notes: { smelloff_order_code: created.order_code, sku: 'OS-001-50ML' },
        // Signal Lime for the header and pay button; Carbon Black behind the
        // window, so it opens on the site's own dark instead of a grey scrim.
        theme: { color: '#B8FF57', backdrop_color: '#0A0A0A' },
        // UPI first: most Indian buyers pay that way. Cards, netbanking and
        // wallets still follow as Razorpay's default blocks.
        config: {
          display: {
            blocks: {
              upi: { name: 'Pay with UPI', instruments: [{ method: 'upi' }] }
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true }
          }
        },
        retry: { enabled: true, max_count: 4 },
        handler: async function (response) {
          setButtonState('Confirming your payment…');
          try {
            await verifyStandardPayment(created, payload, response);
          } catch (error) {
            razorpayInFlight = false;
            setButtonState(false);
            showPaymentError(error.message || 'Payment confirmation failed. Please contact support if money was deducted.');
          }
        },
        modal: {
          // Ask before closing, so a stray tap outside the window doesn't
          // throw away a payment in progress.
          confirm_close: true,
          ondismiss: function () {
            if (!finalizedThisCheckout) {
              razorpayInFlight = false;
              setButtonState(false);
              setPayNote('Payment not completed, and nothing was charged. Tap Pay to try again, or choose Cash on Delivery.');
            }
          }
        }
      };

      var rzp = new RazorpayClass(options);
      rzp.on('payment.failed', function (failure) {
        razorpayInFlight = false;
        setButtonState(false);
        var description = failure && failure.error && failure.error.description;
        showPaymentError(description || 'Payment failed. You can try again.');
      });
      rzp.open();
    } catch (error) {
      razorpayInFlight = false;
      setButtonState(false);
      showPaymentError(error.message || 'Unable to start secure checkout. Please try again.');
    }
  }

  window.startRazorpay = startRazorpay;
  installCheckoutOverrides();
})();

/* "On this page" on inner pages (.p-toc, chrome.css §12). Same behaviour as
   the blog's TOC in blog-share.js: an open rail from 960px, folded on
   phones until asked, and the section you're reading is highlighted. */
(function(){
  var toc = document.querySelector('.p-toc');
  if (!toc) return;
  var wide = window.matchMedia('(min-width: 960px)');
  var sync = function(){ if (wide.matches) toc.open = true; };
  sync();
  if (wide.addEventListener) wide.addEventListener('change', sync);

  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  var byId = {};
  var targets = links.map(function(a){
    var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (el) byId[el.id] = a;
    return el;
  }).filter(Boolean);
  if (!targets.length) return;
  var current = null, queued = false;
  var setActive = function(){
    queued = false;
    var line = window.innerHeight * 0.33, pick = targets[0].id;
    targets.forEach(function(t){ if (t.getBoundingClientRect().top <= line) pick = t.id; });
    if (current === pick) return;
    current = pick;
    links.forEach(function(a){
      var on = byId[pick] === a;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', function(){
    if (!queued) { queued = true; window.requestAnimationFrame(setActive); }
  }, { passive: true });
  setActive();
})();
