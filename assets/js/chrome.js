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

  var RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
  var razorpayReady = false;
  var razorpayLoading = false;

  function loadRazorpay(callback) {
    if (window.Razorpay) {
      razorpayReady = true;
      callback();
      return;
    }
    if (razorpayLoading) {
      var waitStart = Date.now();
      (function waitForIt() {
        if (window.Razorpay) {
          razorpayReady = true;
          callback();
        } else if (Date.now() - waitStart > 10000) {
          callback(new Error('Razorpay Checkout could not be loaded.'));
        } else {
          setTimeout(waitForIt, 50);
        }
      })();
      return;
    }
    razorpayLoading = true;
    var script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.id = 'razorpay-checkout-script';
    script.onload = function () {
      razorpayReady = true;
      callback();
    };
    script.onerror = function () {
      callback(new Error('Unable to load Razorpay Checkout. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  }

  function activePaymentMethod() {
    var active = document.querySelector('.pay-opt.active');
    return active ? String(active.getAttribute('data-method') || '').toLowerCase() : '';
  }

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

  function cleanupAfterSuccess() {
    try { localStorage.removeItem('smelloff_cart_v1'); } catch (e) { /* storage blocked */ }
    var badgeEl = document.getElementById('cartCount');
    if (badgeEl) {
      badgeEl.textContent = '0';
      badgeEl.setAttribute('data-empty', '1');
    }
  }

  function markSuccess(orderCode, amountRupees, qty, paymentId, email, name) {
    cleanupAfterSuccess();
    if (typeof window.trackPurchase === 'function') {
      try { window.trackPurchase(amountRupees, orderCode); } catch (e) { /* analytics must not block fulfilment */ }
    }
    if (typeof window.soAttachOrder === 'function') {
      try { window.soAttachOrder(orderCode, amountRupees, qty, 'razorpay'); } catch (e) { /* partner tracking must not block fulfilment */ }
    }
    if (typeof window.logOrderToSheets === 'function' && typeof window.collectOrder === 'function') {
      try { window.logOrderToSheets(window.collectOrder(orderCode, 'RZP_PAID')); } catch (e) { /* legacy logging is best-effort */ }
    }
    if (email && typeof window.SmelloffEmail !== 'undefined' && window.SmelloffEmail && typeof window.SmelloffEmail.send === 'function') {
      try {
        window.SmelloffEmail.send('orderConfirmation', email, {
          orderId: orderCode,
          customerName: name || 'there',
          amount: String(amountRupees),
          codFee: 0,
          address: [textValue('f_addr'), textValue('f_city'), textValue('f_state'), textValue('f_pin')].filter(Boolean).join(', '),
          paymentMethod: 'UPI (Razorpay)'
        });
      } catch (e) { /* confirmation email is best-effort */ }
    }
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(orderCode, 'upi');
      var heading = document.getElementById('successHeading');
      var msg = document.getElementById('successMsg');
      var upiBlock = document.getElementById('upiBlock');
      var track = document.getElementById('successTrackLink');
      var note = document.getElementById('successEmailNote');
      if (heading) heading.textContent = 'Payment confirmed.';
      if (msg) msg.textContent = 'Your ODORSTRIKE order is confirmed. We’ll ship within 48 hours.';
      if (upiBlock) upiBlock.style.display = 'none';
      if (track) track.style.display = 'inline-block';
      if (note && email) note.style.display = 'block';
      var id = document.getElementById('orderIdDisplay');
      if (id) id.textContent = orderCode;
    }
  }

  async function startRazorpay() {
    hidePaymentError();
    if (typeof window.validateForm === 'function' && !window.validateForm()) return;
    setButtonState(true);

    var payload = orderPayload();
    if (!Number.isSafeInteger(payload.amount) || payload.amount < 100) {
      setButtonState(false);
      showPaymentError('Invalid payment amount. Please refresh and try again.');
      return;
    }

    loadRazorpay(function (loadError) {
      if (loadError) {
        setButtonState(false);
        showPaymentError(loadError.message || 'Razorpay Checkout could not be loaded.');
        return;
      }

      (async function () {
        try {
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
                setButtonState(false);
                markSuccess(created.order_code, Number(payload.amount) / 100, payload.items[0].quantity, response.razorpay_payment_id, payload.email, payload.address.name);
              } catch (error) {
                setButtonState(false);
                showPaymentError(error.message || 'Payment verification failed. Please contact support with your payment ID.');
              }
            }
          };

          var rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (failure) {
            setButtonState(false);
            var description = failure && failure.error && failure.error.description;
            showPaymentError(description || 'Payment failed. You can try again.');
          });
          rzp.open();
        } catch (error) {
          setButtonState(false);
          showPaymentError(error.message || 'Unable to start payment. Please try again.');
        }
      })();
    });
  }

  // Intercept only prepaid/UPI. COD remains on the existing submitOrder().
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('#submitBtn') : null;
    if (!target || activePaymentMethod() !== 'prepaid') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startRazorpay();
  }, true);

  // Replace the old manual-UTR panel copy whenever the customer selects prepaid.
  function refreshPrepaidPanel() {
    if (activePaymentMethod() !== 'prepaid') return;
    var panel = document.getElementById('upiPayPanel');
    if (!panel || panel.getAttribute('data-rzp-modernized') === '1') return;
    panel.setAttribute('data-rzp-modernized', '1');
    panel.innerHTML = '<div class="upi-panel-title">SECURE PREPAID CHECKOUT</div>' +
      '<p class="pay-help" style="margin-top:12px">You\'ll complete payment securely inside Razorpay using UPI, cards, net banking or supported payment methods.</p>' +
      '<p class="pay-help" style="margin-top:8px;color:var(--acid)">No UPI ID, screenshot or UTR entry is required.</p>';
  }
  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest && event.target.closest('.pay-opt')) {
      setTimeout(refreshPrepaidPanel, 0);
    }
  });

  // Preload the hosted Checkout script while the customer is reading checkout.
  loadRazorpay(function () {});
})();
