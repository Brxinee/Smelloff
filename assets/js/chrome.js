/* =====================================================================
   Smelloff — shared site chrome behaviour  (v3, 2026-09-17)
   =====================================================================
   Shared header/menu/cart behaviour plus Razorpay Magic Checkout for the
   existing product checkout overlay.

   IMPORTANT:
   - The website shows one purchase action only.
   - Payment-method selection belongs inside Razorpay Magic Checkout.
   - The website's base total remains the product subtotal (₹229 × qty).
   - COD is enabled and priced through Magic Checkout's shipping-info API.
   - Legacy/manual UPI/COD controls are neutralised on the active checkout,
     while historical/legal/backend references remain untouched.
   ===================================================================== */
(function () {
  'use strict';

  /* --- burger ------------------------------------------------------- */
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

  /* --- cart badge --------------------------------------------------- */
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

  /* --- current page ------------------------------------------------- */
  var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (path.length > 1) path = path.replace(/\/$/, '');
  var links = document.querySelectorAll('.sf-nav a[href], .sf-hdr__menu a[href]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (!href || href.charAt(0) !== '/') continue;
    var norm = href.split(/[?#]/)[0].replace(/\/$/, '');
    if (norm === path || (norm !== '' && path.indexOf(norm + '/') === 0)) {
      links[i].setAttribute('aria-current', 'page');
    }
  }

  /* --- product checkout integration ------------------------------- */
  var checkoutButton = document.getElementById('submitBtn');
  if (!checkoutButton) return;

  function getMagicCheckoutReady() {
    if (window.smfMagicRazorpayReady) return window.smfMagicRazorpayReady;
    window.smfMagicRazorpayReady = new Promise(function (resolve, reject) {
      var magicScript = document.querySelector('script[src*="/v1/magic-checkout.js"]');
      if (magicScript && window.Razorpay && magicScript.dataset.smfLoaded === 'true') {
        resolve(window.Razorpay);
        return;
      }
      if (!magicScript) {
        magicScript = document.createElement('script');
        magicScript.src = 'https://checkout.razorpay.com/v1/magic-checkout.js';
        magicScript.async = true;
        magicScript.crossOrigin = 'anonymous';
        document.head.appendChild(magicScript);
      }
      magicScript.addEventListener('load', function () {
        magicScript.dataset.smfLoaded = 'true';
        if (window.Razorpay) resolve(window.Razorpay);
        else reject(new Error('Razorpay Magic Checkout loaded without window.Razorpay.'));
      }, { once: true });
      magicScript.addEventListener('error', function () {
        window.smfMagicRazorpayReady = null;
        reject(new Error('Unable to load Razorpay Magic Checkout. Please try again.'));
      }, { once: true });
      if (magicScript.readyState === 'complete' && window.Razorpay) {
        magicScript.dataset.smfLoaded = 'true';
        resolve(window.Razorpay);
      }
    });
    return window.smfMagicRazorpayReady;
  }

  var razorpayInFlight = false;

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

  function orderPayload() {
    var qty = quantityFromCheckout();
    var unitPrice = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES && window.SMELLOFF_CONFIG.PRICES.solo) ||
                    (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.pricePrepaid) ||
                    (window.SMELLOFF_TRUTH && window.SMELLOFF_TRUTH.pricePrepaid) || 229;
    var amountPaise = Math.round(unitPrice * qty * 100);
    return {
      email: normalizeEmail(textValue('f_email')),
      phone: textValue('f_phone'),
      items: [{
        name: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.productName) || 'ODORSTRIKE Fabric Mist',
        variant: (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.size) || '50ml',
        quantity: qty,
        price: unitPrice
      }],
      amount: amountPaise,
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
    if (label) {
      if (loading) {
        label.textContent = 'Opening secure checkout…';
      } else {
        var qty = quantityFromCheckout();
        var unitPrice = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES && window.SMELLOFF_CONFIG.PRICES.solo) ||
                        (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.pricePrepaid) || 229;
        label.textContent = 'BUY ODORSTRIKE · ₹' + (unitPrice * qty);
      }
    }
  }

  function showPaymentError(message) {
    if (typeof window.showError === 'function') {
      window.showError(message);
      return;
    }
    var error = document.getElementById('checkoutError');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    } else {
      window.alert(message);
    }
  }

  function hidePaymentError() {
    if (typeof window.hideError === 'function') window.hideError();
    var error = document.getElementById('checkoutError');
    if (error) error.style.display = 'none';
  }

  function normalizeCheckoutUi() {
    /* Hide only the obsolete website-level payment selector/panels. */
    var paymentOptions = document.querySelectorAll('.pay-opt');
    if (paymentOptions.length) {
      var first = paymentOptions[0];
      var parent = first.parentElement;
      for (var i = 0; i < paymentOptions.length; i++) {
        paymentOptions[i].hidden = true;
        paymentOptions[i].setAttribute('aria-hidden', 'true');
      }
      if (parent) {
        var all = parent.querySelectorAll('.pay-opt');
        if (all.length === paymentOptions.length) parent.hidden = true;
      }
    }

    var upiPanel = document.getElementById('upiPayPanel');
    var codPanel = document.getElementById('codPayPanel');
    if (upiPanel) { upiPanel.hidden = true; upiPanel.setAttribute('aria-hidden', 'true'); }
    if (codPanel) { codPanel.hidden = true; codPanel.setAttribute('aria-hidden', 'true'); }

    document.querySelectorAll('#upiInlineId, #wa-utr-btn, .upi-cta, #openUpiApp').forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });

    var modes = document.querySelector('.pay-modes');
    if (modes) modes.textContent = 'Secure Razorpay Checkout';

    var qty = quantityFromCheckout();
    var unitPrice = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES && window.SMELLOFF_CONFIG.PRICES.solo) ||
                    (window.SMELLOFF_PRODUCT_TRUTH && window.SMELLOFF_PRODUCT_TRUTH.pricePrepaid) || 229;
    var baseTotal = unitPrice * qty;

    var totalEl = document.getElementById('checkoutTotal');
    if (totalEl) totalEl.textContent = '₹' + baseTotal;
    var submitText = document.getElementById('submitText');
    if (submitText && !checkoutButton.disabled) submitText.textContent = 'BUY ODORSTRIKE · ₹' + baseTotal;
  }

  function installCheckoutOverrides() {
    normalizeCheckoutUi();

    /* The legacy inline checkout function chooses a payment method before
       checkout. Replace only that public entry point; keep the form markup
       and visual design untouched. */
    if (typeof window.submitOrder === 'function' && !window.__smfMagicSubmitInstalled) {
      window.__smfMagicSubmitInstalled = true;
      window.submitOrder = function () {
        return window.startRazorpay();
      };
    }

    if (typeof window.openCheckout === 'function' && !window.__smfMagicOpenInstalled) {
      var originalOpenCheckout = window.openCheckout;
      window.__smfMagicOpenInstalled = true;
      window.openCheckout = function () {
        var result = originalOpenCheckout.apply(this, arguments);
        window.requestAnimationFrame(normalizeCheckoutUi);
        window.setTimeout(normalizeCheckoutUi, 0);
        window.setTimeout(normalizeCheckoutUi, 50);
        return result;
      };
    }
  }

  function markSuccess(orderCode, amountRupees, qty, paymentId, email, name, orderToken, confirmationToken, method) {
    if (typeof window.logOrderToSheets === 'function' && typeof window.collectOrder === 'function') {
      try { window.logOrderToSheets(window.collectOrder(orderCode, method === 'cod' ? 'COD' : 'RZP_PAID')); } catch (e) { /* best effort */ }
    }
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(orderCode, method === 'cod' ? 'cod' : 'razorpay', {
        amount: amountRupees,
        qty: qty,
        email: email,
        name: name,
        paymentId: paymentId || '',
        orderToken: orderToken || '',
        confirmationToken: confirmationToken || ''
      });
    }
  }

  async function startRazorpay() {
    if (razorpayInFlight) return;
    hidePaymentError();
    installCheckoutOverrides();
    if (typeof window.validateForm === 'function' && !window.validateForm()) return;

    razorpayInFlight = true;
    setButtonState(true);

    var payload = orderPayload();
    if (!isValidCheckoutEmail(payload.email)) {
      razorpayInFlight = false;
      setButtonState(false);
      showPaymentError('Enter a valid email so we can send your receipt and delivery updates.');
      return;
    }

    try {
      var RazorpayClass = await getMagicCheckoutReady();
      if (!RazorpayClass) throw new Error('Razorpay Magic Checkout could not be loaded.');

      var createResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      var created = await createResponse.json().catch(function () { return {}; });
      if (!createResponse.ok || !created.order_id) {
        throw new Error(created.error || 'Unable to create the payment order. Please try again.');
      }

      var options = {
        key: created.key_id,
        one_click_checkout: true,
        amount: created.amount,
        currency: created.currency || 'INR',
        name: 'Smelloff',
        description: 'ODORSTRIKE 50ml — Fabric Odor Mist',
        order_id: created.order_id,
        show_coupons: false,
        prefill: {
          name: payload.address.name,
          email: payload.email,
          contact: '+91' + String(payload.phone || '').replace(/\D/g, '').slice(-10)
        },
        notes: {
          smelloff_order_code: created.order_code
        },
        theme: { color: '#B8FF57' },
        modal: {
          ondismiss: function () {
            razorpayInFlight = false;
            setButtonState(false);
            normalizeCheckoutUi();
          }
        },
        handler: async function (response) {
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
                razorpay_order_id: response && response.razorpay_order_id,
                razorpay_signature: response && response.razorpay_signature
              })
            });
            var finalized = await finalizeResponse.json().catch(function () { return {}; });
            if (!finalizeResponse.ok || !finalized.finalized) {
              throw new Error(finalized.error || 'We could not confirm the order yet. Please do not place it again.');
            }
            razorpayInFlight = false;
            setButtonState(false);
            markSuccess(
              created.order_code,
              Number(finalized.amount) / 100,
              Number(finalized.quantity || payload.items[0].quantity),
              finalized.payment_id || (response && response.razorpay_payment_id) || '',
              payload.email,
              payload.address.name,
              finalized.order_token || created.order_token,
              finalized.confirmation_token || created.confirmation_token,
              finalized.payment_method || 'razorpay'
            );
          } catch (error) {
            razorpayInFlight = false;
            setButtonState(false);
            showPaymentError(error.message || 'Order confirmation failed. Please contact support with your order number.');
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

  /* Install after the legacy inline page code has defined its checkout
     functions. The page keeps the original UI; this layer only neutralises
     the obsolete payment selector and routes the one button to Magic. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCheckoutOverrides, { once: true });
  } else {
    installCheckoutOverrides();
  }
})();
