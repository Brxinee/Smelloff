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

  var burger = document.querySelector('.sf-burger');
  var menu = document.getElementById('sfMenu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Open menu');
        burger.focus();
      }
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

      var script = document.querySelector('script[src="' + RAZORPAY_SCRIPT + '"]');
      if (!script) {
        script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT;
        script.async = true;
        script.setAttribute('data-smelloff-razorpay', 'standard');
        script.addEventListener('load', succeed, { once: true });
        script.addEventListener('error', failLoad, { once: true });
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', succeed, { once: true });
        script.addEventListener('error', failLoad, { once: true });
        // The script may already have completed before this listener attached.
        window.setTimeout(succeed, 0);
      }
    }).catch(function (error) {
      window.smfRazorpayReady = null;
      throw error;
    });

    return window.smfRazorpayReady;
  }

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

  function orderPayload() {
    var qty = quantityFromCheckout();
    var unitPrice = Number(unitPriceRupees());
    return {
      email: normalizeEmail(textValue('f_email')),
      phone: textValue('f_phone'),
      items: [{
        name: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.productName) || 'ODORSTRIKE Fabric Mist',
        variant: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.size) || '50ml',
        quantity: qty,
        price: unitPrice
      }],
      amount: Math.round(unitPrice * qty * 100),
      payment_method: 'pending',
      address: {
        name: textValue('f_name'),
        line: textValue('f_addr'),
        city: textValue('f_city'),
        state: textValue('f_state'),
        pincode: textValue('f_pin')
      },
      order_code: clientOrderCode(),
      event_source_url: window.location.href
    };
  }

  function setButtonState(loading) {
    var btn = document.getElementById('submitBtn');
    var label = document.getElementById('submitText');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (label) label.textContent = loading
      ? 'Opening secure checkout…'
      : 'BUY ODORSTRIKE · ₹' + (unitPriceRupees() * quantityFromCheckout());
  }

  function showPaymentError(message) {
    var safeMessage = String(message || 'Unable to start secure checkout. Please try again.');
    if (typeof window.showError === 'function') { window.showError(safeMessage); return; }
    var error = document.getElementById('checkoutError');
    if (error) { error.textContent = safeMessage; error.style.display = 'block'; }
    else window.alert(safeMessage);
  }

  function hidePaymentError() {
    if (typeof window.hideError === 'function') window.hideError();
    var error = document.getElementById('checkoutError');
    if (error) error.style.display = 'none';
  }

  function normalizeCheckoutUi() {
    var paymentOptions = document.querySelectorAll('.pay-opt');
    for (var i = 0; i < paymentOptions.length; i++) {
      paymentOptions[i].hidden = true;
      paymentOptions[i].setAttribute('aria-hidden', 'true');
      paymentOptions[i].tabIndex = -1;
    }
    if (paymentOptions.length) {
      var parent = paymentOptions[0].parentElement;
      if (parent && parent.querySelectorAll('.pay-opt').length === paymentOptions.length) parent.hidden = true;
    }

    ['upiPayPanel', 'codPayPanel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
    });
    document.querySelectorAll('#upiInlineId, #wa-utr-btn, .upi-cta, #openUpiApp').forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      if ('tabIndex' in el) el.tabIndex = -1;
    });

    var modes = document.querySelector('.pay-modes');
    if (modes) modes.textContent = 'Secure Razorpay Checkout · UPI / Cards / Netbanking';

    var totalEl = document.getElementById('checkoutTotal');
    var submitText = document.getElementById('submitText');
    var baseTotal = unitPriceRupees() * quantityFromCheckout();
    if (totalEl) totalEl.textContent = '₹' + baseTotal;
    if (submitText && !checkoutButton.disabled) submitText.textContent = 'BUY ODORSTRIKE · ₹' + baseTotal;

    var codFeeRow = document.getElementById('codFeeRow');
    if (codFeeRow) codFeeRow.style.display = 'none';
  }

  function installCheckoutOverrides() {
    normalizeCheckoutUi();

    checkoutButton.onclick = function () {
      return window.startRazorpay();
    };
    checkoutButton.setAttribute('type', 'button');

    if (typeof window.submitOrder === 'function' && !window.__smfStandardSubmitInstalled) {
      window.__smfStandardSubmitInstalled = true;
      window.submitOrder = function () { return window.startRazorpay(); };
    }

    if (typeof window.openCheckout === 'function' && !window.__smfStandardOpenInstalled) {
      var originalOpenCheckout = window.openCheckout;
      window.__smfStandardOpenInstalled = true;
      window.openCheckout = function () {
        var result = originalOpenCheckout.apply(this, arguments);
        normalizeCheckoutUi();
        window.requestAnimationFrame(normalizeCheckoutUi);
        [50, 150, 300, 750, 1500].forEach(function (delay) {
          window.setTimeout(normalizeCheckoutUi, delay);
        });
        return result;
      };
    }
  }

  function markSuccess(orderCode, qty, payload, verification) {
    if (typeof window.showSuccess !== 'function') return;
    window.showSuccess(orderCode, 'razorpay', {
      amount: Number((verification && verification.amount) || (payload && payload.amount) || 0),
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
      var RazorpayClass = await getRazorpayReady();
      if (!RazorpayClass) throw new Error('Razorpay Checkout could not be loaded.');

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

      var options = {
        key: created.key_id,
        amount: Number(created.amount),
        currency: created.currency || 'INR',
        name: 'Smelloff',
        description: 'ODORSTRIKE 50ml — Fabric odor-control mist',
        image: 'https://smelloff.in/assets/odorstrike-bottle.webp',
        order_id: created.order_id,
        prefill: {
          name: payload.address.name,
          email: payload.email,
          contact: '+91' + String(payload.phone || '').replace(/\D/g, '').slice(-10)
        },
        notes: { smelloff_order_code: created.order_code, sku: 'OS-001-50ML' },
        theme: { color: '#B8FF57' },
        retry: { enabled: true, max_count: 4 },
        handler: async function (response) {
          try {
            await verifyStandardPayment(created, payload, response);
          } catch (error) {
            razorpayInFlight = false;
            setButtonState(false);
            showPaymentError(error.message || 'Payment confirmation failed. Please contact support if money was deducted.');
          }
        },
        modal: {
          ondismiss: function () {
            if (!finalizedThisCheckout) {
              razorpayInFlight = false;
              setButtonState(false);
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
