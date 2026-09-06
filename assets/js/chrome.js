/* =====================================================================
   Smelloff — shared site chrome behaviour  (v2, 2026-09-06)
   =====================================================================
   Shared header/menu/cart behaviour plus Razorpay Standard Checkout for the
   existing checkout overlay. COD remains on the existing flow; prepaid/UPI
   is intercepted and sent through Razorpay so the page no longer asks for a
   manual UTR after payment.
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

  /* --- Razorpay Standard Checkout ---------------------------------- */
  var checkoutButton = document.getElementById('submitBtn');
  if (!checkoutButton) return;

  function getRazorpayReady() {
    if (window.Razorpay) {
      window.smfRazorpayReady = Promise.resolve(window.Razorpay);
      return window.smfRazorpayReady;
    }
    if (window.smfRazorpayReady) return window.smfRazorpayReady;
    window.smfRazorpayReady = new Promise(function (resolve, reject) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      var script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (!script) {
        window.smfRazorpayReady = null;
        reject(new Error('Razorpay Checkout script is missing.'));
        return;
      }
      script.addEventListener('load', function () {
        if (window.Razorpay) {
          resolve(window.Razorpay);
        } else {
          window.smfRazorpayReady = null;
          reject(new Error('Razorpay loaded without window.Razorpay.'));
        }
      }, { once: true });
      script.addEventListener('error', function () {
        window.smfRazorpayReady = null;
        reject(new Error('Unable to load Razorpay Checkout. Check your connection and try again.'));
      }, { once: true });
    });
    return window.smfRazorpayReady;
  }

  // Eagerly initialize readiness check
  getRazorpayReady();

  var razorpayInFlight = false;

  function textValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function numberFromText(id) {
    var raw = textValue(id).replace(/,/g, '');
    var match = raw.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function quantityFromCheckout() {
    var variant = textValue('checkoutVariant');
    var match = variant.match(/(\d+)\s*[×x]/i);
    if (match) return Math.max(1, Math.min(5, Number(match[1])));
    try {
      var stored = parseInt(localStorage.getItem('smelloff_cart_v1'), 10);
      if (Number.isInteger(stored) && stored > 0) return Math.min(5, stored);
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
    var subtotal = numberFromText('checkoutAmount');
    var amountRupees = subtotal > 0 ? subtotal : (229 * qty);
    var amountPaise = Math.round(amountRupees * 100);
    return {
      email: textValue('f_email') || null,
      phone: textValue('f_phone'),
      items: [{
        name: 'ODORSTRIKE Fabric Mist',
        variant: '50ml',
        quantity: qty,
        price: 229
      }],
      amount: amountPaise,
      payment_method: 'upi',
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
    if (label) label.textContent = loading ? 'Opening secure checkout…' : 'Pay securely';
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

  function markSuccess(orderCode, amountRupees, qty, paymentId, email, name) {
    if (typeof window.logOrderToSheets === 'function' && typeof window.collectOrder === 'function') {
      try { window.logOrderToSheets(window.collectOrder(orderCode, 'RZP_PAID')); } catch (e) { /* legacy logging is best-effort */ }
    }
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(orderCode, 'razorpay', {
        amount: amountRupees,
        qty: qty,
        email: email,
        name: name,
        paymentId: paymentId
      });
    }
  }

  async function startRazorpay() {
    if (razorpayInFlight) return;
    hidePaymentError();
    if (typeof window.validateForm === 'function' && !window.validateForm()) return;

    razorpayInFlight = true;
    setButtonState(true);

    var payload = orderPayload();
    if (!Number.isSafeInteger(payload.amount) || payload.amount < 100) {
      razorpayInFlight = false;
      setButtonState(false);
      showPaymentError('Invalid payment amount. Please refresh and try again.');
      return;
    }

    try {
      var RazorpayClass = await getRazorpayReady();
      if (!RazorpayClass) {
        throw new Error('Razorpay Checkout could not be loaded.');
      }

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
        amount: created.amount,
        currency: created.currency || 'INR',
        name: 'Smelloff',
        description: 'ODORSTRIKE 50ml — Fabric Odor Mist',
        order_id: created.order_id,
        image: 'https://smelloff.in/apple-touch-icon.png',
        prefill: {
          name: payload.address.name,
          email: payload.email || undefined,
          contact: payload.phone
        },
        notes: {
          smelloff_order_code: created.order_code
        },
        theme: { color: '#B8FF57' },
        modal: {
          ondismiss: function () {
            razorpayInFlight = false;
            setButtonState(false);
            if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
          }
        },
        handler: async function (response) {
          try {
            var verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({
                orderCode: created.order_code,
                phone: payload.phone,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            var verified = await verifyResponse.json().catch(function () { return {}; });
            if (!verifyResponse.ok || !verified.verified) {
              throw new Error(verified.error || 'Payment verification failed. Do not place the order again yet.');
            }
            razorpayInFlight = false;
            setButtonState(false);
            markSuccess(created.order_code, Number(payload.amount) / 100, payload.items[0].quantity, response.razorpay_payment_id, payload.email, payload.address.name);
          } catch (error) {
            razorpayInFlight = false;
            setButtonState(false);
            showPaymentError(error.message || 'Payment verification failed. Please contact support with your payment ID.');
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
      showPaymentError(error.message || 'Unable to start payment. Please try again.');
    }
  }

  window.startRazorpay = startRazorpay;
})();
