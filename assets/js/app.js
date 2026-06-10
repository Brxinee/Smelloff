const CFG = window.SMELLOFF_CONFIG;
  const VARIANTS = {
    solo: { title: 'Starter Strike — ODORSTRIKE', units: '1 × 50ml', amount: CFG.PRICES.solo, mrp: CFG.MRP.solo, label: 'solo' },
    duo:  { title: 'Double Strike — ODORSTRIKE',  units: '2 × 50ml', amount: CFG.PRICES.duo,  mrp: CFG.MRP.duo,  label: 'duo'  },
    trio: { title: 'Triple Strike — ODORSTRIKE',  units: '3 × 50ml', amount: CFG.PRICES.trio, mrp: CFG.MRP.trio, label: 'trio' }
  };

  let currentVariant = 'solo';
  let payMethod = 'prepaid'; // matches the default-active .pay-opt[data-method="prepaid"] (UPI path = payMethod !== 'cod'); intentional, not ambiguous

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

  function openCheckout(variant) {
    _checkoutTrigger = document.activeElement;
    currentVariant = variant;
    const v = VARIANTS[variant];
    const total = v.amount;
    document.getElementById('checkoutTitle').textContent = v.title;
    document.getElementById('checkoutVariant').textContent = v.units;
    document.getElementById('checkoutAmount').textContent = '₹' + v.amount;
    document.getElementById('checkoutTotal').textContent = '₹' + total;
    var shipEl = document.getElementById('checkoutShipping');
    if (shipEl) shipEl.textContent = 'Free ✓';
    var upiAmtInline = document.getElementById('upiAmountInline');
    if (upiAmtInline) upiAmtInline.textContent = '₹' + total;
    document.getElementById('submitText').textContent = (payMethod === 'cod' ? 'PLACE COD ORDER · ₹' : 'OPEN UPI APP · ₹') + total;
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('successScreen').style.display = 'none';
    var lsEl = document.getElementById('loadingScreen');
    if (lsEl) { lsEl.classList.remove('active'); lsEl.style.display = 'none'; }
    document.getElementById('checkoutOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
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
    document.getElementById('checkoutOverlay').classList.remove('active');
    document.body.style.overflow = '';
    var lsEl = document.getElementById('loadingScreen');
    if (lsEl) { lsEl.classList.remove('active'); lsEl.style.display = 'none'; }
    const upiBlock = document.getElementById('upiBlock');
    if (upiBlock) upiBlock.style.display = 'none';
    if (typeof window.stopUpiCountdown === 'function') window.stopUpiCountdown();
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
    var focusable = overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    _overlayFocusTrapHandler = function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    overlay.addEventListener('keydown', _overlayFocusTrapHandler);
  }

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
    const v = VARIANTS[currentVariant];
    const total = v.amount;
    // Reflect amount in inline UPI panel
    var upiAmtInline = document.getElementById('upiAmountInline');
    if (upiAmtInline) upiAmtInline.textContent = '₹' + total;
    const label = method === 'cod' ? 'PLACE COD ORDER · ₹' + total : 'OPEN UPI APP · ₹' + total;
    document.getElementById('submitText').textContent = label;
    // AddPaymentInfo event
    if (typeof fbq !== 'undefined') fbq('track', 'AddPaymentInfo', { payment_type: method });
    if (typeof gtag !== 'undefined') gtag('event', 'add_payment_info', { payment_type: method });
  }

  function showError(msg) {
    const el = document.getElementById('checkoutError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    const wa = document.getElementById('waFallback');
    if (wa) wa.style.display = 'block';
  }

  function hideError() {
    const el = document.getElementById('checkoutError');
    if (el) el.style.display = 'none';
    const wa = document.getElementById('waFallback');
    if (wa) wa.style.display = 'none';
  }

  function validateForm() {
    // Clear previous red borders
    document.querySelectorAll('.overlay input, .overlay textarea').forEach(function(i){i.style.borderColor='';});
    // Email is OPTIONAL — not in required list
    const fields = ['f_phone','f_name','f_addr','f_pin','f_city','f_state'];
    for (const id of fields) {
      const el = document.getElementById(id);
      if (!el) { showError('Please fill all required fields.'); return false; }
      if (!el.value.trim()) { el.style.borderColor='#ff6b6b'; el.focus(); showError('Please fill all required fields.'); return false; }
    }
    const phone = document.getElementById('f_phone').value.trim();
    if (!/^[6-9]\d{9}$/.test(phone)) { document.getElementById('f_phone').style.borderColor='#ff6b6b'; showError('Enter a valid 10-digit mobile number.'); return false; }
    const pin = document.getElementById('f_pin').value.trim();
    if (!/^\d{6}$/.test(pin)) { document.getElementById('f_pin').style.borderColor='#ff6b6b'; showError('Enter a valid 6-digit pincode.'); return false; }
    // Email is OPTIONAL — only validate if non-empty
    const emailEl = document.getElementById('f_email');
    const email = emailEl ? emailEl.value.trim() : '';
    if (email && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) { if (emailEl) emailEl.style.borderColor='#ff6b6b'; showError('Enter a valid email or leave it blank.'); return false; }
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

  // Maps the in-page variant keys (solo/duo/trio + cart) to the backend schema
  // (variant, variantLabel, units) — kept here so the rest of the UI stays stable.
  const SHEET_VARIANT = {
    solo: { variant: 'starter', label: 'Starter Strike — 1 × 50ml', bottles: 1 },
    duo:  { variant: 'duo',     label: 'Duo Strike — 2 × 50ml',     bottles: 2 },
    trio: { variant: 'squad',   label: 'Squad Strike — 3 × 50ml',   bottles: 3 }
  };

  function collectOrder(orderId, paymentId) {
    const v = VARIANTS[currentVariant] || {};
    const baseAmount = Number(v.amount) || 0;
    const shipping = Number(calcShipping(baseAmount)) || 0;
    const sv = SHEET_VARIANT[currentVariant] || { variant: currentVariant, label: v.title || currentVariant, bottles: v.units ? (parseInt(v.units) || 1) : 1 };
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
      variantLabel: sv.label,
      units: sv.bottles,
      quantity: 1,
      amount: baseAmount,
      shipping: shipping,
      total: baseAmount + shipping,
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
      // onerror is expected here (Apps Script returns a non-image response); swallow it so it can't surface as console noise
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
    var ls = document.getElementById('loadingScreen');
    if (!ls) return;
    var ll = document.getElementById('loadingLabel');
    var ls2 = document.getElementById('loadingSub');
    if (label && ll) ll.textContent = label;
    if (sub && ls2) ls2.textContent = sub;
    ls.style.display = '';
    ls.classList.add('active');
  }

  function hideLoadingScreen() {
    var ls = document.getElementById('loadingScreen');
    if (ls) { ls.classList.remove('active'); ls.style.display = 'none'; }
  }

  function showSuccess(orderId, method) {
    hideLoadingScreen();
    var cff = document.getElementById('checkoutForm');
    if (cff) cff.style.display = 'none';
    var ssc = document.getElementById('successScreen');
    if (ssc) ssc.style.display = 'block';
    var ub = document.getElementById('upiBlock');
    if (ub) ub.style.display = 'none';
    var oid = document.getElementById('orderIdDisplay');
    if (oid) oid.textContent = orderId;
    var trk = document.getElementById('successTrackLink');
    if (trk) { trk.href = '/track-order?code=' + encodeURIComponent(orderId); trk.style.display = 'inline-block'; }

    var amount = VARIANTS[currentVariant].amount;
    var name = (document.getElementById('f_name') ? document.getElementById('f_name').value.trim() : '') || '';
    var phone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : '') || '';

    if (method === 'cod') {
      document.getElementById('successTag').textContent = 'Order received';
      document.getElementById('successHeading').textContent = "COD order placed.";
      document.getElementById('successMsg').textContent = 'Our team will call to confirm within 24 hours. Pay ₹' + amount + ' to the delivery person on arrival.';
    } else {
      document.getElementById('successTag').textContent = 'Order confirmed';
      document.getElementById('successHeading').textContent = "You're done.";
      document.getElementById('successMsg').textContent = 'Our team ships your ODORSTRIKE within 48 hours.';
    }

    // Inject order ID, name, phone into WhatsApp links so the merchant can match UTR to order.
    var utrLink = document.getElementById('waSuccessUtrLink');
    if (utrLink) {
      utrLink.href = 'https://wa.me/919392974031?text=' + encodeURIComponent(
        'Order ' + orderId + '\n' +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Amount: ₹' + amount + '\n' +
        'UTR: [paste here]'
      );
    }
    var qLink = document.getElementById('waSuccessQuestionsLink');
    if (qLink) {
      qLink.href = 'https://wa.me/919392974031?text=' + encodeURIComponent(
        'Hi Smelloff, I have a question about my order.\nOrder ID: ' + orderId
      );
    }

    trackPurchase(VARIANTS[currentVariant].amount, orderId);
    // Unlock review submission (client-side gate — not tamper-proof).
    try {
      var buyerEmail = (document.getElementById('f_email') ? document.getElementById('f_email').value : '').trim().toLowerCase();
      localStorage.setItem('smelloff_purchased', 'true');
      if (buyerEmail) localStorage.setItem('smelloff_purchased_email', buyerEmail);
      // Clear cart after successful order so user doesn't see stale items
      if (typeof window.clearCart === 'function') window.clearCart();
      // Show/hide email confirmation note based on whether user gave an email
      var emailNote = document.getElementById('successEmailNote');
      if (emailNote) emailNote.style.display = buyerEmail ? 'block' : 'none';
    } catch (e) { /* localStorage may be blocked in private mode */ }
  }

  async function submitOrder() {
    hideError();
    if (!validateForm()) return;

    const btn = document.getElementById('submitBtn');
    const btnText = document.getElementById('submitText');
    btn.disabled = true;
    btnText.innerHTML = '<span class="loader"></span>Processing...';

    const orderId = genOrderId();
    const total = VARIANTS[currentVariant].amount;

    if (payMethod === 'cod') {
      const order = collectOrder(orderId, 'COD');
      logOrderToSheets(order);
      if (typeof window.createSupabaseOrder === 'function') {
        window.createSupabaseOrder({
          email: order.email, phone: order.phone,
          items: [{ name: 'ODORSTRIKE Fabric Mist', variant: order.variant, label: order.variantLabel, quantity: order.units, price: order.amount }],
          amountRupees: order.total, paymentMethod: 'cod',
          address: { name: order.name, line: order.address, city: order.city, state: order.state, pincode: order.pincode },
          upiRef: null,
          orderCode: order.orderId
        });
      }
      if (order.email) {
        SmelloffEmail.send('orderConfirmation', order.email, {
          orderId: order.orderId,
          customerName: order.name || 'there',
          amount: String(order.total),
          address: [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', '),
          paymentMethod: 'Cash on Delivery'
        }).catch(console.error);
      }
      showLoadingScreen('Placing your order…', 'Confirming with our team');
      setTimeout(() => {
        btn.disabled = false;
        showSuccess(orderId, 'cod');
      }, 2400);
      return;
    }

    // UPI — no timer; order persists. User pays whenever.
    const order = collectOrder(orderId, 'UPI_PENDING');
    logOrderToSheets(order);
    if (typeof window.createSupabaseOrder === 'function') {
      window.createSupabaseOrder({
        email: order.email, phone: order.phone,
        items: [{ name: 'ODORSTRIKE Fabric Mist', variant: order.variant, label: order.variantLabel, quantity: order.units, price: order.amount }],
        amountRupees: order.total, paymentMethod: 'upi',
        address: { name: order.name, line: order.address, city: order.city, state: order.state, pincode: order.pincode },
        upiRef: null, // UTR is shared by customer via WhatsApp; matched manually
        orderCode: order.orderId
      });
    }
    if (order.email) {
      SmelloffEmail.send('orderConfirmation', order.email, {
        orderId: order.orderId,
        customerName: order.name || 'there',
        amount: String(order.total),
        address: [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', '),
        paymentMethod: 'UPI (' + CFG.UPI_ID + ')'
      }).catch(function(e){ console.error('Order email failed:', e); });
    }

    const upiLink = buildUpiLink(total, orderId);
    showLoadingScreen('Confirming payment…', 'Securing your UPI session');
    setTimeout(function() {
      btn.disabled = false;
      showUpiSuccess(orderId, total, upiLink);
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        // Defer one tick so the success screen renders before the UPI redirect.
        setTimeout(function(){ window.location.href = upiLink; }, 150);
      }
    }, 2400);
  }

  // Copy UPI ID to clipboard with brief "Copied ✓" confirmation
  window.copyUpiId = async function() {
    const id = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.UPI_ID) || 'mr.brainy@ibl';
    const btn = document.getElementById('upiCopyBtn');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        // Fallback for older browsers
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
      startUpiCountdown();
    } catch (e) { console.warn('[Smelloff] UPI copy failed:', e); }
  };

  // UPI payment-window countdown — starts (or resets) when the user copies the UPI ID.
  var _upiCountdownTimer = null;
  function startUpiCountdown(){
    var wrap = document.getElementById('upiCountdown');
    var timeEl = document.getElementById('upiCountdownTime');
    if (!wrap || !timeEl) return;
    if (_upiCountdownTimer) clearInterval(_upiCountdownTimer);
    var remaining = 600; // 10:00 in seconds
    wrap.style.display = '';
    wrap.classList.remove('expired');
    function render(){
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }
    render();
    _upiCountdownTimer = setInterval(function(){
      remaining--;
      if (remaining <= 0) {
        remaining = 0;
        render();
        clearInterval(_upiCountdownTimer);
        _upiCountdownTimer = null;
        wrap.classList.add('expired');
        timeEl.textContent = 'expired — copy again to restart';
        return;
      }
      render();
    }, 1000);
  }
  window.stopUpiCountdown = function(){
    if (_upiCountdownTimer) { clearInterval(_upiCountdownTimer); _upiCountdownTimer = null; }
    var wrap = document.getElementById('upiCountdown');
    if (wrap) { wrap.style.display = 'none'; wrap.classList.remove('expired'); }
  };

  function buildUpiLink(amount, orderId) {
    const params = new URLSearchParams({
      pa: CFG.UPI_ID,
      pn: CFG.UPI_NAME,
      am: String(amount),
      cu: 'INR',
      tn: 'ODORSTRIKE-' + orderId
    });
    return 'upi://pay?' + params.toString();
  }

  function showUpiSuccess(orderId, total, upiLink) {
    hideLoadingScreen();
    document.getElementById('checkoutForm').style.display = 'none';
    const s = document.getElementById('successScreen');
    s.style.display = 'block';
    document.getElementById('successTag').textContent = 'Order received';
    document.getElementById('successHeading').textContent = 'Pay ₹' + total + ' via UPI';
    document.getElementById('successMsg').textContent = 'Order received. Send your UTR to WhatsApp to confirm. We\'ll ship within 48 hours of confirmation.';
    document.getElementById('orderIdDisplay').textContent = orderId;
    var upiTrk = document.getElementById('successTrackLink');
    if (upiTrk) { upiTrk.href = '/track-order?code=' + encodeURIComponent(orderId); upiTrk.style.display = 'inline-block'; }

    // Populate UPI block
    document.getElementById('upiBlock').style.display = 'block';
    document.getElementById('upiIdShow').textContent = CFG.UPI_ID;
    document.getElementById('upiAmountShow').textContent = '₹' + total;
    document.getElementById('upiNoteShow').textContent = 'ODORSTRIKE-' + orderId;
    const openBtn = document.getElementById('upiOpenBtn');
    openBtn.href = upiLink;
    openBtn.textContent = 'Open UPI app · ₹' + total;

    // Prefill WhatsApp UTR link with order context so merchant can match UTR to order
    const name = (document.getElementById('f_name') ? document.getElementById('f_name').value.trim() : '') || '';
    const phone = (document.getElementById('f_phone') ? document.getElementById('f_phone').value.trim() : '') || '';
    const utrLink = document.getElementById('waSuccessUtrLink');
    if (utrLink) {
      utrLink.href = 'https://wa.me/919392974031?text=' + encodeURIComponent(
        'Order ' + orderId + '\n' +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Amount: ₹' + total + '\n' +
        'UTR: [paste here]'
      );
    }
    const qLink = document.getElementById('waSuccessQuestionsLink');
    if (qLink) {
      qLink.href = 'https://wa.me/919392974031?text=' + encodeURIComponent(
        'Hi Smelloff, I have a question about my order.\nOrder ID: ' + orderId
      );
    }

    // QR for the UPI deep link (any UPI app reads this)
    const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data=' + encodeURIComponent(upiLink);
    const qrImg = document.getElementById('upiQR');
    if (qrImg) {
      qrImg.style.display = '';
      qrImg.src = qrSrc;
      qrImg.onerror = function(){ qrImg.style.display = 'none'; };
    }

    trackPurchase(VARIANTS[currentVariant].amount, orderId);
    try {
      const buyerEmail = (document.getElementById('f_email') ? document.getElementById('f_email').value : '').trim().toLowerCase();
      localStorage.setItem('smelloff_purchased', 'true');
      if (buyerEmail) localStorage.setItem('smelloff_purchased_email', buyerEmail);
      if (typeof window.clearCart === 'function') window.clearCart();
      var emailNote = document.getElementById('successEmailNote');
      if (emailNote) emailNote.style.display = buyerEmail ? 'block' : 'none';
    } catch (e) {}
  }

  // UPI timer removed — manual UPI does not expire.

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
    o.classList.add('active');
    o.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  };
  window.closePaymentFailedOverlay = function() {
    document.getElementById('paymentFailedOverlay').classList.remove('active');
    // If checkout overlay is still open, keep body locked.
    const checkoutOpen = document.getElementById('checkoutOverlay').classList.contains('active');
    if (!checkoutOpen) {
      document.body.style.overflow = '';
      window.scrollTo(0, _pfPrevScroll);
    }
  };
  // ESC key closes the policy overlay (without dismissing the underlying checkout)
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.getElementById('paymentFailedOverlay').classList.contains('active')) {
      window.closePaymentFailedOverlay();
    }
  });

  // Close on overlay click (outside panel)
  document.getElementById('checkoutOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutOverlay') closeCheckout();
  });

  // ==============================
  // ANALYTICS EVENTS
  // ==============================
  function trackInitCheckout() {
    if (typeof fbq !== 'undefined') fbq('track', 'InitiateCheckout');
    if (typeof gtag !== 'undefined') gtag('event', 'begin_checkout');
  }
  function trackPurchase(amount, orderId) {
    if (typeof fbq !== 'undefined') fbq('track', 'Purchase', { value: amount, currency: 'INR' });
    if (typeof gtag !== 'undefined') gtag('event', 'purchase', {
      transaction_id: orderId, value: amount, currency: 'INR'
    });
  }
  window.trackInitCheckout = trackInitCheckout;

  // =============================================
  // BUY-BOX QUANTITY SELECTOR
  // =============================================
  // Maps the 1/2/3 quantity buttons to solo/duo/trio variants
  // and updates the CTA label + hint inline.
  let _buyBoxQty = 1;
  window.selectQty = function(qty){
    _buyBoxQty = qty;
    document.querySelectorAll('.pc-pack-card').forEach(function(b){
      var active = parseInt(b.dataset.qty,10) === qty;
      b.classList.toggle('active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    var variant = qty === 3 ? 'trio' : qty === 2 ? 'duo' : 'solo';
    var price = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES[variant]) || (qty === 3 ? 549 : qty === 2 ? 399 : 229);
    var sprays = qty === 3 ? 750 : qty === 2 ? 500 : 250;
    var perSpray = (price / sprays).toFixed(2);

    var priceMain = document.getElementById('pcPriceMain');
    if (priceMain) priceMain.textContent = '₹' + price;

    // CO1 — price anchoring: struck MRP + discount %
    var mrp = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.MRP && window.SMELLOFF_CONFIG.MRP[variant]) || (qty === 3 ? 1399 : qty === 2 ? 999 : 579);
    var off = Math.round((mrp - price) / mrp * 100);
    var priceMrp = document.getElementById('pcPriceMrp'); if (priceMrp) priceMrp.textContent = '₹' + mrp;
    var priceOff = document.getElementById('pcPriceOff'); if (priceOff) priceOff.textContent = off + '% OFF';
    var svCtaPrice = document.getElementById('svCtaPrice'); if (svCtaPrice) svCtaPrice.textContent = '₹' + price;

    var perUse = document.getElementById('pcPerUse');
    if (perUse) perUse.textContent = '₹' + price + ' = ~' + sprays + ' sprays. Works out to ₹' + perSpray + ' per spray.';

    // COD trust stack — reflect the amount due on delivery
    var codTrustAmt = document.getElementById('codTrustAmt');
    if (codTrustAmt) codTrustAmt.textContent = '₹' + price;

    // Sync mobile sticky-bar pack pills
    document.querySelectorAll('.mobile-bar .mb-pill').forEach(function(p){
      var active = parseInt(p.dataset.qty,10) === qty;
      p.classList.toggle('active', active);
      p.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    var cta = document.getElementById('pcCta');
    var codCta = document.getElementById('pcCodCta');
    var hint = document.getElementById('pcQtyHint');
    if (cta) cta.textContent = 'BUY NOW — ₹' + price + ' →';
    // BUG: data-price was written here but never read anywhere (buyBoxCod derives price from _buyBoxQty) — removed dead code
    // Sync mobile sticky bar price (button handler stays as mobileBarBuy)
    var mbNow = document.querySelector('.mobile-bar .mb-now');
    if (mbNow) mbNow.textContent = '₹' + price;
    // Final CTA stays the ₹229 solo entry hook (intentionally not synced to pack price)
    if (hint) {
      if (qty === 1) hint.textContent = 'Add a 2nd bottle for +₹170 and save ₹600 vs MRP.';
      else if (qty === 2) hint.textContent = 'Smart pick — one for your bag, one for your desk.';
      else hint.textContent = 'Best value — ₹183/bottle. Stock up or gift the extras.';
    }
  };
  window.buyBoxAdd = function(){
    var variant = _buyBoxQty === 3 ? 'trio' : _buyBoxQty === 2 ? 'duo' : 'solo';
    if (typeof window.addToCart === 'function') window.addToCart(variant);
  };
  window.buyBoxCod = function(){
    var variant = _buyBoxQty === 3 ? 'trio' : _buyBoxQty === 2 ? 'duo' : 'solo';
    payMethod = 'cod';
    openCheckout(variant);
    selectPay('cod');
  };
  // Sticky bar pack pill — select the pack everywhere (no scroll)
  window.mobileBarPick = function(qty){
    if (typeof window.selectQty === 'function') window.selectQty(qty);
  };
  // Sticky bar BUY NOW — scroll to #buy and highlight the matching pack
  window.mobileBarBuy = function(){
    if (typeof window.selectQty === 'function') window.selectQty(_buyBoxQty);
    var buy = document.getElementById('buy');
    var card = document.querySelector('.product-card');
    if (buy) buy.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (card) {
      card.classList.remove('pulse');
      void card.offsetWidth; // restart animation
      card.classList.add('pulse');
      setTimeout(function(){ card.classList.remove('pulse'); }, 900);
    }
  };
  // Expose closeEngagePopup (no engagement popup in current build — no-op stub)
  window.closeEngagePopup = function(){};
  // ViewContent fires when #buy section enters viewport
  (function(){
    var buySection = document.getElementById('buy');
    if (!buySection || !('IntersectionObserver' in window)) return;
    var fired = false;
    var obs = new IntersectionObserver(function(entries){
      if (fired) return;
      if (entries[0].isIntersecting) {
        fired = true;
        var vcPrice = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES[_buyBoxQty === 3 ? 'trio' : _buyBoxQty === 2 ? 'duo' : 'solo']) || (_buyBoxQty === 3 ? 549 : _buyBoxQty === 2 ? 399 : 229);
        if (typeof fbq !== 'undefined') fbq('track', 'ViewContent', { content_name: 'ODORSTRIKE', value: vcPrice, currency: 'INR' });
        if (typeof gtag !== 'undefined') gtag('event', 'view_item', { currency: 'INR', value: vcPrice, items: [{ item_id: 'OS-001-50ML', item_name: 'ODORSTRIKE Fabric Odor Mist' }] });
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(buySection);
  })();


  // =============================================
  // NAV: open / close / focus trap
  // =============================================
  window.openNav = function() {
    var menu = document.getElementById('mobileMenu');
    var btn  = document.getElementById('hamburgerBtn');
    var items = menu.querySelectorAll('.menu-item');
    // Reset items so entry animation replays
    items.forEach(function(el) { el.style.transitionDelay = ''; });
    menu.classList.add('active');
    menu.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
    // Push history state so back button closes the menu
    history.pushState({ navOpen: true }, '');
    // After all items have animated in, clear delays so hover is instant
    var clearAfter = 150 + (items.length - 1) * 80 + 620;
    setTimeout(function() {
      items.forEach(function(el) { el.style.transitionDelay = '0ms'; });
    }, clearAfter);
    trapFocus(menu);
  };

  window.closeNav = function() {
    var menu  = document.getElementById('mobileMenu');
    var btn   = document.getElementById('hamburgerBtn');
    var items = Array.from(menu.querySelectorAll('.menu-item'));
    var count = items.length;
    // Reverse stagger out (bottom-up)
    items.forEach(function(el, i) {
      var delay = (count - 1 - i) * 60;
      el.style.transitionDelay = delay + 'ms';
      el.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
    });
    // Slide panel up after items clear
    setTimeout(function() {
      menu.classList.remove('active');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      // Reset items for next open
      setTimeout(function() {
        items.forEach(function(el) {
          el.style.transition = '';
          el.style.transitionDelay = '';
          el.style.opacity = '';
          el.style.transform = '';
        });
      }, 520);
    }, 400);
  };

  function trapFocus(el) {
    var focusable = el.querySelectorAll('a[href], button:not([disabled])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    el.addEventListener('keydown', handler);
    // Remove trap when menu closes
    var obs = new MutationObserver(function() {
      if (!document.body.classList.contains('nav-open')) {
        el.removeEventListener('keydown', handler);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function() { first.focus(); }, 520);
  }

  // Escape key — close overlay + nav
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      closeCheckout();
      if(document.body.classList.contains('nav-open')) closeNav();
    }
  });

  // Android back button — close nav if open
  window.addEventListener('popstate', function(e){
    if(document.body.classList.contains('nav-open')) closeNav();
  });

  // Clear red border on input focus
  document.querySelectorAll('.overlay input, .overlay textarea').forEach(function(input){
    input.addEventListener('focus',function(){this.style.borderColor='';});
  });

  // Waitlist email capture (P2 #15)
  // Footer column accordion (mobile only — CSS forces open on desktop)
  window.toggleFooterCol = function(colEl) {
    var isOpen = colEl.classList.toggle('open');
    var btn = colEl.querySelector('.sf-col-title');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  window.submitWaitlist = function() {
    const input = document.getElementById('waitlistEmail');
    if (!input) return;
    const email = input.value.trim();
    if (!email || !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      input.style.borderColor = '#a00';
      return;
    }
    input.style.borderColor = '';
    const url = CFG.SHEETS_ENDPOINT + '?email=' + encodeURIComponent(email);
    // Fire via image pixel (most reliable cross-origin)
    const img = new Image();
    img.src = url;
    // Also sendBeacon as backup
    if (navigator.sendBeacon) {
      const fd = new FormData();
      fd.append('email', email);
      navigator.sendBeacon(CFG.SHEETS_ENDPOINT, fd);
    }
    var emailForm = document.getElementById('emailForm');
    if (emailForm) emailForm.style.display = 'none';
    var ecSuccess = document.getElementById('ecSuccess');
    if (ecSuccess) ecSuccess.style.display = 'inline-block';
    SmelloffEmail.send('welcomeEmail', email, { customerName: 'there' }).catch(console.error);
  };

  // =============================================
  // REVIEWS: testers (hardcoded) + buyer reviews (Supabase)
  // =============================================
  // Buyer-submitted reviews persist in a Supabase Postgres table and are
  // visible to every visitor on every device. Public read + anon insert
  // via row-level security; the "verified buyer" gate is still a
  // localStorage flag set at checkout success — functional but
  // client-side only, harden with order-ID lookup later if abuse appears.
  (function(){
    // BUG: reviews used a separate publishable key, not the anon JWT in SMELLOFF_CONFIG, so fetch/post ran on the wrong credentials
    var SUPA_URL = (window.SMELLOFF_CONFIG || {}).SUPABASE_URL;
    var SUPA_KEY = (window.SMELLOFF_CONFIG || {}).SUPABASE_KEY;

    // 3 launch testers — hardcoded, always shown.
    var TESTERS = [
      {n:'Rohit S.',  c:'Hyderabad', r:5, d:60,  u:'Commute',        t:"Bike rider in Hyderabad heat — 2 sprays on the collar before leaving and the shirt smells neutral after a 40-min ride. Fits in my back pocket. Game changer."},
      {n:'Aarav M.',  c:'Bangalore', r:5, d:80,  u:'Gym',            t:"Used it on a polyester gym tee that already smelled even after washing. Sprayed it, waited 10 seconds — odor gone. Not masked. Actually gone."},
      {n:'Priya K.',  c:'Mumbai',    r:4, d:120, u:'Office formals', t:"Works on cotton kurtas and office shirts. Doesn't replace washing for heavy stains, but for re-wear days it's perfect. Pocket size is the real win."}
    ];

    var _buyerReviews = [];
    var _showAll = false;

    // escapeHtml now shared via window.escapeHtml (defined once in the config script)
    function starString(rating){
      var full = '★★★★★'.slice(0, rating);
      var empty = '★★★★★'.slice(rating);
      return '<span>'+full+'</span><span class="rv-s-empty">'+empty+'</span>';
    }
    function relativeDate(daysAgo){
      if (daysAgo < 1) return 'Today';
      if (daysAgo === 1) return 'Yesterday';
      if (daysAgo < 7) return daysAgo + ' days ago';
      if (daysAgo < 14) return '1 week ago';
      if (daysAgo < 30) return Math.floor(daysAgo/7) + ' weeks ago';
      if (daysAgo < 60) return '1 month ago';
      return Math.floor(daysAgo/30) + ' months ago';
    }
    function daysSinceISO(iso){
      var t = new Date(iso).getTime();
      if (isNaN(t)) return 0;
      return Math.max(0, Math.floor((Date.now() - t) / 86400000));
    }

    function fetchBuyerReviews(){
      return fetch(SUPA_URL + '/rest/v1/reviews?select=name,rating,body,city,anonymous,created_at&order=created_at.desc&limit=200', {
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY
        }
      })
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
    }

    function postBuyerReview(row){
      return fetch(SUPA_URL + '/rest/v1/reviews', {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(row)
      });
    }

    window.showAllReviews = function(){
      _showAll = true;
      var btn = document.getElementById('rvReadAllBtn');
      if (btn) btn.style.display = 'none';
      renderCards();
    };

    // TR4 — compute aggregate from REAL data (testers + buyer reviews); honest fallback labelling.
    function renderAggregate(all){
      var total = all.length;
      if (!total) return;
      var sum = all.reduce(function(a, r){ return a + (Number(r.r) || 0); }, 0);
      var avg = sum / total;
      var rounded = Math.round(avg);
      var stars = '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
      var buyers = _buyerReviews.length;
      var num = document.getElementById('rvAggNum'); if (num) num.textContent = avg.toFixed(1);
      var st = document.getElementById('rvAggStars'); if (st) st.textContent = stars;
      var cnt = document.getElementById('rvAggCount');
      if (cnt) cnt.textContent = buyers > 0
        ? ('Based on ' + total + ' reviews · ' + buyers + ' verified ' + (buyers === 1 ? 'buyer' : 'buyers'))
        : ('Based on ' + total + ' beta-tester reviews');
      // keep the hero rating honest too (no fabricated counts)
      var hc = document.querySelector('.hr-count'); if (hc) hc.textContent = '(' + total + (total === 1 ? ' review' : ' reviews') + ')';
      var hs = document.querySelector('.hr-stars'); if (hs) hs.textContent = stars;
      var hrow = document.querySelector('.hero-rating'); if (hrow) hrow.setAttribute('aria-label', 'Rated ' + avg.toFixed(1) + ' out of 5 from ' + total + ' reviews');
    }

    function renderCards(){
      var wrap = document.getElementById('rvScroll');
      if (!wrap) return;
      wrap.innerHTML = '';

      var buyers = _buyerReviews.map(function(r){
        return {
          n: (r.anonymous || !r.name) ? 'Anonymous' : r.name,
          c: r.city || '',
          r: r.rating,
          t: r.body,
          d: daysSinceISO(r.created_at),
          u: '',
          tester: false
        };
      });
      var testers = TESTERS.map(function(t){
        return {n:t.n, c:t.c, r:t.r, t:t.t, d:t.d, u:t.u, tester:true};
      });

      // Buyer reviews first (newest), then testers as foundation.
      var all = buyers.concat(testers);
      var total = all.length;

      renderAggregate(all);  // TR4 — real-data average + count

      var visible = _showAll ? all : all.slice(0, 6);

      var btn = document.getElementById('rvReadAllBtn');
      if (btn) {
        if (!_showAll && total > 6) {
          btn.style.display = '';
          btn.textContent = 'Read all ' + total + ' reviews →';
        } else {
          btn.style.display = 'none';
        }
      }

      visible.forEach(function(rv){
        var card = document.createElement('article');
        card.className = 'rv-card';
        card.setAttribute('role','listitem');
        var nameLine = escapeHtml(rv.n) + (rv.c ? ' · ' + escapeHtml(rv.c) : '');
        var badgeClass = rv.tester ? 'rv-verified rv-tester' : 'rv-verified';
        var badgeLabel = rv.tester ? 'Beta tester' : 'Verified buyer';
        var usecaseHtml = rv.u ? '<span class="rv-usecase">Used for: '+ escapeHtml(rv.u) +'</span>' : '';
        card.innerHTML =
          '<div class="rv-card-head">' +
            '<div class="rv-card-name-row">' +
              '<span class="rv-card-name">'+ nameLine +'</span>' +
              '<span class="'+ badgeClass +'" title="'+ badgeLabel +'">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>' +
                badgeLabel +
              '</span>' +
            '</div>' +
            '<span class="rv-card-date">'+ escapeHtml(relativeDate(rv.d)) +'</span>' +
          '</div>' +
          '<div class="rv-card-stars" aria-label="'+ rv.r +' out of 5 stars">'+ starString(rv.r) +'</div>' +
          usecaseHtml +
          '<p class="rv-card-text">'+ escapeHtml(rv.t) +'</p>';

        if (rv.t.length > 120) {
          var more = document.createElement('button');
          more.type = 'button';
          more.className = 'rv-card-more';
          more.textContent = 'Read more';
          more.addEventListener('click', function(){
            var expanded = card.classList.toggle('expanded');
            more.textContent = expanded ? 'Show less' : 'Read more';
          });
          card.appendChild(more);
        }

        wrap.appendChild(card);
      });
    }

    // --- Modal flow (purchase gate via localStorage, submit via Supabase) ---
    var selectedStars = 0;

    function showStep(id){
      ['rvStepAuth','rvStepForm','rvStepDone'].forEach(function(s){
        var el = document.getElementById(s);
        if (el) el.style.display = (s === id) ? 'block' : 'none';
      });
    }
    function isPurchased(){
      try { return localStorage.getItem('smelloff_purchased') === 'true'; }
      catch(e){ return false; }
    }

    var _reviewTrigger = null;
    window.openReviewForm = function(){
      _reviewTrigger = document.activeElement;
      var modal = document.getElementById('rvModal');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
      showStep(isPurchased() ? 'rvStepForm' : 'rvStepAuth');
    };

    window.closeReviewForm = function(){
      var modal = document.getElementById('rvModal');
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
      // BUG: unconditionally unlocked body scroll even when the checkout overlay was still open
      var coOpen = document.getElementById('checkoutOverlay');
      if (!(coOpen && coOpen.classList.contains('active'))) document.body.style.overflow = '';
      selectedStars = 0;
      document.querySelectorAll('#rvStarPicker button').forEach(function(b){ b.classList.remove('filled'); });
      var ta = document.getElementById('rvText'); if (ta) ta.value = '';
      var nm = document.getElementById('rvName'); if (nm) nm.value = '';
      var err = document.getElementById('rvFormError'); if (err) err.style.display = 'none';
    };

    var starButtons = document.querySelectorAll('#rvStarPicker button');
    starButtons.forEach(function(b){
      b.addEventListener('click', function(){
        selectedStars = parseInt(b.dataset.star, 10);
        starButtons.forEach(function(sb, i){
          sb.classList.toggle('filled', i < selectedStars);
        });
      });
    });

    window.submitReview = function(){
      var errEl = document.getElementById('rvFormError');
      errEl.style.display = 'none';
      var text = (document.getElementById('rvText').value || '').trim();
      var name = (document.getElementById('rvName').value || '').trim();
      if (selectedStars < 1) { errEl.textContent = 'Pick a star rating.'; errEl.style.display = 'block'; return; }
      if (text.length < 8) { errEl.textContent = 'Write at least a sentence.'; errEl.style.display = 'block'; return; }
      // BUG: JS allowed 600 chars while the textarea maxlength is 400 — limits now match
      if (text.length > 400) { errEl.textContent = 'Keep it under 400 characters.'; errEl.style.display = 'block'; return; }

      var anonymous = !name;
      var displayName = name ? name.slice(0, 60) : 'Anonymous';

      var submitBtn = document.querySelector('#rvStepForm .rv-submit');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Posting…'; }

      postBuyerReview({
        name: displayName,
        rating: selectedStars,
        body: text,
        anonymous: anonymous,
        // BUG: city was omitted so every new buyer review saved a blank city; no form field exists at review time, so send null explicitly
        city: null
      }).then(function(res){
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post review'; }
        if (!res || !res.ok) {
          return res.text().then(function(t){
            errEl.textContent = 'Could not post your review. Please try again.';
            errEl.style.display = 'block';
            console.warn('[Smelloff] Review post failed:', res && res.status, t);
          });
        }
        return res.json().then(function(rows){
          if (Array.isArray(rows) && rows.length) {
            _buyerReviews.unshift(rows[0]);
            renderCards();
          }
          showStep('rvStepDone');
        });
      }).catch(function(err){
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post review'; }
        errEl.textContent = 'Network error. Please check your connection and retry.';
        errEl.style.display = 'block';
        console.warn('[Smelloff] Review post error:', err);
      });
    };

    // Initial paint: testers only, then fetch buyer reviews.
    renderCards();
    fetchBuyerReviews().then(function(list){
      _buyerReviews = Array.isArray(list) ? list : [];
      renderCards();
    });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') {
        var modal = document.getElementById('rvModal');
        if (modal && modal.classList.contains('open')) closeReviewForm();
      }
    });
  })();

  // =============================================
  // FAQ: accordion toggle
  // =============================================
  window.toggleFaqItem = function(item) {
    var parent = item.parentElement;
    var wasOpen = item.classList.contains('open');
    // Close all siblings first
    if (parent) {
      parent.querySelectorAll('.faq-item.open').forEach(function(sibling) {
        if (sibling !== item) {
          sibling.classList.remove('open');
          var sb = sibling.querySelector('.faq-q');
          if (sb) sb.setAttribute('aria-expanded', 'false');
          var sbody = sibling.querySelector('.faq-body');
          if (sbody) sbody.setAttribute('aria-hidden', 'true');
        }
      });
    }
    var isOpen = wasOpen ? false : true;
    item.classList.toggle('open', isOpen);
    var btn = item.querySelector('.faq-q');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var body = item.querySelector('.faq-body');
    if (body) body.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  };

  // Mobile sticky bar — slides up after scrolling 400px past the hero,
  // and disappears while the #buy section is in the viewport (IntersectionObserver).
  (function(){
    var bar = document.getElementById('mobileBar');
    if (!bar) return;
    var buy = document.getElementById('buy');
    var scrolledEnough = false;
    var buyInView = false;

    function update(){
      var overlay = document.getElementById('checkoutOverlay');
      var overlayOpen = overlay && overlay.classList.contains('active');
      var show = scrolledEnough && !buyInView && !overlayOpen;
      bar.classList.toggle('visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    window._updateMobileBar = update;

    // Hide whenever the main #buy section is on screen.
    if (buy && 'IntersectionObserver' in window) {
      new IntersectionObserver(function(entries){
        buyInView = entries[0].isIntersecting;
        update();
      }, { threshold: 0.01 }).observe(buy);
    }

    // Reveal after scrolling 400px past the top of the hero.
    var ticking = false;
    function onScroll(){
      scrolledEnough = window.scrollY > 400;
      ticking = false;
      update();
    }
    window.addEventListener('scroll', function(){
      if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    }, {passive:true});
    window.addEventListener('resize', onScroll, {passive:true});
    onScroll();
  })();

  // Hero testimonial ticker — rotate one quote every 4s with a fade.
  (function(){
    var ticker = document.getElementById('heroTicker');
    if (!ticker) return;
    var quotes = ticker.querySelectorAll('.ht-quote');
    if (quotes.length < 2) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var i = 0;
    setInterval(function(){
      quotes[i].classList.remove('active');
      i = (i + 1) % quotes.length;
      quotes[i].classList.add('active');
    }, 4000);
  })();

  // =============================================
  // CART: localStorage state, drawer, toast
  // =============================================
  (function(){
    const STORAGE_KEY = 'smelloff_cart';
    const PRODUCTS = {
      solo: { id: 'solo', name: 'Starter Strike — 1 × 50ml', price: 229, variant: 'solo' },
      duo:  { id: 'duo',  name: 'Double Strike — 2 × 50ml',  price: 399, variant: 'duo'  },
      trio: { id: 'trio', name: 'Triple Strike — 3 × 50ml',  price: 549, variant: 'trio' }
    };

    let cart = load();

    function load(){
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { items: [], count: 0 };
        const parsed = JSON.parse(raw);
        parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
        parsed.count = parsed.items.reduce((a,i) => a + (i.qty||0), 0);
        return parsed;
      } catch(e) { return { items: [], count: 0 }; }
    }

    function save(){
      cart.count = cart.items.reduce((a,i) => a + (i.qty||0), 0);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch(e){}
      renderBadge();
      // BUG: threw TypeError when #cartDrawer was absent from the DOM
      var cd = document.getElementById('cartDrawer');
      if (cd && cd.classList.contains('open')) renderDrawer();
    }

    function renderBadge(){
      const badge = document.getElementById('navCartCount');
      if (!badge) return;
      badge.textContent = cart.count;
      badge.style.display = cart.count > 0 ? '' : 'none';
    }

    function showToast(text){
      const toast = document.getElementById('cartToast');
      if (!toast) return;
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function trackAddToCartEvent(p){
      try {
        if (typeof fbq !== 'undefined') fbq('track', 'AddToCart', { value: p.price, currency: 'INR', content_ids: [p.id], content_type: 'product' });
        if (typeof gtag !== 'undefined') gtag('event', 'add_to_cart', {
          currency: 'INR', value: p.price,
          items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
        });
      } catch(e) { console.warn('[Smelloff] AddToCart tracking failed:', e); }
    }

    // escapeHtml now shared via window.escapeHtml (defined once in the config script)

    function renderDrawer(){
      const body = document.getElementById('cartDrawerBody');
      const foot = document.getElementById('cartDrawerFooter');
      if (!body || !foot) return;

      if (cart.items.length === 0) {
        body.innerHTML =
          '<div class="cd-empty">' +
            '<p class="cd-empty-title">Your cart is empty</p>' +
            '<p class="cd-empty-sub">Add ODORSTRIKE to get started.</p>' +
            '<button class="cd-empty-cta" type="button" onclick="closeCartDrawer();setTimeout(function(){document.getElementById(\'buy\').scrollIntoView({behavior:\'smooth\'})},320)">Shop now</button>' +
          '</div>';
        foot.style.display = 'none';
        return;
      }

      body.innerHTML = cart.items.map(it =>
        '<div class="cd-line">' +
          '<div class="cd-thumb" aria-hidden="true"></div>' +
          '<div class="cd-info">' +
            '<div class="cd-name">' + escapeHtml(it.name) + '</div>' +
            '<div class="cd-price">₹' + it.price + '</div>' +
          '</div>' +
          '<div class="cd-qty" role="group" aria-label="Quantity">' +
            '<button type="button" aria-label="Decrease quantity" onclick="updateCartQty(\'' + it.id + '\',-1)">−</button>' +
            '<span>' + it.qty + '</span>' +
            '<button type="button" aria-label="Increase quantity" onclick="updateCartQty(\'' + it.id + '\',1)">+</button>' +
          '</div>' +
          '<button class="cd-remove" type="button" aria-label="Remove item" onclick="removeFromCart(\'' + it.id + '\')">' +
            '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>' +
          '</button>' +
        '</div>'
      ).join('');

      const subtotal = cart.items.reduce((a,i) => a + i.price * i.qty, 0);
      const total = subtotal;

      foot.innerHTML =
        '<div class="cd-subtotal"><span>Subtotal</span><strong>₹' + subtotal + '</strong></div>' +
        '<div class="cd-ship">' +
          '<span class="cd-ship-msg free">✓ Free shipping across India</span>' +
        '</div>' +
        '<button class="cd-checkout" type="button" onclick="checkoutFromCart()">Checkout — ₹' + total + '</button>' +
        '<button class="cd-continue" type="button" onclick="closeCartDrawer()">Continue shopping</button>';
      foot.style.display = 'flex';
    }

    window.addToCart = function(variant){
      const p = PRODUCTS[variant];
      if (!p) return;
      const existing = cart.items.find(i => i.id === p.id);
      if (existing) existing.qty++;
      else cart.items.push({ id: p.id, name: p.name, price: p.price, variant: p.variant, qty: 1 });
      save();
      showToast('Added to cart');
      trackAddToCartEvent(p);
      // Auto-open the cart drawer so the user immediately sees what's in their cart.
      // Conversion-friendlier than a 2-second toast that disappears.
      if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
    };

    window.removeFromCart = function(id){
      cart.items = cart.items.filter(i => i.id !== id);
      save();
    };

    window.updateCartQty = function(id, delta){
      const it = cart.items.find(i => i.id === id);
      if (!it) return;
      it.qty += delta;
      if (it.qty <= 0) cart.items = cart.items.filter(i => i.id !== id);
      save();
    };

    var _cartTrigger = null;
    window.openCartDrawer = function(){
      _cartTrigger = document.activeElement;
      renderDrawer();
      const drawer = document.getElementById('cartDrawer');
      const backdrop = document.getElementById('cartBackdrop');
      drawer.classList.add('open');
      backdrop.classList.add('active');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      var closeBtn = drawer.querySelector('.cd-close');
      if (closeBtn) setTimeout(function(){ closeBtn.focus(); }, 50);
    };

    window.closeCartDrawer = function(){
      const drawer = document.getElementById('cartDrawer');
      const backdrop = document.getElementById('cartBackdrop');
      drawer.classList.remove('open');
      backdrop.classList.remove('active');
      drawer.setAttribute('aria-hidden', 'true');
      if (_cartTrigger && typeof _cartTrigger.focus === 'function') {
        setTimeout(function(){ try{_cartTrigger.focus({preventScroll:true});}catch(e){_cartTrigger.focus();} _cartTrigger = null; }, 50);
      }
      // only release overflow if no other overlay is open
      if (!document.getElementById('checkoutOverlay').classList.contains('active') &&
          !document.getElementById('rvModal').classList.contains('open') &&
          !document.body.classList.contains('nav-open')) {
        document.body.style.overflow = '';
      }
    };

    window.clearCart = function(){
      cart = { items: [], count: 0 };
      try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
      renderBadge();
      // BUG: threw TypeError when #cartDrawer was absent from the DOM
      var cd = document.getElementById('cartDrawer');
      if (cd && cd.classList.contains('open')) renderDrawer();
    };

    window.checkoutFromCart = function(){
      if (cart.items.length === 0) return;
      const subtotal = cart.items.reduce((a,i) => a + i.price * i.qty, 0);
      const unitsTotal = cart.items.reduce((a,i) => a + i.qty, 0);
      // Build a dynamic "cart" variant that reuses the existing checkout overlay
      if (typeof VARIANTS !== 'undefined') {
        const label = cart.items.length === 1
          ? cart.items[0].qty + ' × ' + cart.items[0].name
          : unitsTotal + ' bottles';
        VARIANTS.cart = {
          title: cart.items.length === 1 && cart.items[0].qty === 1
            ? cart.items[0].name
            : 'ODORSTRIKE — Cart',
          units: label,
          amount: subtotal,
          mrp: Math.round(subtotal * 1.5)
        };
      }
      closeCartDrawer();
      if (typeof openCheckout === 'function') openCheckout('cart');
    };

    // Escape to close
    document.addEventListener('keydown', function(e){
      // BUG: threw TypeError when #cartDrawer was absent from the DOM
      var cd = document.getElementById('cartDrawer');
      if (e.key === 'Escape' && cd && cd.classList.contains('open')) {
        closeCartDrawer();
      }
    });

    renderBadge();
  })();
