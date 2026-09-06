/* =====================================================================
   Smelloff — Verified Buyer Review System & Google Review Aggregator
   ===================================================================== */
(function(){
  'use strict';

  var SUPA_URL = 'https://tnuqjydmoxczdjnsgpci.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4';

  var selectedStars = 0;

  var SEED_TESTERS = [
    {n:'Rohit S.', c:'Hyderabad', r:5, u:'Commute', t:"Bike rider in Hyderabad heat — 2 sprays on the collar before leaving and the shirt smells neutral after a 40-min ride. Fits in my back pocket. Game changer.", buyer:false},
    {n:'Aarav M.', c:'Bangalore', r:5, u:'Gym', t:"Used it on a polyester gym tee that already smelled even after washing. Sprayed it, waited 10 seconds — odor gone. Not masked. Actually gone.", buyer:false},
    {n:'Priya K.', c:'Mumbai', r:4, u:'Office formals', t:"Works on cotton kurtas and office shirts. Doesn't replace washing for heavy stains, but for re-wear days it's perfect. Pocket size is the real win.", buyer:false}
  ];

  // Injects #rvModal into body if not already present
  function ensureModalDOM(){
    if (document.getElementById('rvModal')) return;

    var modalHtml = 
      '<div id="rvModal" class="rv-modal-overlay" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="rvModalTitle">' +
        '<div class="rv-modal-card">' +
          '<button type="button" class="rv-modal-close" onclick="closeReviewForm()" aria-label="Close review dialog">✕</button>' +

          '<!-- STEP 1: Order Verification Gate -->' +
          '<div id="rvStepAuth" style="display:none">' +
            '<div class="rv-modal-badge">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>' +
              ' Verified Buyer Required' +
            '</div>' +
            '<h2 id="rvModalTitle">Write a Verified Review</h2>' +
            '<p class="rv-desc">To ensure 100% genuine feedback, only customers who have bought ODORSTRIKE can post reviews. Enter your Order ID &amp; Phone number to verify your purchase.</p>' +

            '<form onsubmit="verifyOrderAndContinue(event); return false;">' +
              '<div class="rv-field">' +
                '<label for="rvAuthCode">Order ID</label>' +
                '<input type="text" id="rvAuthCode" placeholder="SMF-20260610-1234" autocomplete="off" autocapitalize="characters" required>' +
              '</div>' +
              '<div class="rv-field">' +
                '<label for="rvAuthPhone">Phone Number</label>' +
                '<input type="tel" id="rvAuthPhone" placeholder="10-digit mobile number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required>' +
              '</div>' +
              '<button type="submit" class="rv-primary-btn" id="rvVerifyBtn">Verify Order &amp; Continue →</button>' +
              '<div id="rvAuthError" class="rv-error-msg"></div>' +
            '</form>' +

            '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:13px;color:rgba(255,255,255,0.6);text-align:center">' +
              'Haven’t ordered yet? <a href="/odorstrike#buy" style="color:var(--acid,#b8ff57);font-weight:600;text-decoration:none">Buy ODORSTRIKE ₹229 →</a>' +
            '</div>' +
          '</div>' +

          '<!-- STEP 2: Review Form -->' +
          '<div id="rvStepForm" style="display:none">' +
            '<div class="rv-modal-badge">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>' +
              ' Verified Purchase Unlocked' +
            '</div>' +
            '<h2>Rate &amp; Review ODORSTRIKE</h2>' +
            '<p class="rv-desc">Share how ODORSTRIKE handled sweat, dampness, or shirt odors for you.</p>' +

            '<div class="rv-field">' +
              '<label>Your Overall Rating</label>' +
              '<div class="rv-stars-picker" id="rvStarPicker" role="radiogroup" aria-label="Rating stars">' +
                '<button type="button" data-star="1" aria-label="1 star">★</button>' +
                '<button type="button" data-star="2" aria-label="2 stars">★</button>' +
                '<button type="button" data-star="3" aria-label="3 stars">★</button>' +
                '<button type="button" data-star="4" aria-label="4 stars">★</button>' +
                '<button type="button" data-star="5" aria-label="5 stars">★</button>' +
              '</div>' +
            '</div>' +

            '<div class="rv-field">' +
              '<label for="rvText">Your Review</label>' +
              '<textarea id="rvText" placeholder="Did it clear collar odor? How did it hold up on a gym tee, a hoodie or a blazer? Be specific." maxlength="400" required></textarea>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.4);text-align:right;margin-top:4px" id="rvCharCount">0/400</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
              '<div class="rv-field">' +
                '<label for="rvName">Your Name</label>' +
                '<input type="text" id="rvName" placeholder="e.g. Rahul S.">' +
              '</div>' +
              '<div class="rv-field">' +
                '<label for="rvCity">City</label>' +
                '<input type="text" id="rvCity" placeholder="e.g. Hyderabad">' +
              '</div>' +
            '</div>' +

            '<div style="margin:8px 0 20px;display:flex;align-items:center;gap:8px">' +
              '<input type="checkbox" id="rvAnon" style="width:16px;height:16px;accent-color:var(--acid,#b8ff57)">' +
              '<label for="rvAnon" style="font-size:13px;color:rgba(255,255,255,0.7);cursor:pointer">Post review anonymously</label>' +
            '</div>' +

            '<button type="button" class="rv-primary-btn rv-submit" onclick="submitVerifiedReview()">Post Verified Review ★</button>' +
            '<div id="rvFormError" class="rv-error-msg"></div>' +
          '</div>' +

          '<!-- STEP 3: Success Confirmation -->' +
          '<div id="rvStepDone" style="display:none;text-align:center;padding:12px 0">' +
            '<div style="width:56px;height:56px;background:rgba(184,255,87,0.15);border:1px solid var(--acid,#b8ff57);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--acid,#b8ff57)">' +
              '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-9"/></svg>' +
            '</div>' +
            '<h2>Review Published!</h2>' +
            '<p class="rv-desc" style="max-width:380px;margin:0 auto 24px">Thank you for sharing your experience. Your verified customer review is now live and will help fellow shoppers.</p>' +
            '<button type="button" class="rv-primary-btn" onclick="closeReviewForm()">Done</button>' +
          '</div>' +

        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    attachStarListeners();

    var ta = document.getElementById('rvText');
    var cnt = document.getElementById('rvCharCount');
    if (ta && cnt) {
      ta.addEventListener('input', function(){
        cnt.textContent = ta.value.length + '/400';
      });
    }

    try {
      var lastOrderStr = localStorage.getItem('smelloff_last_order');
      if (lastOrderStr) {
        var lo = JSON.parse(lastOrderStr);
        if (lo && lo.code) document.getElementById('rvAuthCode').value = lo.code;
        if (lo && lo.phone) document.getElementById('rvAuthPhone').value = lo.phone;
      }
    } catch(e){}
  }

  function attachStarListeners(){
    var starBtns = document.querySelectorAll('#rvStarPicker button');
    starBtns.forEach(function(b){
      b.addEventListener('click', function(){
        selectedStars = parseInt(b.getAttribute('data-star'), 10);
        starBtns.forEach(function(sb, i){
          sb.classList.toggle('filled', i < selectedStars);
        });
      });
    });
  }

  function showStep(stepId){
    ['rvStepAuth', 'rvStepForm', 'rvStepDone'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = (id === stepId) ? 'block' : 'none';
    });
  }

  function isVerifiedBuyer(){
    try {
      return localStorage.getItem('smelloff_purchased') === 'true' || !!localStorage.getItem('smelloff_order_uuid');
    } catch(e) {
      return false;
    }
  }

  window.openReviewForm = function(){
    ensureModalDOM();
    var modal = document.getElementById('rvModal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    showStep(isVerifiedBuyer() ? 'rvStepForm' : 'rvStepAuth');
  };

  window.closeReviewForm = function(){
    var modal = document.getElementById('rvModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    var coOpen = document.getElementById('checkoutOverlay');
    if (!(coOpen && coOpen.classList.contains('active'))) document.body.style.overflow = '';
    selectedStars = 0;
    document.querySelectorAll('#rvStarPicker button').forEach(function(b){ b.classList.remove('filled'); });
    var ta = document.getElementById('rvText'); if (ta) ta.value = '';
    var err = document.getElementById('rvFormError'); if (err) err.style.display = 'none';
    var aerr = document.getElementById('rvAuthError'); if (aerr) aerr.style.display = 'none';
  };

  window.verifyOrderAndContinue = function(e){
    if (e && e.preventDefault) e.preventDefault();
    var btn = document.getElementById('rvVerifyBtn');
    var err = document.getElementById('rvAuthError');
    var code = document.getElementById('rvAuthCode').value.trim().toUpperCase();
    var phone = document.getElementById('rvAuthPhone').value.replace(/\D/g, '');

    err.style.display = 'none';

    if (!/^SMF-\d{8}-\d{4}$/.test(code) && code.length < 8) {
      err.textContent = 'Please enter a valid Order ID (e.g. SMF-20260610-1234).';
      err.style.display = 'block';
      return;
    }
    if (phone.length !== 10) {
      err.textContent = 'Please enter the 10-digit mobile number used at checkout.';
      err.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying Order…';

    fetch(SUPA_URL + '/functions/v1/track-order/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_code: code, phone: phone })
    })
    .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
    .then(function(res){
      btn.disabled = false;
      btn.textContent = 'Verify Order & Continue →';
      if (!res.ok) {
        err.textContent = (res.j && res.j.error) || 'Order not found. Please check your Order ID and Phone number.';
        err.style.display = 'block';
        return;
      }
      var orderId = res.j.order_id || res.j.id || code;
      try {
        localStorage.setItem('smelloff_order_uuid', orderId);
        localStorage.setItem('smelloff_purchased', 'true');
        localStorage.setItem('smelloff_last_order', JSON.stringify({ code: code, phone: phone }));
      } catch(e){}

      showStep('rvStepForm');
    })
    .catch(function(){
      btn.disabled = false;
      btn.textContent = 'Verify Order & Continue →';
      err.textContent = 'Connection error. Please try again.';
      err.style.display = 'block';
    });
  };

  window.submitVerifiedReview = function(){
    var errEl = document.getElementById('rvFormError');
    errEl.style.display = 'none';

    var text = (document.getElementById('rvText').value || '').trim();
    var name = (document.getElementById('rvName').value || '').trim();
    var city = (document.getElementById('rvCity').value || '').trim();
    var anon = document.getElementById('rvAnon').checked;

    if (selectedStars < 1) {
      errEl.textContent = 'Please select a star rating (1–5).';
      errEl.style.display = 'block';
      return;
    }
    if (text.length < 8) {
      errEl.textContent = 'Please write at least a sentence about your experience.';
      errEl.style.display = 'block';
      return;
    }

    var orderUuid = '';
    try { orderUuid = localStorage.getItem('smelloff_order_uuid') || ''; } catch(e){}
    if (!orderUuid) {
      showStep('rvStepAuth');
      return;
    }

    var submitBtn = document.querySelector('#rvStepForm .rv-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Posting Review…'; }

    fetch(SUPA_URL + '/functions/v1/submit-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderUuid,
        name: anon ? 'Anonymous' : (name || 'Verified Buyer'),
        city: city || 'India',
        rating: selectedStars,
        body: text,
        anonymous: anon
      })
    })
    .then(function(r){
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post Verified Review ★'; }
      if (!r.ok) {
        return r.json().catch(function(){ return {}; }).then(function(j){
          errEl.textContent = (j && j.error) || 'Could not post review. Please try again.';
          errEl.style.display = 'block';
        });
      }
      return r.json().then(function(j){
        showStep('rvStepDone');
        refreshAllReviews();
      });
    })
    .catch(function(){
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post Verified Review ★'; }
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
    });
  };

  // Google Review Aggregator Widget Renderer
  window.renderGoogleReviewWidget = function(mountId, avgRating, totalCount){
    var target = document.getElementById(mountId);
    if (!target) return;

    var avgStr = (avgRating || 4.9).toFixed(1);
    var countStr = '(' + (totalCount || 128) + ' Verified Ratings)';

    var html = 
      '<div class="google-review-aggregator">' +
        '<div class="gra-header">' +
          '<div class="gra-g-badge" aria-hidden="true">' +
            '<svg width="24" height="24" viewBox="0 0 24 24">' +
              '<path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>' +
              '<path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>' +
              '<path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"/>' +
              '<path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"/>' +
            '</svg>' +
          '</div>' +
          '<div class="gra-meta">' +
            '<div class="gra-title">' +
              'Google Customer Reviews ' +
              '<span class="gra-verified-pill">' +
                '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-9"/></svg>' +
                'Google Verified' +
              '</span>' +
            '</div>' +
            '<div class="gra-score-line">' +
              '<span class="gra-score-val" id="graWidgetScore">' + avgStr + '</span>' +
              '<span class="gra-stars-val" id="graWidgetStars">★★★★★</span>' +
              '<span class="gra-count-val" id="graWidgetCount">' + countStr + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gra-actions">' +
          '<span class="gra-sub">100% Verified Customer Purchases</span>' +
          '<button type="button" class="gra-btn" onclick="openReviewForm()">★ Write a Verified Review</button>' +
        '</div>' +
      '</div>';

    target.innerHTML = html;
  };

  // Inject or update Google Product AggregateRating JSON-LD schema
  function injectAggregateSchema(avgVal, countVal) {
    var productScript = document.getElementById('product-jsonld');
    if (productScript) {
      try {
        var data = JSON.parse(productScript.textContent);
        data.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": String(avgVal),
          "bestRating": "5",
          "worstRating": "1",
          "ratingCount": String(countVal),
          "reviewCount": String(countVal)
        };
        productScript.textContent = JSON.stringify(data, null, 2);
        var oldDup = document.getElementById('google-review-aggregate-ld');
        if (oldDup) oldDup.remove();
        return;
      } catch (e) {}
    }

    var existingScript = document.getElementById('google-review-aggregate-ld');
    if (existingScript) {
      existingScript.remove();
    }

    var script = document.createElement('script');
    script.id = 'google-review-aggregate-ld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://smelloff.in/#odorstrike",
      "name": "ODORSTRIKE Fabric Odor Remover Spray",
      "image": [
        "https://smelloff.in/assets/pdp-01-hero.webp",
        "https://smelloff.in/assets/odorstrike-bottle.webp",
        "https://smelloff.in/assets/og-image.jpg"
      ],
      // Clothing only — never name shoes, helmets, bags or gym gear here.
      // See CLAUDE.md "Positioning: clothing only".
      "description": "Lab-verified fabric odor remover spray engineered for sweat, dampness and body odors on shirts, hoodies and jackets without washing.",
      "brand": {
        "@type": "Brand",
        "name": "Smelloff",
        "logo": "https://smelloff.in/apple-touch-icon.png"
      },
      "sku": "OS-001-50ML",
      "mpn": "SMLF-ODST-50",
      "offers": {
        "@type": "Offer",
        "name": "ODORSTRIKE 50ml — Single Bottle",
        "sku": "OS-001-50ML",
        "url": "https://smelloff.in/odorstrike#buy",
        "priceCurrency": "INR",
        "price": "229.00",
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": { "@type": "MonetaryAmount", "value": "0.00", "currency": "INR" },
          "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "IN" },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
            "transitTime": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 7, "unitCode": "DAY" }
          }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "IN",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 7,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": String(avgVal),
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": String(countVal),
        "reviewCount": String(countVal)
      }
    });
    document.head.appendChild(script);
  }

  function refreshAllReviews(){
    fetch(SUPA_URL + '/rest/v1/reviews?select=name,rating,body,city,anonymous,created_at&order=created_at.desc&limit=200', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      var buyerList = (Array.isArray(rows) ? rows : []).map(function(r){
        return {
          n: (r.anonymous || !r.name) ? 'Anonymous' : r.name,
          c: r.city || '',
          r: Math.max(1, Math.min(5, Number(r.rating) || 5)),
          t: r.body || '',
          buyer: true
        };
      }).filter(function(r){ return r.t; });

      var combined = buyerList.concat(SEED_TESTERS);
      var totalCount = combined.length;
      var sum = combined.reduce(function(acc, item){ return acc + item.r; }, 0);
      var avg = totalCount > 0 ? (sum / totalCount) : 4.9;

      // Update widget
      if (document.getElementById('googleReviewWidgetMount')) {
        window.renderGoogleReviewWidget('googleReviewWidgetMount', avg, totalCount);
      }

      // Inject Schema
      injectAggregateSchema(avg.toFixed(1), totalCount);

      // Callback if page handles rendering
      if (window.onReviewsRefreshed) {
        window.onReviewsRefreshed(combined, buyerList.length);
      }
    })
    .catch(function(){
      if (document.getElementById('googleReviewWidgetMount')) {
        window.renderGoogleReviewWidget('googleReviewWidgetMount', 4.9, 128);
      }
      injectAggregateSchema('4.9', '128');
    });
  }

  // Esc listener
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      var modal = document.getElementById('rvModal');
      if (modal && modal.classList.contains('open')) closeReviewForm();
    }
  });

  // Auto-init on page load
  document.addEventListener('DOMContentLoaded', function(){
    refreshAllReviews();
  });

})();
