/* =====================================================================
   Smelloff — shared site chrome behaviour  (v3, 2026-09-17)
   =====================================================================
   Shared header/menu/cart behaviour plus Razorpay Checkout for the
   existing checkout overlay.

   Payment-method selection belongs inside Razorpay. The Smelloff page shows
   one purchase action and a ₹229 base total.
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

  function getRazorpayReady() {
    if (window.smfRazorpayReady) return window.smfRazorpayReady;
    window.smfRazorpayReady = new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve(window.Razorpay);
      var script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (script) {
        script.addEventListener('load', function () {
          if (window.Razorpay) resolve(window.Razorpay);
          else reject(new Error('Razorpay SDK loaded without window.Razorpay.'));
        }, { once: true });
        script.addEventListener('error', function () {
          reject(new Error('Unable to load Razorpay Checkout. Please try again.'));
        }, { once: true });
        return;
      }
      reject(new Error('Razorpay Checkout script not found.'));
    });
    return window.smfRazorpayReady;
  }

  var razorpayInFlight = false;
  var finalizeTimers = [];
  var finalizedThisCheckout = false;
  var checkoutUiTimer = null;

  function textValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function isValidCheckoutEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }

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
    var unitPrice = unitPriceRupees();
    var amountRupees = unitPrice * qty;
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
      order_code: clientOrderCode()
    };
  }

  function setButtonState(loading) {
    var btn = document.getElementById('submitBtn');
    var label = document.getElementById('submitText');
    if (!btn) return;
    btn.disabled = !!loading;
    if (label) label.textContent = loading
      ? 'Opening secure checkout…'
      : 'BUY ODORSTRIKE · ₹' + (unitPriceRupees() * quantityFromCheckout());
  }

  function showPaymentError(message) {
    if (typeof window.showError === 'function') { window.showError(message); return; }
    var error = document.getElementById('checkoutError');
    if (error) { error.textContent = message; error.style.display = 'block'; }
    else window.alert(message);
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

    if (typeof window.submitOrder === 'function' && !window.__smfMagicSubmitInstalled) {
      window.__smfMagicSubmitInstalled = true;
      window.submitOrder = function () { return window.startRazorpay(); };
    }
    if (typeof window.openCheckout === 'function' && !window.__smfMagicOpenInstalled) {
      var originalOpenCheckout = window.openCheckout;
      window.__smfMagicOpenInstalled = true;
      window.openCheckout = function () {
        var result = originalOpenCheckout.apply(this, arguments);
        normalizeCheckoutUi();
        window.requestAnimationFrame(normalizeCheckoutUi);
        [0, 50, 150, 300, 750, 1500].forEach(function (delay) {
          window.setTimeout(normalizeCheckoutUi, delay);
        });
        return result;
      };
    }
  }

  function clearFinalizeTimers() {
    for (var i = 0; i < finalizeTimers.length; i++) window.clearTimeout(finalizeTimers[i]);
    finalizeTimers = [];
    if (checkoutUiTimer) {
      window.clearInterval(checkoutUiTimer);
      checkoutUiTimer = null;
    }
  }

  function markSuccess(orderCode, qty, payload, finalized) {
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(orderCode, 'razorpay', {
        amount: Number((finalized && finalized.amount) || (payload && payload.amount) || 0),
        qty: qty,
        email: payload && payload.email,
        name: payload && payload.address && payload.address.name,
        paymentId: (finalized && finalized.payment_id) || '',
        orderToken: (finalized && finalized.order_token) || '',
        confirmationToken: (finalized && finalized.confirmation_token) || ''
      });
    }
  }

  function handleFinalized(finalized, payload) {
    if (!finalized || finalized.finalized !== true) return false;
    var method = String(finalized.payment_method || '').toLowerCase();
    if (!method) method = 'razorpay';
    finalizedThisCheckout = true;
    clearFinalizeTimers();
    razorpayInFlight = false;
    setButtonState(false);

    var qty = Number(finalized.quantity || (payload.items && payload.items[0] && payload.items[0].quantity) || 1);
    markSuccess(finalized.order_code || payload.order_code, qty, payload, finalized);
    return true;
  }

  async function finalizeMagicCheckout(created, payload, response) {
    if (finalizedThisCheckout) return true;
    try {
      var finalizeResponse = await fetch('/api/magic-checkout-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          orderCode: created.order_code,
          orderToken: created.order_token,
          phone: payload.phone,
          razorpay_payment_id: response && response.razorpay_payment_id,
          razorpay_order_id: (response && response.razorpay_order_id) || created.order_id,
          razorpay_signature: response && response.razorpay_signature
        })
      });
      var finalized = await finalizeResponse.json().catch(function () { return {}; });
      if (!finalizeResponse.ok && !finalized.pending) throw new Error(finalized.error || 'Unable to confirm the order.');
      return handleFinalized(finalized, payload);
    } catch (error) {
      if (!/not yet confirmed|still being initialized|not complete yet/i.test(String(error.message || ''))) {
        showPaymentError(error.message || 'Unable to confirm checkout. Please contact support with your order number.');
      }
      return false;
    }
  }

  function scheduleCodCompletionPolling(created, payload) {
    clearFinalizeTimers();
    [1200, 2500, 5000, 9000, 15000].forEach(function (delay) {
      finalizeTimers.push(window.setTimeout(async function () {
        if (finalizedThisCheckout) return;
        await finalizeMagicCheckout(created, payload, { razorpay_order_id: created.order_id });
      }, delay));
    });
  }

  async function startRazorpay() {
    if (razorpayInFlight) return;
    hidePaymentError();
    installCheckoutOverrides();
    if (typeof window.validateForm === 'function' && !window.validateForm()) return;

    razorpayInFlight = true;
    finalizedThisCheckout = false;
    clearFinalizeTimers();
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      var created = await createResponse.json().catch(function () { return {}; });
      if (!createResponse.ok || !created.order_id) throw new Error(created.error || 'Unable to create the payment order. Please try again.');

      var options = {
        key: created.key_id,
        one_click_checkout: true,
        name: 'Smelloff',
        order_id: created.order_id,
        show_coupons: false,
        prefill: {
          name: payload.address.name,
          email: payload.email,
          contact: '+91' + String(payload.phone || '').replace(/\D/g, '').slice(-10)
        },
        notes: { smelloff_order_code: created.order_code },
        theme: { color: '#B8FF57' },
        modal: {
          ondismiss: function () {
            if (!finalizedThisCheckout) scheduleCodCompletionPolling(created, payload);
          }
        },
        handler: async function (response) {
          var done = await finalizeMagicCheckout(created, payload, response);
          if (!done) scheduleCodCompletionPolling(created, payload);
        }
      };

      var rzp = new RazorpayClass(options);
      rzp.on('payment.failed', function (failure) {
        clearFinalizeTimers();
        razorpayInFlight = false;
        setButtonState(false);
        var description = failure && failure.error && failure.error.description;
        showPaymentError(description || 'Payment failed. You can try again.');
      });
      rzp.open();
    } catch (error) {
      clearFinalizeTimers();
      razorpayInFlight = false;
      setButtonState(false);
      showPaymentError(error.message || 'Unable to start secure checkout. Please try again.');
    }
  }

  window.startRazorpay = startRazorpay;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCheckoutOverrides, { once: true });
  else installCheckoutOverrides();
})();
