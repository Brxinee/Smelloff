(function(){
  if (!window.SMELLOFF_CONFIG) {
    window.SMELLOFF_CONFIG = {
      GA4_ID: "G-S1MJ58PD89",
      META_PIXEL_ID: "1455100092891684",
      SHEETS_ENDPOINT: "https://script.google.com/macros/s/AKfycbwvZamMivX4MF_jM83VjO3f8GDYmitlOxKkkXS2mSnivZ1wzps9ZolIQG2tvKMATIoh2Q/exec",
      WHATSAPP: "919392974031",
      UPI_ID: "mr.brainy@ibl",
      UPI_NAME: "Smelloff",
      PRICES: { solo: 229, duo: 429, trio: 599 },
      MRP:    { solo: 499, duo: 998, trio: 1497 },
      COD_FEE: 60,
      VERIFIED_REVIEWS: [],
      BOTTLES_SOLD: 0,
      SUPABASE_URL: 'https://tnuqjydmoxczdjnsgpci.supabase.co',
      SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4'
    };
  } else {
    var C = window.SMELLOFF_CONFIG;
    C.PRICES = C.PRICES || {};
    if (C.PRICES.duo == null) C.PRICES.duo = 429;
    if (C.PRICES.trio == null) C.PRICES.trio = 599;
    C.MRP = C.MRP || {};
    if (C.MRP.duo == null) C.MRP.duo = 998;
    if (C.MRP.trio == null) C.MRP.trio = 1497;
  }
  const CFG = window.SMELLOFF_CONFIG;
  // Active Commercial Bundles: Solo ₹229, Duo ₹429 (Save ₹29), Trio ₹599 (Save ₹88)
  const VARIANTS = {
    solo: { title: 'ODORSTRIKE 50ml', units: '1 × 50ml', amount: CFG.PRICES.solo, mrp: CFG.MRP.solo },
    duo:  { title: 'ODORSTRIKE 50ml Duo', units: '2 × 50ml', amount: CFG.PRICES.duo, mrp: CFG.MRP.duo },
    trio: { title: 'ODORSTRIKE 50ml Trio', units: '3 × 50ml', amount: CFG.PRICES.trio, mrp: CFG.MRP.trio }
  };
  // Surcharge for choosing Cash on Delivery. Read once here so the whole page has
  // one number; the static markup that quotes it is listed at CFG.COD_FEE.
  const COD_FEE = Number(CFG.COD_FEE) || 0;

  let currentVariant = 'solo';
  // Prepaid UPI is the friction-free default with Free Pan-India Shipping.
  let payMethod = 'prepaid'; // matches the default-active .pay-opt[data-method="prepaid"]
  // Quantity being checked out — sourced from the cart. Unit price stays ₹229
  // (single SKU); the order pipeline multiplies by this.
  let cartQty = 1;
  function unitPrice() { return Number(VARIANTS[currentVariant].amount) || 0; }

  // ============================================================
  // CART — ODORSTRIKE 50ml (Solo, Duo, Trio supported), quantity persists in localStorage.
  // Buy CTAs add to the cart and open the drawer; checkout reads cart qty.
  // ============================================================
  var CART_KEY = 'smelloff_cart_v1';
  function getCartQty() {
    try { var n = parseInt(localStorage.getItem(CART_KEY), 10); return n > 0 ? n : 0; }
    catch (e) { return 0; }
  }
  function setCartQty(n) {
    n = Math.max(0, Math.min(99, parseInt(n, 10) || 0));
    try { localStorage.setItem(CART_KEY, String(n)); } catch (e) {}
    renderCart();
  }
  // Restart the badge animation on a real increase only. Re-adding a class
  // that is already present does not replay a CSS animation, hence the
  // reflow read; and gating on "went up" keeps this as acknowledgement of
  // something the customer did, rather than a badge that twitches on every
  // render — including the render that empties it after a completed order.
  var _lastBadgeQty = null;
  function bumpCartBadge(badge, qty) {
    // The keyframes live inside prefers-reduced-motion:no-preference, so under
    // "reduce" no animation runs, animationend never fires, and the class
    // would sit on the badge forever. Don't add it in the first place.
    var mayAnimate = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (mayAnimate && _lastBadgeQty !== null && qty > _lastBadgeQty) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
      // Clear it once it has played, so the badge is not left carrying a
      // spent animation class between renders.
      badge.addEventListener('animationend', function handler() {
        badge.classList.remove('bump');
        badge.removeEventListener('animationend', handler);
      });
    }
    _lastBadgeQty = qty;
  }

  function renderCart() {
    var qty = getCartQty();
    var badge = document.getElementById('cartCount') || document.getElementById('sfCartCount');
    if (badge) {
      badge.textContent = String(qty);
      badge.setAttribute('data-empty', qty > 0 ? '0' : '1');
      bumpCartBadge(badge, qty);
    }
    var empty = document.getElementById('cartEmpty');
    var line = document.getElementById('cartLine');
    var foot = document.getElementById('cartFoot');
    var hasItems = qty > 0;
    if (empty) empty.style.display = hasItems ? 'none' : 'block';
    if (line) line.style.display = hasItems ? 'flex' : 'none';
    if (foot) foot.style.display = hasItems ? 'block' : 'none';
    if (hasItems) {
      var sub = 229;
      var unitText = '1 × 50ml Bottle · ₹229';
      var nameText = 'ODORSTRIKE 50ml';
      if (qty === 1) {
        sub = 229;
        unitText = '1 × 50ml Bottle · ₹229';
        nameText = 'ODORSTRIKE 50ml';
      } else if (qty === 2) {
        sub = 429;
        unitText = '2 × 50ml Bottles (Duo Pack · Save ₹29) · ₹429';
        nameText = 'ODORSTRIKE 50ml (Duo)';
      } else if (qty === 3) {
        sub = 599;
        unitText = '3 × 50ml Bottles (Trio Pack · Save ₹88) · ₹599';
        nameText = 'ODORSTRIKE 50ml (Trio)';
      } else {
        sub = 229 * qty;
        unitText = qty + ' × 50ml Bottles · ₹' + sub;
        nameText = 'ODORSTRIKE 50ml (' + qty + ' Pack)';
      }
      var qv = document.getElementById('cartQtyVal'); if (qv) qv.textContent = String(qty);
      var st = document.getElementById('cartSubtotal'); if (st) st.textContent = '₹' + sub;
      var ca = document.getElementById('cartCheckoutAmt'); if (ca) ca.textContent = '₹' + sub;
      var lnName = document.querySelector('#cartLine .cart-line-name');
      if (lnName) lnName.textContent = nameText;
      var unit = document.querySelector('#cartLine .cart-line-unit');
      if (unit) unit.textContent = unitText;
    }
  }
  // One switch for "a modal owns the screen": locks scroll and drops the
  // consent bar, which is z-index:9999 and was covering the checkout's submit
  // button on every phone size. Always recomputed from what is actually open,
  // so closing the drawer while checkout is still up doesn't unlock the page.
  function syncModalState() {
    var open = ['checkoutOverlay', 'cartOverlay', 'paymentFailedOverlay'].some(function (id) {
      var el = document.getElementById(id);
      return el && el.classList.contains('active');
    }) || (function () {
      var gv = document.getElementById('galViewer');
      return !!gv && gv.classList.contains('active');
    })();
    document.body.style.overflow = open ? 'hidden' : '';
    document.documentElement.classList.toggle('sf-modal-open', open);
    return open;
  }
  window.syncModalState = syncModalState;

  var _cartTrigger = null;
  function openCartDrawer() {
    _cartTrigger = document.activeElement;
    renderCart();
    var ov = document.getElementById('cartOverlay');
    if (ov) ov.classList.add('active');
    syncModalState();
    trapFocusInCartDrawer();
    setTimeout(function() {
      var closeBtn = ov ? ov.querySelector('.cart-close') : null;
      if (closeBtn) closeBtn.focus();
    }, 60);
  }
  function closeCartDrawer() {
    var ov = document.getElementById('cartOverlay');
    if (ov) ov.classList.remove('active');
    syncModalState();
    if (_cartTrigger && typeof _cartTrigger.focus === 'function') {
      setTimeout(function() { _cartTrigger.focus(); _cartTrigger = null; }, 50);
    }
  }
  var _cartFocusTrapHandler = null;
  function trapFocusInCartDrawer() {
    var overlay = document.getElementById('cartOverlay');
    if (!overlay) return;
    if (_cartFocusTrapHandler) overlay.removeEventListener('keydown', _cartFocusTrapHandler);
    var visibleFocusable = function () {
      var all = overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      return Array.prototype.filter.call(all, function (el) {
        return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
    };
    _cartFocusTrapHandler = function(e) {
      if (e.key !== 'Tab') return;
      var f = visibleFocusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (f.indexOf(document.activeElement) === -1) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    overlay.addEventListener('keydown', _cartFocusTrapHandler);
  }

  // Mirror cart changes to the first-party beacon (assets/js/track.js) so the
  // admin's Carts tab sees live baskets and can recover abandoned ones.
  // Prices go over the wire in paise, matching orders.amount.
  function smfCartBeacon(type, contact) {
    if (typeof window.smfTrack !== 'function') return;
    try {
      var qty = getCartQty();
      var paise = unitPrice() * 100;
      var payload = {
        type: type,
        label: 'ODORSTRIKE Fabric Mist',
        value: paise,
        cart: {
          items: qty > 0 ? [{ name: 'ODORSTRIKE Fabric Mist', variant: '50ml', quantity: qty, price: paise }] : [],
          item_count: qty,
          total: paise * qty,
          currency: 'INR'
        }
      };
      if (contact) payload.cart.contact = contact;
      window.smfTrack(payload);
    } catch (e) {}
  }

  // "Buy now" is the express path: it goes STRAIGHT to checkout. It used to add
  // a unit and open the cart drawer instead, which meant every buy CTA on the
  // page — hero, pricing, final, sticky mobile bar — cost an extra click and an
  // extra decision before the form appeared. The drawer is still reachable from
  // the header cart and from "Add to cart"; it is just no longer in the way of
  // someone who has already decided.
  // Quantity chosen on the page, distinct from what is already in the cart —
  // stepping it must not light up the header badge before the shopper has
  // actually added anything. Single SKU, so both CTAs SET the cart to this
  // number rather than adding to it; pressing "Add to cart" twice on a
  // one-product store should not silently mean four bottles.
  var pdpQty = 1;
  function renderPdpQty() {
    var v = document.getElementById('pdpQtyVal');
    if (v) v.textContent = String(pdpQty);
    var t = document.getElementById('pdpBuyText');
    var bundleTotal = 229;
    if (pdpQty === 2) bundleTotal = 429;
    else if (pdpQty === 3) bundleTotal = 599;
    else bundleTotal = 229 * pdpQty;
    if (t) t.textContent = 'Buy now · ₹' + bundleTotal;
    var dec = document.getElementById('pdpQtyDec');
    if (dec) dec.disabled = pdpQty <= 1;
  }
  function pdpQtyStep(d) {
    pdpQty = Math.max(1, Math.min(5, pdpQty + d));
    renderPdpQty();
  }
  function buyNow() {
    setCartQty(Math.max(1, Math.min(5, pdpQty)));
    trackAddToCart();
    smfCartBeacon('add_to_cart');
    closeCartDrawer();
    openCheckout('solo');
  }
  // "Add to cart" is the browse path: add a unit and show the drawer, so the
  // qty controls and the subtotal are visible and the page stays behind it.
  function addToCart() {
    setCartQty(Math.max(1, Math.min(5, pdpQty)));
    trackAddToCart();
    smfCartBeacon('add_to_cart');
    openCartDrawer();
  }
  // Drawer qty changes mirror back into the PDP stepper, so the two controls
  // can never disagree about how many bottles are being bought.
  function syncPdpQtyFromCart() {
    var q = getCartQty();
    pdpQty = q > 0 ? Math.min(5, q) : 1;
    renderPdpQty();
  }
  function cartInc() { var next = Math.min(5, getCartQty() + 1); setCartQty(next); syncPdpQtyFromCart(); smfCartBeacon('cart_update'); }
  function cartDec() { var q = getCartQty(); if (q <= 1) setCartQty(0); else setCartQty(q - 1); syncPdpQtyFromCart(); smfCartBeacon('cart_update'); }
  function cartRemove() { setCartQty(0); syncPdpQtyFromCart(); smfCartBeacon('remove_from_cart'); }
  function checkoutFromCart() {
    var q = getCartQty();
    if (q < 1) return;
    cartQty = Math.min(5, q);
    closeCartDrawer();
    openCheckout('solo');
  }
  function buyQty(n) {
    pdpQty = Math.max(1, Math.min(5, parseInt(n, 10) || 1));
    setCartQty(pdpQty);
    renderPdpQty();
    buyNow();
  }
  window.openCartDrawer = openCartDrawer;
  window.closeCartDrawer = closeCartDrawer;
  window.buyNow = buyNow;
  window.buyQty = buyQty;
  window.addToCart = addToCart;
  window.pdpQtyStep = pdpQtyStep;
  window.cartInc = cartInc;
  window.cartDec = cartDec;
  window.cartRemove = cartRemove;
  window.checkoutFromCart = checkoutFromCart;

  // Transactional email client (Resend via /api/send-email).
  // keepalive: true so the request survives page navigation (e.g. UPI redirect).
  const SmelloffEmail = {
    send: function(type, to, data) {
      return fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, to: to, data: data || {} }),
        keepalive: true
      }).then(function(r){
        return r.json().then(function(j){
          if (!r.ok) {
            console.error('[Smelloff] Email send failed:', r.status, j);
            throw new Error(j.error || ('HTTP ' + r.status));
          }
          return j;
        });
      });
    }
  };
  window.SmelloffEmail = SmelloffEmail;

  // Free shipping baked in across India.
  function calcShipping(amount) { return 0; }

  var _checkoutTrigger = null;

  // The single arithmetic for a checkout: product price × quantity, plus the COD
  // surcharge when COD is the chosen method. Every figure the modal shows comes
  // from here, so the summary, the UPI panel, the COD panel and the submit button
  // cannot drift apart — which is exactly how they drifted before.
  function orderTotals() {
    const qty = cartQty > 0 ? cartQty : 1;
    let subtotal = 229;
    let savings = 0;
    if (qty === 1) { subtotal = 229; savings = 0; }
    else if (qty === 2) { subtotal = 429; savings = 29; }
    else if (qty === 3) { subtotal = 599; savings = 88; }
    else { subtotal = 229 * qty; savings = 0; }
    const unit = Math.round((subtotal / qty) * 100) / 100;
    const shipping = Number(calcShipping(subtotal)) || 0;
    const codFee = payMethod === 'cod' ? COD_FEE : 0;
    return { qty: qty, unit: unit, subtotal: subtotal, savings: savings, shipping: shipping,
             codFee: codFee, total: subtotal + shipping + codFee };
  }

  function renderCheckoutPrices() {
    const t = orderTotals();
    const isCod = payMethod === 'cod';
    const set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    var bundleTitle = '1 × 50ml Bottle';
    if (t.qty === 2) bundleTitle = '2 × 50ml Bottles (Duo Pack · Save ₹29)';
    else if (t.qty === 3) bundleTitle = '3 × 50ml Bottles (Trio Pack · Save ₹88)';
    else if (t.qty > 3) bundleTitle = t.qty + ' × 50ml Bottles';
    set('checkoutVariant', bundleTitle);
    set('checkoutAmount', '₹' + t.subtotal);
    set('checkoutShipping', 'Free ✓');
    set('checkoutCodFee', isCod ? '+₹' + COD_FEE : 'Not applied ✓');
    set('checkoutTotal', '₹' + t.total);
    // The UPI panel only ever shows the prepaid figure — no COD fee applies there.
    set('upiAmountInline', '₹' + (t.subtotal + t.shipping));
    set('submitText', (isCod ? 'Place COD order · ₹' : 'Pay via UPI · ₹') + t.total);
    // Only rewrite the COD panel while COD is actually selected.
    if (isCod) {
      set('codPayDesc', '₹0 advance · pay ₹' + t.total + ' on delivery (includes the ₹' + COD_FEE + ' COD handling charge)');
    }
    var feeRow = document.getElementById('codFeeRow');
    if (feeRow) feeRow.style.display = isCod ? '' : 'none';
  }

  function openCheckout(variant) {
    _checkoutTrigger = document.activeElement;
    currentVariant = variant;
    // Sync quantity from the cart (default to 1 for any direct/legacy call).
    if (getCartQty() > 0) cartQty = getCartQty();
    if (!(cartQty > 0)) cartQty = 1;
    var titleEl = document.getElementById('checkoutTitle');
    if (titleEl) {
      var packKey = cartQty === 2 ? 'duo' : cartQty === 3 ? 'trio' : variant;
      titleEl.textContent = (VARIANTS[packKey] && VARIANTS[packKey].title) || VARIANTS[variant].title;
    }
    renderCheckoutPrices();
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('successScreen').style.display = 'none';
    var upiPay = document.getElementById('upiPaymentScreen');
    if (upiPay) upiPay.style.display = 'none';
    var lsEl = document.getElementById('loadingScreen');
    if (lsEl) { lsEl.classList.remove('active'); lsEl.style.display = 'none'; }
    document.getElementById('checkoutOverlay').classList.add('active');
    syncModalState();
    // Hide sticky buy bar while overlay is open
    var mb = document.getElementById('mobileBar');
    if (mb) mb.style.display = 'none';
    // Trap focus immediately so keyboard users can't tab into the page behind
    trapFocusInOverlay();
    setTimeout(function() {
      var first = document.getElementById('f_phone');
      if (first) first.focus();
    }, 100);
    trackInitCheckout();
  }

  function closeCheckout() {
    _submittingOrder = false;
    var btn = document.getElementById('submitBtn');
    var btnText = document.getElementById('submitText');
    if (btn) btn.disabled = false;
    if (btnText) renderCheckoutPrices();
    document.getElementById('checkoutOverlay').classList.remove('active');
    syncModalState();
    var lsEl = document.getElementById('loadingScreen');
    if (lsEl) { lsEl.classList.remove('active'); lsEl.style.display = 'none'; }
    stopPaymentPolling();
    var upiPayClose = document.getElementById('upiPaymentScreen');
    if (upiPayClose) upiPayClose.style.display = 'none';
    const upiBlock = document.getElementById('upiBlock');
    if (upiBlock) upiBlock.style.display = 'none';
    // Reset the "Copied ✓" button state so a re-opened checkout starts clean
    var _cb = document.getElementById('upiCopyBtn');
    if (_cb) { _cb.classList.remove('copied'); _cb.textContent = 'Tap to copy'; }
    // Re-enable sticky buy bar on mobile
    var mb = document.getElementById('mobileBar');
    if (mb) mb.style.display = '';
    if (typeof window._updateMobileBar === 'function') window._updateMobileBar();
    // Return focus to the element that opened the overlay
    if (_checkoutTrigger && typeof _checkoutTrigger.focus === 'function') {
      setTimeout(function() { _checkoutTrigger.focus(); _checkoutTrigger = null; }, 50);
    }
  }
  var _overlayFocusTrapHandler = null;
  function trapFocusInOverlay() {
    var overlay = document.getElementById('checkoutOverlay');
    if (!overlay) return;
    if (_overlayFocusTrapHandler) overlay.removeEventListener('keydown', _overlayFocusTrapHandler);
    // The list has to be recomputed on every Tab, and it has to exclude what
    // is hidden. Snapshotting it once at open time caught the UPI panel, the
    // WhatsApp fallback link, the loading screen and the success screen —
    // all `display:none` at that moment — so `last` was an element that can
    // never hold focus, the wrap-around test never matched, and Tab walked
    // straight out of the dialog into the site header behind it. Measured:
    // 19 stops, then `.sf-hdr__logo`. Which panels are visible also changes
    // while the dialog is open (COD ↔ UPI), so a snapshot is wrong anyway.
    var visibleFocusable = function () {
      var all = overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      return Array.prototype.filter.call(all, function (el) {
        return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
    };
    _overlayFocusTrapHandler = function(e) {
      if (e.key !== 'Tab') return;
      var f = visibleFocusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      // Focus sitting on the dialog itself (or on something now hidden) must
      // still land back inside rather than falling through to the page.
      if (f.indexOf(document.activeElement) === -1) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    overlay.addEventListener('keydown', _overlayFocusTrapHandler);
  }

  // #checkoutForm is a <div>, not a <form> — so there is no implicit submit,
  // and pressing Enter (or "Go" on a phone keyboard, which the fields ask for
  // via enterkeyhint) did nothing at all on the one screen where doing nothing
  // costs an order. Enter anywhere in the panel except a textarea now places
  // the order, which is what every other checkout on the internet does.
  // Left as a <div> deliberately: submitOrder() owns validation and renders
  // its own messages into #checkoutError, and a real <form> would put native
  // validation bubbles in front of them.
  (function () {
    var overlay = document.getElementById('checkoutOverlay');
    if (!overlay) return;
    overlay.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      var t = e.target;
      if (!t || t.tagName === 'TEXTAREA') return;          // newline in the address
      if (t.tagName === 'BUTTON' || t.tagName === 'A') return; // let the control act
      if (!overlay.contains(t)) return;
      var btn = document.getElementById('submitBtn');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      btn.click();
    });
  })();

  window.openCheckout = openCheckout;
  window.closeCheckout = closeCheckout;
  window.selectPay = selectPay;
  window.submitOrder = submitOrder;

  function selectPay(method) {
    payMethod = method;
    document.querySelectorAll('.pay-opt').forEach(el => {
      var active = el.dataset.method === method;
      el.classList.toggle('active', active);
      el.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    // Toggle UPI / COD detail panels
    var upiPanel = document.getElementById('upiPayPanel');
    var codPanel = document.getElementById('codPayPanel');
    if (upiPanel) upiPanel.style.display = method === 'cod' ? 'none' : 'block';
    if (codPanel) codPanel.style.display = method === 'cod' ? 'block' : 'none';
    // Switching method changes the total (COD carries the handling charge), so
    // every price in the modal is re-rendered from the one source of truth.
    renderCheckoutPrices();
    const v = VARIANTS[currentVariant];
    const t = orderTotals();
    if (typeof window.smfTrack === 'function') {
      try {
        window.smfTrack({
          type: 'add_payment_info',
          label: method === 'cod' ? 'COD' : 'UPI',
          value: t.total * 100,
          meta: { payment_method: method, qty: t.qty }
        });
      } catch (e) {}
    }
    // AddPaymentInfo event (shared event_id → browser⇄CAPI dedup)
    if (typeof fbq !== 'undefined') {
      var _eidP = _eid(); var _api = fbContents(t.total, t.qty); _api.payment_type = method;
      fbq('track', 'AddPaymentInfo', _api, { eventID: _eidP });
      metaCapi('AddPaymentInfo', _eidP, { custom: _api, order_type: method === 'cod' ? 'cod' : 'prepaid' });
    }
    if (typeof gtag !== 'undefined') gtag('event', 'add_payment_info', { payment_type: method, currency: 'INR', value: t.total, items: gaItems(v.amount, t.qty) });
  }

  function showError(msg) {
    const el = document.getElementById('checkoutError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    const wa = document.getElementById('waFallback');
    if (wa) wa.style.display = 'block';
    if (typeof window.smfTrack === 'function') {
      try {
        window.smfTrack({
          type: 'checkout_error',
          label: msg,
          meta: { error: msg, payment_method: payMethod }
        });
      } catch (e) {}
    }
  }

  function hideError() {
    const el = document.getElementById('checkoutError');
    if (el) el.style.display = 'none';
    const wa = document.getElementById('waFallback');
    if (wa) wa.style.display = 'none';
  }

  function validateForm() {
    // Clear previous red borders
    document.querySelectorAll('.overlay input, .overlay textarea').forEach(function(i){
      i.style.borderColor = '';
      i.removeAttribute('aria-invalid');
    });
    hideError();

    const phoneEl = document.getElementById('f_phone');
    const phone = phoneEl ? phoneEl.value.trim() : '';
    if (!phone) {
      if (phoneEl) { phoneEl.style.borderColor='#ff6b6b'; phoneEl.setAttribute('aria-invalid','true'); phoneEl.focus(); }
      showError('Please enter your 10-digit mobile number.');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      if (phoneEl) { phoneEl.style.borderColor='#ff6b6b'; phoneEl.setAttribute('aria-invalid','true'); phoneEl.focus(); }
      showError('Enter a valid 10-digit mobile number (e.g. 9876543210).');
      return false;
    }

    const nameEl = document.getElementById('f_name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      if (nameEl) { nameEl.style.borderColor='#ff6b6b'; nameEl.setAttribute('aria-invalid','true'); nameEl.focus(); }
      showError('Please enter your full name.');
      return false;
    }

    const pinEl = document.getElementById('f_pin');
    const pin = pinEl ? pinEl.value.trim() : '';
    if (!pin) {
      if (pinEl) { pinEl.style.borderColor='#ff6b6b'; pinEl.setAttribute('aria-invalid','true'); pinEl.focus(); }
      showError('Please enter your 6-digit delivery pincode.');
      return false;
    }
    if (!/^\d{6}$/.test(pin)) {
      if (pinEl) { pinEl.style.borderColor='#ff6b6b'; pinEl.setAttribute('aria-invalid','true'); pinEl.focus(); }
      showError('Enter a valid 6-digit delivery pincode.');
      return false;
    }

    const cityEl = document.getElementById('f_city');
    const city = cityEl ? cityEl.value.trim() : '';
    if (!city) {
      if (cityEl) { cityEl.style.borderColor='#ff6b6b'; cityEl.setAttribute('aria-invalid','true'); cityEl.focus(); }
      showError('Please enter your city.');
      return false;
    }

    const stateEl = document.getElementById('f_state');
    const state = stateEl ? stateEl.value.trim() : '';
    if (!state) {
      if (stateEl) { stateEl.style.borderColor='#ff6b6b'; stateEl.setAttribute('aria-invalid','true'); stateEl.focus(); }
      showError('Please enter your state.');
      return false;
    }

    const addrEl = document.getElementById('f_addr');
    const addr = addrEl ? addrEl.value.trim() : '';
    if (!addr) {
      if (addrEl) { addrEl.style.borderColor='#ff6b6b'; addrEl.setAttribute('aria-invalid','true'); addrEl.focus(); }
      showError('Please enter your delivery street and house address.');
      return false;
    }

    // Email is OPTIONAL — only validate if non-empty
    const emailEl = document.getElementById('f_email');
    const email = emailEl ? emailEl.value.trim() : '';
    if (email && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      if (emailEl) { emailEl.style.borderColor='#ff6b6b'; emailEl.setAttribute('aria-invalid','true'); emailEl.focus(); }
      showError('Enter a valid email address or leave it blank.');
      return false;
    }
    return true;
  }

  function genOrderId() {
    var d = new Date();
    var date = d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    var suffix = String(Math.floor(Math.random() * 9000) + 1000);
    return 'SMF-' + date + '-' + suffix;
  }

  // Maps the in-page variant key to the backend schema
  // (variant, variantLabel, units) — kept here so the rest of the UI stays stable.
  const SHEET_VARIANT = {
    solo: { variant: 'starter', label: 'ODORSTRIKE — 1 × 50ml', bottles: 1 }
  };

  function collectOrder(orderId, paymentId) {
    const v = VARIANTS[currentVariant] || {};
    const t = orderTotals();
    const qty = t.qty;
    const baseAmount = t.subtotal;
    const shipping = t.shipping;
    const sv = SHEET_VARIANT[currentVariant] || { variant: currentVariant, label: v.title || currentVariant, bottles: 1 };
    const isCod = payMethod === 'cod';
    let source = 'Direct';
    try { source = localStorage.getItem('os_source') || 'Direct'; } catch (e) {}
    return {
      orderId,
      name: document.getElementById('f_name').value.trim(),
      phone: document.getElementById('f_phone').value.trim(),
      email: document.getElementById('f_email').value.trim(),
      product: 'ODORSTRIKE Fabric Mist',
      variant: sv.variant,
      variantLabel: qty > 1 ? ('ODORSTRIKE — ' + qty + ' × 50ml') : sv.label,
      units: sv.bottles * qty,
      quantity: qty,
      amount: baseAmount,
      shipping: shipping,
      // codFee is sent as its own column so the collectable figure and the
      // product revenue stay separable in the sheet, in Supabase and in admin —
      // folding it into `total` alone would silently inflate reported sales.
      codFee: t.codFee,
      total: t.total,
      paymentMethod: isCod ? 'cod' : 'upi',
      paymentStatus: isCod ? 'cod_pending_call' : 'pending',
      paymentId: '',
      address: document.getElementById('f_addr').value.trim(),
      city: document.getElementById('f_city').value.trim(),
      state: document.getElementById('f_state').value.trim(),
      pincode: document.getElementById('f_pin').value.trim(),
      source: source,
      notes: ''
    };
  }

  function logOrderToSheets(order) {
    const params = new URLSearchParams();
    Object.keys(order).forEach(k => params.append(k, order[k] != null ? order[k] : ''));
    const url = CFG.SHEETS_ENDPOINT + '?' + params.toString();

    // Method 1: sendBeacon — survives page navigation, bypasses CORS
    let beaconSent = false;
    if (navigator.sendBeacon) {
      try {
        // Beacon with FormData (POST) — Apps Script doPost handles it
        const fd = new FormData();
        Object.keys(order).forEach(k => fd.append(k, order[k] != null ? order[k] : ''));
        beaconSent = navigator.sendBeacon(CFG.SHEETS_ENDPOINT, fd);
      } catch (e) {
        console.warn('[Smelloff] sendBeacon failed:', e);
      }
    }

    // Method 2: Image pixel — fires a GET, bypasses CORS, always works
    // Runs in parallel as belt-and-braces backup
    try {
      const img = new Image();
      // onerror is expected here (Apps Script returns a non-image response); swallow it
      img.onerror = () => {};
      img.src = url;
    } catch (e) {
      console.warn('[Smelloff] Pixel fallback failed:', e);
    }

    // Method 3: fetch as last resort (if URL is too long for beacon+img and both fail)
    if (!beaconSent && url.length < 8000) {
      fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true })
        .catch(e => console.warn('[Smelloff] fetch backup failed:', e));
    }
  }

  function showLoadingScreen(label, sub) {
    var cf = document.getElementById('checkoutForm');
    if (cf) cf.style.display = 'none';
    var ss = document.getElementById('successScreen');
    if (ss) ss.style.display = 'none';
    var upiScreen = document.getElementById('upiPaymentScreen');
    if (upiScreen) upiScreen.style.display = 'none';
    var ls = document.getElementById('loadingScreen');
    if (!ls) return;
    var ll = document.getElementById('loadingLabel');
    var ls2 = document.getElementById('loadingSub');
    if (label && ll) ll.textContent = label;
    if (sub && ls2) ls2.textContent = sub;
    ls.style.display = '';
    ls.classList.add('active');
  }

  function hideLoadingScreen(restoreForm) {
    var ls = document.getElementById('loadingScreen');
    if (ls) { ls.classList.remove('active'); ls.style.display = 'none'; }
    if (restoreForm !== false) {
      var cf = document.getElementById('checkoutForm');
      var ss = document.getElementById('successScreen');
      var upiScreen = document.getElementById('upiPaymentScreen');
      if (cf && (!ss || ss.style.display === 'none') && (!upiScreen || upiScreen.style.display === 'none')) {
        cf.style.display = 'block';
      }
    }
  }

  var _paymentPollingTimer = null;
  var _currentUpiOrder = null;

  function stopPaymentPolling() {
    if (_paymentPollingTimer) {
      clearInterval(_paymentPollingTimer);
      _paymentPollingTimer = null;
    }
  }

  function showSuccess(orderId, method) {
    stopPaymentPolling();
    hideLoadingScreen(false);
    var cff = document.getElementById('checkoutForm');
    if (cff) cff.style.display = 'none';
    var upiScreen = document.getElementById('upiPaymentScreen');
    if (upiScreen) upiScreen.style.display = 'none';
    var ssc = document.getElementById('successScreen');
    if (ssc) ssc.style.display = 'block';
    var oid = document.getElementById('orderIdDisplay');
    if (oid) oid.textContent = orderId;
    var trk = document.getElementById('successTrackLink');
    if (trk) { trk.href = '/track-order?code=' + encodeURIComponent(orderId); trk.style.display = 'inline-block'; }
    try { localStorage.setItem('smelloff_last_order', JSON.stringify({ code: orderId, ts: Date.now() })); } catch (e) {}

    // The collectable figure, COD charge included — this is what the courier asks for.
    var amount = orderTotals().total;
    var name = (document.getElementById('f_name') ? document.getElementById('f_name').value.trim() : '') || '';
    var phone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : '') || '';

    if (method === 'cod') {
      document.getElementById('successTag').textContent = 'Order received';
      document.getElementById('successHeading').textContent = "COD order placed.";
      document.getElementById('successMsg').textContent = 'Our team will call to confirm within 24 hours. Pay ₹' + amount + ' to the delivery person on arrival.';

      try {
        var gcrEmail = document.getElementById('f_email');
        if (typeof window.smfGoogleReviewOptIn === 'function') {
          window.smfGoogleReviewOptIn({
            orderId: orderId,
            email: gcrEmail ? gcrEmail.value.trim() : ''
          });
        }
      } catch (e) {}
    } else {
      document.getElementById('successTag').textContent = 'Order confirmed ✓';
      document.getElementById('successHeading').textContent = "You're done.";
      document.getElementById('successMsg').textContent = 'Payment verified. Our team ships your ODORSTRIKE within 48 hours.';
    }

    var qLink = document.getElementById('waSuccessQuestionsLink');
    if (qLink) {
      qLink.href = 'https://wa.me/919392974031?text=' + encodeURIComponent(
        'Hi Smelloff, I have a question about my order.\nOrder ID: ' + orderId
      );
    }

    trackPurchase(amount, orderId);
    soAttachOrder(orderId, amount, cartQty > 0 ? cartQty : 1, method === 'cod' ? 'cod' : 'upi');
    setCartQty(0);
    // Unlock review submission (client-side gate — not tamper-proof).
    try {
      var buyerEmail = (document.getElementById('f_email') ? document.getElementById('f_email').value : '').trim().toLowerCase();
      var buyerPhone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value : '').trim();
      localStorage.setItem('smelloff_purchased', 'true');
      if (buyerEmail) localStorage.setItem('smelloff_purchased_email', buyerEmail);
      if (buyerPhone) localStorage.setItem('smelloff_last_phone', buyerPhone);
      // Show/hide email confirmation note based on whether user gave an email
      var emailNote = document.getElementById('successEmailNote');
      if (emailNote) emailNote.style.display = buyerEmail ? 'block' : 'none';
    } catch (e) { /* localStorage may be blocked in private mode */ }
  }

  var _submittingOrder = false;

  async function submitOrder() {
    if (_submittingOrder) return;
    hideError();
    if (!validateForm()) {
      _submittingOrder = false;
      return;
    }
    _submittingOrder = true;

    // Enrich the Pixel with Advanced Matching now that the form is filled
    if (typeof fbq !== 'undefined') {
      try {
        var _p = _formPII();
        fbq('init', (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.META_PIXEL_ID) || '1455100092891684', {
          em: _p.email || undefined, ph: _p.phone || undefined,
          fn: _p.firstName || undefined, ln: _p.lastName || undefined,
          ct: _p.city || undefined, st: _p.state || undefined,
          zp: _p.pincode || undefined, country: 'in'
        });
      } catch (e) { /* AM is best-effort */ }
    }

    const btn = document.getElementById('submitBtn');
    const btnText = document.getElementById('submitText');
    btn.disabled = true;
    btnText.innerHTML = '<span class="loader"></span>Processing...';

    const customerPayload = {
      name: (document.getElementById('f_name') ? document.getElementById('f_name').value.trim() : ''),
      phone: (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : ''),
      email: (document.getElementById('f_email') ? document.getElementById('f_email').value.trim() : ''),
      address: (document.getElementById('f_addr') || document.getElementById('f_address') ? (document.getElementById('f_addr') || document.getElementById('f_address')).value.trim() : ''),
      city: (document.getElementById('f_city') ? document.getElementById('f_city').value.trim() : ''),
      state: (document.getElementById('f_state') ? document.getElementById('f_state').value.trim() : ''),
      pincode: (document.getElementById('f_pin') || document.getElementById('f_pincode') ? (document.getElementById('f_pin') || document.getElementById('f_pincode')).value.trim() : '')
    };

    const isCod = payMethod === 'cod';
    const reqQty = cartQty > 0 ? cartQty : 1;
    const totals = orderTotals();
    const total = totals.subtotal + totals.shipping;

    try {
      showLoadingScreen(isCod ? 'Placing your order…' : 'Preparing UPI payment…', isCod ? 'Confirming with our team' : 'Generating your QR and UPI ID');

      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: reqQty,
          paymentMethod: isCod ? 'cod' : 'upi',
          customer: customerPayload
        })
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.ok) {
        throw new Error(orderData.error || 'Unable to create order. Please check details.');
      }

      const orderId = orderData.orderId;
      const orderToken = orderData.orderToken || '';
      if (orderToken) {
        try { localStorage.setItem('smelloff_order_token_' + orderId, orderToken); } catch (e) {}
      }
      const order = collectOrder(orderId, isCod ? 'COD' : 'UPI_PENDING');
      logOrderToSheets(order);
      smfCartBeacon('cart_update', { name: order.name, email: order.email, phone: order.phone });

      if (isCod) {
        setTimeout(() => {
          _submittingOrder = false;
          btn.disabled = false;
          showSuccess(orderId, 'cod');
        }, 1200);
        return;
      }

      // Direct UPI Flow (Prepaid) — QR + UPI ID. Never auto-launch upi://
      // from the browser: PhonePe (and some other apps) decline website-opened
      // intents to a personal VPA. Scanning the QR is treated as P2P and works.
      setTimeout(function() {
        _submittingOrder = false;
        btn.disabled = false;
        const upiUri = orderData.upiUri || buildUpiPaymentUri(orderData.total || total, orderId);
        showUpiPaymentScreen(orderId, orderData.total || total, upiUri, orderToken);
      }, 200);

    } catch (err) {
      _submittingOrder = false;
      btn.disabled = false;
      btnText.textContent = (payMethod === 'cod' ? 'PLACE COD ORDER · ₹' : 'PAY VIA UPI · ₹') + orderTotals().total;
      hideLoadingScreen(true);
      showError(err.message || 'Payment initiation failed. Please try again or choose Cash on Delivery.');
    }
  }

  let selectedUpiApp = 'any';
  window.setUpiApp = function(appName) {
    selectedUpiApp = appName;
    document.querySelectorAll('.upi-app-btn').forEach(function(btn) {
      var active = btn.dataset.app === appName;
      btn.classList.toggle('active', active);
    });
  };

  function buildUpiPaymentUri(amount, orderCode) {
    const pa = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.UPI_ID) || 'mr.brainy@ibl';
    const pn = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.UPI_NAME) || 'Smelloff';
    const am = String(amount || 229);
    const params = new URLSearchParams({ pa, pn, am, cu: 'INR' });
    if (orderCode) params.set('tn', 'ODORSTRIKE ' + String(orderCode));
    return `upi://pay?${params.toString()}`;
  }

  window.buildUpiPaymentUri = buildUpiPaymentUri;

  window.launchSpecificUpi = function(app, event) {
    if (event) event.preventDefault();
    var hint = document.getElementById('upiAppHint');
    // PhonePe declines website-launched intents to this personal VPA.
    // Keep the customer on the QR / UPI ID path instead of bouncing them
    // into a "declined for security reasons" screen.
    if (app === 'phonepe') {
      if (hint) {
        hint.textContent = 'PhonePe blocks payments opened from a website. Open PhonePe yourself and scan the QR, or pay to mr.brainy@ibl.';
        hint.style.display = 'block';
      }
      var qr = document.getElementById('upiQRWrap') || document.getElementById('upiQRCanvas');
      if (qr && qr.scrollIntoView) qr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const uri = (_currentUpiOrder && _currentUpiOrder.upiUri) || buildUpiPaymentUri(orderTotals().total, _currentUpiOrder && _currentUpiOrder.orderId);
    if (hint) {
      hint.textContent = 'If the app says declined, come back and scan the QR. That path still works.';
      hint.style.display = 'block';
    }
    window.location.href = uri;
  };

  // Copy UPI ID to clipboard with brief "Copied ✓" confirmation
  window.copyUpiId = async function(btnId) {
    const id = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.UPI_ID) || 'mr.brainy@ibl';
    const btn = document.getElementById(btnId || 'upiCopyBtn');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement('textarea');
        ta.value = id; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      if (btn) {
        btn.classList.add('copied');
        const orig = btn.textContent;
        btn.textContent = 'Copied ✓';
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
      }
    } catch (e) { console.warn('[Smelloff] UPI copy failed:', e); }
  };

  function showUpiPaymentScreen(orderId, total, upiUri, orderToken) {
    hideLoadingScreen(false);
    document.getElementById('checkoutForm').style.display = 'none';
    var successScreen = document.getElementById('successScreen');
    if (successScreen) successScreen.style.display = 'none';

    const upiScreen = document.getElementById('upiPaymentScreen');
    if (upiScreen) upiScreen.style.display = 'block';

    const titleEl = document.getElementById('upiPayTitle');
    if (titleEl) titleEl.textContent = 'Pay ₹' + total + ' via UPI';
    const oidEl = document.getElementById('upiOrderIdDisplay');
    if (oidEl) oidEl.textContent = orderId;

    const idShow = document.getElementById('upiIdShow');
    if (idShow) idShow.textContent = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.UPI_ID) || 'mr.brainy@ibl';
    const amtShow = document.getElementById('upiAmountShow');
    if (amtShow) amtShow.textContent = '₹' + total;
    const noteShow = document.getElementById('upiNoteShow');
    if (noteShow) noteShow.textContent = orderId;

    const activeUpiUri = upiUri || buildUpiPaymentUri(total, orderId);

    // Update optional deep links (GPay/Paytm). PhonePe is intercepted in launchSpecificUpi.
    var gpayBtn = document.getElementById('upiGpayBtn');
    if (gpayBtn) gpayBtn.href = activeUpiUri;
    var phonepeBtn = document.getElementById('upiPhonepeBtn');
    if (phonepeBtn) phonepeBtn.href = '#upiQRWrap';
    var paytmBtn = document.getElementById('upiPaytmBtn');
    if (paytmBtn) paytmBtn.href = activeUpiUri;
    var openBtn = document.getElementById('upiOpenBtn');
    if (openBtn) openBtn.href = activeUpiUri;

    renderUpiQr(activeUpiUri);

    // Reset status box UI
    const statusText = document.getElementById('upiPollingStatusText');
    if (statusText) statusText.textContent = 'Waiting for payment confirmation…';
    const checkBtn = document.getElementById('upiCheckNowBtn');
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.textContent = "I've Completed Payment · Check Status";
    }
    const feedback = document.getElementById('upiStatusFeedback');
    if (feedback) { feedback.style.display = 'none'; feedback.textContent = ''; }

    _currentUpiOrder = {
      orderId: orderId,
      total: total,
      upiUri: activeUpiUri,
      orderToken: orderToken
    };

    // Start background status polling
    startPaymentPolling(orderId, orderToken, total);
  }

  window.showUpiPaymentScreen = showUpiPaymentScreen;

  function renderUpiQr(uri) {
    var canvas = document.getElementById('upiQRCanvas');
    var img = document.getElementById('upiQR');
    var wrap = document.getElementById('upiQRWrap');
    if (wrap) wrap.style.display = '';
    var localOk = false;
    if (canvas && window.QrCreator && typeof window.QrCreator.render === 'function') {
      try {
        canvas.width = 440;
        canvas.height = 440;
        window.QrCreator.render({
          text: String(uri),
          radius: 0,
          ecLevel: 'M',
          fill: '#111111',
          background: '#ffffff',
          size: 440
        }, canvas);
        canvas.style.display = 'block';
        if (img) img.style.display = 'none';
        localOk = true;
      } catch (e) {
        localOk = false;
      }
    }
    if (localOk) return;
    if (canvas) canvas.style.display = 'none';
    if (!img) return;
    img.style.display = 'block';
    var encoded = encodeURIComponent(uri);
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=440x440&ecc=M&margin=8&color=111111&bgcolor=ffffff&data=' + encoded;
    img.onerror = function () {
      img.onerror = function () { img.style.display = 'none'; };
      img.src = 'https://quickchart.io/qr?format=png&margin=2&size=440&text=' + encoded;
    };
  }

  function startPaymentPolling(orderId, orderToken, total) {
    stopPaymentPolling();
    var pollCount = 0;
    var maxPolls = 80; // 80 * 2.5s = ~3.3 minutes of active polling

    _paymentPollingTimer = setInterval(async function() {
      pollCount++;
      if (pollCount > maxPolls) {
        stopPaymentPolling();
        var statusText = document.getElementById('upiPollingStatusText');
        if (statusText) statusText.textContent = 'Polling paused · Tap below to verify';
        return;
      }

      var verified = await pollPaymentStatus(orderId, orderToken, total, false);
      if (verified) {
        stopPaymentPolling();
      }
    }, 2500);
  }

  async function pollPaymentStatus(orderId, orderToken, total, isManual) {
    try {
      var url = '/api/payment-status?orderCode=' + encodeURIComponent(orderId);
      if (orderToken) {
        url += '&orderToken=' + encodeURIComponent(orderToken);
      }
      var phone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : '') || localStorage.getItem('smelloff_last_phone') || '';
      if (phone) {
        url += '&phone=' + encodeURIComponent(phone);
      }

      var res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!res.ok) return false;
      var data = await res.json();
      if (!data || !data.ok) return false;

      if (data.status === 'confirmed' || data.verified === true) {
        stopPaymentPolling();
        showSuccess(orderId, 'upi');
        return true;
      }

      if (data.status === 'failed') {
        stopPaymentPolling();
        var fb = document.getElementById('upiStatusFeedback');
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = '#ff6b6b';
          fb.textContent = 'Payment could not be completed. Scan the QR or pay to the UPI ID, then tap check status.';
        }
        return false;
      }

      return false;
    } catch (e) {
      console.warn('[Smelloff] payment poll error:', e);
      return false;
    }
  }

  window.checkCurrentPaymentStatus = async function(isManual) {
    if (!_currentUpiOrder) return;
    var btn = document.getElementById('upiCheckNowBtn');
    var fb = document.getElementById('upiStatusFeedback');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Checking with bank…';
    }
    if (fb) fb.style.display = 'none';

    var verified = await pollPaymentStatus(_currentUpiOrder.orderId, _currentUpiOrder.orderToken, _currentUpiOrder.total, true);

    if (btn) {
      btn.disabled = false;
      btn.textContent = "I've Completed Payment · Check Status";
    }

    if (!verified && fb) {
      fb.style.display = 'block';
      fb.style.color = '#ffc107';
      fb.textContent = 'Payment not confirmed yet. It takes 5–15 seconds after authorizing in your UPI app. Checking automatically…';
    }
  };

  window.submitCustomerUtr = async function() {
    if (!_currentUpiOrder || !_currentUpiOrder.orderId) return;
    var utrInput = document.getElementById('upiUtrInput');
    var submitBtn = document.getElementById('upiSubmitUtrBtn');
    var fb = document.getElementById('upiUtrFeedback');
    var rawUtr = (utrInput ? utrInput.value : '').trim();

    if (!rawUtr || rawUtr.length < 10) {
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = '#ff6b6b';
        fb.textContent = 'Please enter a valid 10–24 character UTR / UPI Reference Number from your payment receipt.';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }
    if (fb) {
      fb.style.display = 'none';
      fb.textContent = '';
    }

    try {
      var phone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : '') || localStorage.getItem('smelloff_last_phone') || '';
      var res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': _currentUpiOrder.orderToken || ''
        },
        body: JSON.stringify({
          orderCode: _currentUpiOrder.orderId,
          upiRef: rawUtr,
          customerPhone: phone,
          orderToken: _currentUpiOrder.orderToken || ''
        })
      });

      var data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit UTR');
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submitted ✓';
      }

      if (fb) {
        fb.style.display = 'block';
        fb.style.color = '#b8ff57';
        fb.textContent = 'UTR submitted! Payment verification is in progress. Our team will verify and confirm your order shortly.';
      }

      var statusText = document.getElementById('upiPollingStatusText');
      if (statusText) {
        statusText.textContent = 'Verification in progress (UTR: ' + (data.upiRef || rawUtr) + ')';
      }

      if (data.status === 'confirmed' || data.verified === true) {
        showSuccess(_currentUpiOrder.orderId, 'upi');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit UTR';
      }
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = '#ff6b6b';
        fb.textContent = err.message || 'Error submitting UTR. Please try again.';
      }
    }
  };

  // ==============================
  // PINCODE → CITY/STATE AUTOFILL (checkout)
  // postalpincode.in is free, no API key. We never block checkout —
  // any failure just leaves the fields empty for manual entry.
  // ==============================
  (function(){
    var pin  = document.getElementById('f_pin');
    var city = document.getElementById('f_city');
    var st   = document.getElementById('f_state');
    if (!pin || !city || !st) return;
    var inflight = false;
    var pendingPin = null;

    async function lookup(value){
      try{
        city.placeholder = '…'; st.placeholder = '…';
        var res = await fetch('https://api.postalpincode.in/pincode/' + encodeURIComponent(value));
        if (!res.ok) return;
        var json = await res.json();
        var entry = json && json[0];
        if (!entry || entry.Status !== 'Success' || !entry.PostOffice || !entry.PostOffice.length) return;
        var po = entry.PostOffice[0];
        if (po.District) { city.value = po.District; flash(city); }
        if (po.State)    { st.value   = po.State;    flash(st);   }
      } catch(e){
        console.warn('[Smelloff] Pincode lookup failed:', e);
      } finally {
        city.placeholder = ''; st.placeholder = '';
        inflight = false;
        if (pendingPin) { var p = pendingPin; pendingPin = null; inflight = true; lookup(p); }
      }
    }
    function flash(el){
      el.classList.add('flash-acid');
      setTimeout(function(){ el.classList.remove('flash-acid'); }, 800);
    }

    // Estimated delivery window (3–5 days from today), shown as weekday names.
    var estEl = document.getElementById('deliveryEstimate');
    var estText = document.getElementById('deliveryEstimateText');
    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    function showDeliveryEstimate(){
      if (!estEl || !estText) return;
      var now = new Date();
      var lo = new Date(now.getTime() + 3 * 86400000);
      var hi = new Date(now.getTime() + 5 * 86400000);
      estText.textContent = 'Estimated delivery: ' + DAYS[lo.getDay()] + ' – ' + DAYS[hi.getDay()];
      estEl.classList.add('show');
    }
    function hideDeliveryEstimate(){ if (estEl) estEl.classList.remove('show'); }

    pin.addEventListener('input', function(){
      var v = (pin.value || '').trim();
      if (v.length === 6 && /^\d{6}$/.test(v)) {
        showDeliveryEstimate();
        if (inflight) { pendingPin = v; return; }
        inflight = true;
        lookup(v);
      } else {
        hideDeliveryEstimate();
      }
    });
  })();

  // ==============================
  // PAYMENT FAILED POLICY OVERLAY
  // ==============================
  let _pfPrevScroll = 0;
  window.openPaymentFailedOverlay = function() {
    _pfPrevScroll = window.scrollY || 0;
    const o = document.getElementById('paymentFailedOverlay');
    if (!o) return;
    o.classList.add('active');
    o.scrollTop = 0;
    syncModalState();
  };
  window.closePaymentFailedOverlay = function() {
    var o = document.getElementById('paymentFailedOverlay');
    if (o) o.classList.remove('active');
    syncModalState();
    var checkoutOpen = document.getElementById('checkoutOverlay');
    if (!checkoutOpen || !checkoutOpen.classList.contains('active')) {
      window.scrollTo(0, _pfPrevScroll);
    }
  };

  // Close on overlay click (outside panel)
  document.getElementById('checkoutOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutOverlay') closeCheckout();
  });

  // ==============================
  // ANALYTICS EVENTS
  // ==============================
  // Single-SKU catalogue identity — shared across every GA4 + Meta Pixel event
  // so price/product data is always structured (fixes Meta "same price
  // information" diagnostics and enables value optimisation + dynamic ads).
  var OS_SKU  = 'OS-001-50ML';
  var OS_NAME = 'ODORSTRIKE Fabric Odor Mist';
  function osValue() {
    var v = VARIANTS[currentVariant] && VARIANTS[currentVariant].amount;
    if (typeof v !== 'number' || !(v > 0)) {
      v = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES && window.SMELLOFF_CONFIG.PRICES.solo) || 229;
    }
    return Number(v);
  }
  // GA4 ecommerce items array
  function gaItems(value, qty) {
    qty = qty || 1;
    return [{ item_id: OS_SKU, item_name: OS_NAME, price: Number(value), quantity: qty }];
  }
  // Meta Pixel content payload (numeric value > 0, per-item contents, num_items)
  function fbContents(value, qty) {
    qty = qty || 1;
    value = Number(value);
    return {
      value: value, currency: 'INR',
      content_ids: [OS_SKU], content_type: 'product', content_name: OS_NAME,
      contents: [{ id: OS_SKU, quantity: qty, item_price: value / qty }],
      num_items: qty
    };
  }

  // ---- Meta event plumbing: a shared event_id per event lets Meta dedupe the
  //      browser Pixel against its Conversions API mirror instead of double-
  //      counting. Everything here is consent-gated (no Pixel → no CAPI) and
  //      fire-and-forget (a tracking failure can never affect checkout). ----
  function _ck(n){ var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function _eid(){ try { return crypto.randomUUID ? crypto.randomUUID() : (String(Date.now()) + Math.random().toString(16).slice(2)); } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); } }
  function _fbclid(){ try { return new URLSearchParams(location.search).get('fbclid') || ''; } catch (e) { return ''; } }
  // Use the Pixel's _fbc cookie; if it never got set (consent delayed), rebuild
  // it from the fbclid on the landing URL so paid-click attribution isn't lost.
  function _fbc(){ var c = _ck('_fbc'); if (c) return c; var f = _fbclid(); return f ? ('fb.1.' + Date.now() + '.' + f) : ''; }
  function _formPII(){
    var g = function (id){ var el = document.getElementById(id); return el && el.value ? el.value.trim() : ''; };
    var nm = g('f_name'); var sp = nm.split(/\s+/).filter(Boolean);
    return { email: g('f_email'), phone: g('f_phone'), name: nm,
      firstName: sp[0] || '', lastName: sp.length > 1 ? sp[sp.length - 1] : '',
      city: g('f_city'), state: g('f_state'), pincode: (g('f_pin') || '').replace(/\D/g, '').slice(0, 6) };
  }
  // Mirror one event to the Conversions API with the SAME event_id.
  function metaCapi(eventName, eventId, payload){
    if (typeof fbq === 'undefined') return; // consent-gated: no Pixel, no CAPI
    try {
      var body = Object.assign({ event_name: eventName, eventId: eventId, eventSourceUrl: location.href,
        fbp: _ck('_fbp'), fbc: _fbc(), fbclid: _fbclid() }, payload || {});
      var s = JSON.stringify(body);
      if (navigator.sendBeacon) navigator.sendBeacon('/api/meta-capi', new Blob([s], { type: 'application/json' }));
      else fetch('/api/meta-capi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s, keepalive: true });
    } catch (e) { /* tracking must never break the page */ }
  }

  function trackAddToCart() {
    var qty = getCartQty() > 0 ? getCartQty() : 1; var v = osValue() * qty; var eid = _eid();
    var c = fbContents(v, qty);
    if (typeof fbq !== 'undefined') fbq('track', 'AddToCart', c, { eventID: eid });
    if (typeof gtag !== 'undefined') gtag('event', 'add_to_cart', { currency: 'INR', value: v, items: gaItems(osValue(), qty) });
    metaCapi('AddToCart', eid, { custom: c });
  }
  window.trackAddToCart = trackAddToCart;

  function trackInitCheckout() {
    var qty = getCartQty() > 0 ? getCartQty() : 1; var v = osValue() * qty; var eid = _eid();
    var c = fbContents(v, qty);
    if (typeof fbq !== 'undefined') fbq('track', 'InitiateCheckout', c, { eventID: eid });
    if (typeof gtag !== 'undefined') gtag('event', 'begin_checkout', { currency: 'INR', value: v, items: gaItems(osValue(), qty) });
    metaCapi('InitiateCheckout', eid, { custom: c });
    // First-party funnel: checkout_start (snapshot keeps the live cart current).
    smfCartBeacon('checkout_start');
  }

  // Fired when an order is PLACED (COD, or unpaid UPI awaiting verification).
  // This is INTENT, not confirmed revenue, so it emits `Lead` — NOT `Purchase`.
  // The real Purchase is emitted server-side (api/meta-capi-drain) only when the
  // order is CONFIRMED, with a Refund correction if a COD order is later
  // cancelled or returns to origin. Firing Purchase here would report every
  // unpaid/COD order as a sale and train Meta to find people who don't pay.
  // (Kept the name `trackPurchase` so existing call sites are untouched.)
  var _placedOrders = {};
  function trackPurchase(amount, orderId) {
    amount = Number(amount) || osValue();
    if (orderId && _placedOrders[orderId]) return;
    if (orderId) _placedOrders[orderId] = true;
    // First-party funnel (unchanged): marks this session's cart converted.
    if (typeof window.smfTrack === 'function') {
      try { window.smfTrack({ type: 'purchase', value: amount * 100, order_code: orderId }); } catch (e) {}
    }
    // GA4 (unchanged — out of Meta scope): preserves the merchant's report.
    if (typeof gtag !== 'undefined') gtag('event', 'purchase', {
      transaction_id: orderId, value: amount, currency: 'INR', items: gaItems(amount)
    });
    // Meta: intent signal only, with Advanced Matching from the checkout form so
    // the Lead — and the later server Purchase, which reuses these identifiers —
    // gets a high Event Match Quality score.
    if (typeof fbq !== 'undefined' && orderId) {
      var eid = 'lead_' + orderId; var pii = _formPII();
      fbq('track', 'Lead', { content_ids: [OS_SKU], content_type: 'product' }, { eventID: eid });
      metaCapi('Lead', eid, { orderId: orderId,
        email: pii.email, phone: pii.phone, firstName: pii.firstName, lastName: pii.lastName,
        city: pii.city, state: pii.state, pincode: pii.pincode, country: 'in' });
    }
  }
  window.trackInitCheckout = trackInitCheckout;

  // ViewContent fires when #buy section enters viewport
  (function(){
    var buySection = document.getElementById('buy');
    if (!buySection || !('IntersectionObserver' in window)) return;
    var fired = false;
    var obs = new IntersectionObserver(function(entries){
      if (fired) return;
      if (entries[0].isIntersecting) {
        fired = true;
        var vcPrice = osValue(); var eid = _eid(); var c = fbContents(vcPrice);
        if (typeof fbq !== 'undefined') fbq('track', 'ViewContent', c, { eventID: eid });
        if (typeof gtag !== 'undefined') gtag('event', 'view_item', { currency: 'INR', value: vcPrice, items: gaItems(vcPrice) });
        metaCapi('ViewContent', eid, { custom: c });
        // First-party funnel: the #buy section is this store's product view.
        if (typeof window.smfTrack === 'function') {
          try { window.smfTrack({ type: 'product_view', label: 'ODORSTRIKE Fabric Mist', value: vcPrice * 100 }); } catch (e) {}
        }
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(buySection);
  })();

  // Gallery zoom — tiles 2–8 carry body copy inside the artwork, which is
  // unreadable in a 294px carousel cell. Any tile opens full-screen.
  (function(){
    var gallery=document.getElementById('gallery');
    var viewer=document.getElementById('galViewer');
    if(!gallery||!viewer)return;
    var opener=null;
    var trapHandler=null;

    function trap(){
      if(trapHandler) viewer.removeEventListener('keydown', trapHandler);
      trapHandler=function(e){
        if(e.key!=='Tab') return;
        var all=viewer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        var f=Array.prototype.filter.call(all, function(el){
          return el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
        });
        if(!f.length){ e.preventDefault(); return; }
        var first=f[0], last=f[f.length-1];
        if(f.indexOf(document.activeElement)===-1){ e.preventDefault(); (e.shiftKey?last:first).focus(); return; }
        if(e.shiftKey){
          if(document.activeElement===first){ e.preventDefault(); last.focus(); }
        } else {
          if(document.activeElement===last){ e.preventDefault(); first.focus(); }
        }
      };
      viewer.addEventListener('keydown', trapHandler);
    }

    function open(img){
      var big=viewer.querySelector('img');
      if(big)big.remove();
      var clone=img.cloneNode(true);
      clone.removeAttribute('loading');
      clone.removeAttribute('fetchpriority');
      clone.removeAttribute('sizes');
      clone.removeAttribute('srcset');   // always the full-size file here
      viewer.appendChild(clone);
      viewer.classList.add('active');
      syncModalState();
      trap();
      viewer.querySelector('.gal-viewer-close').focus();
    }
    function close(){
      if(!viewer.classList.contains('active'))return;
      viewer.classList.remove('active');
      if(trapHandler){ viewer.removeEventListener('keydown', trapHandler); trapHandler=null; }
      syncModalState();
      if(opener){opener.focus();opener=null;}
    }

    gallery.addEventListener('click',function(e){
      var btn=e.target.closest('.gal-zoom-btn');
      if(!btn)return;
      var img=btn.querySelector('img');
      if(!img)return;
      opener=btn;
      open(img);
    });
    // Tapping the backdrop or the image both dismiss — the whole surface is
    // cursor:zoom-out, so anywhere the pointer lands should close it.
    viewer.addEventListener('click',close);
    window.closeGalleryViewer=close;
  })();

  // Escape key — close overlays + mobile menu
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      var gv=document.getElementById('galViewer');
      if(gv&&gv.classList.contains('active')){window.closeGalleryViewer();return;}
      if (document.getElementById('paymentFailedOverlay').classList.contains('active')) {
        window.closePaymentFailedOverlay();
        return;
      }
      var cartOv=document.getElementById('cartOverlay');
      if(cartOv&&cartOv.classList.contains('active')){closeCartDrawer();return;}
      closeCheckout();
      var menu=document.getElementById('navMenu');
      if(menu&&menu.classList.contains('open')){
        menu.classList.remove('open');
        var tg=document.querySelector('.site-nav .nav-toggle');
        if(tg)tg.setAttribute('aria-expanded','false');
      }
    }
  });

  // Mobile nav dropdown toggle (matches the homepage).
  (function(){
    var btn=document.querySelector('.site-nav .nav-toggle');
    var menu=document.getElementById('navMenu');
    if(!btn||!menu)return;
    btn.addEventListener('click',function(){
      var open=menu.classList.toggle('open');
      btn.setAttribute('aria-expanded',open?'true':'false');
      btn.setAttribute('aria-label',open?'Close menu':'Open menu');
    });
    menu.addEventListener('click',function(e){
      if(e.target.tagName==='A'){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');}
    });
  })();

  // Reflect any persisted cart quantity in the nav badge on load, and seed the
  // PDP stepper from it so a returning visitor sees the number they left in
  // the cart rather than a reset 1.
  renderCart();
  if (getCartQty() > 0) pdpQty = getCartQty();
  renderPdpQty();

  // Deep links from other pages.
  //   ?cart=open  — header cart button elsewhere on the site: show the drawer.
  //   ?buy=1/2/3  — a "Buy now" CTA on the homepage or a policy page: set bundle qty and open checkout form straight away.
  try {
    var _q = new URLSearchParams(location.search);
    var _buyParam = _q.get('buy');
    if (_q.get('cart') === 'open') {
      openCartDrawer();
    } else if (_buyParam) {
      var bQty = parseInt(_buyParam, 10);
      if (!isNaN(bQty) && bQty > 0) {
        pdpQty = Math.max(1, Math.min(5, bQty));
        setCartQty(pdpQty);
        renderPdpQty();
        buyNow();
      } else {
        buyNow();
      }
    }
  } catch (e) {}

  // Clear red border and error message on input and focus
  document.querySelectorAll('.overlay input, .overlay textarea').forEach(function(input){
    input.addEventListener('focus', function(){ this.style.borderColor=''; this.removeAttribute('aria-invalid'); hideError(); });
    input.addEventListener('input', function(){ this.style.borderColor=''; this.removeAttribute('aria-invalid'); hideError(); });
  });


  /* Pack picker on homepage (and any [data-so-pack] control). Qty is the pack. */
  function bindPacks() {
    var nodes = document.querySelectorAll('[data-so-pack]');
    if (!nodes.length) return;
    function apply(qty, origin) {
      pdpQty = Math.max(1, Math.min(5, qty));
      renderPdpQty();
      for (var i = 0; i < nodes.length; i++) {
        var on = parseInt(nodes[i].getAttribute('data-so-pack'), 10) === pdpQty;
        nodes[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        nodes[i].setAttribute('aria-checked', on ? 'true' : 'false');
      }
      var cta = document.querySelector('[data-so-buy] [data-so-cta], #buy [data-so-cta]');
      if (cta) {
        var totals = (function(){
          var sub = pdpQty === 2 ? 429 : pdpQty === 3 ? 599 : 229 * pdpQty;
          return sub;
        })();
        var prepaid = document.querySelector('[data-so-buy] [data-so-pay="prepaid"][aria-pressed="true"], #buy [data-so-pay="prepaid"][aria-pressed="true"]');
        var payIsCod = !prepaid && document.querySelector('[data-so-buy] [data-so-pay="cod"][aria-pressed="true"], #buy [data-so-pay="cod"][aria-pressed="true"]');
        var amount = payIsCod ? (totals + 60) : totals;
        cta.textContent = 'Buy ODORSTRIKE — ₹' + amount;
        if (cta.tagName === 'A') cta.setAttribute('href', '/?buy=' + pdpQty);
      }
      var label = document.querySelector('[data-so-pack-label]');
      if (label) label.textContent = pdpQty + ' × 50ml';
    }
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', function () {
        apply(parseInt(this.getAttribute('data-so-pack'), 10) || 1, this);
      });
    }
    apply(pdpQty || 1);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPacks);
  } else {
    bindPacks();
  }

  /* Keep both cart badge IDs in sync (chrome uses sfCartCount). */
  var _renderCartOrig = renderCart;
  renderCart = function () {
    _renderCartOrig();
    var q = getCartQty();
    var chromeBadge = document.getElementById('sfCartCount');
    if (chromeBadge) {
      if (q > 0) { chromeBadge.textContent = q; chromeBadge.hidden = false; }
      else { chromeBadge.hidden = true; }
    }
  };
  renderCart();
})();
