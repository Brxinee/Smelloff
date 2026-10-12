/* =====================================================================
   Smelloff — Verified Buyer Review System
   ===================================================================== */
(function(){
  'use strict';

  var SUPA_URL = 'https://tnuqjydmoxczdjnsgpci.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4';

  var selectedStars = 0;
  // 'buyer' (order verified) or 'invite' (a gifted bottle, single-use code).
  var reviewMode = 'buyer';
  var inviteCode = '';

  // Tags for reviews that must not count toward the star rating.
  var DISCLOSURE_TAGS = {
    free_product: 'Received a free bottle',
    connection: 'Knows the founder'
  };

  // The same three pre-launch beta testers, word for word, as / and
  // /odorstrike. They carry no star rating: they didn't buy, so they aren't
  // rated reviews, and they never count towards the aggregate.
  var BETA_TESTER_TESTIMONIALS = [
    {n:'Rohit, 26', c:'Bengaluru', r:0, u:'', t:"Sprayed it on my shirt before a client meeting after a 2hr bike ride. Nobody flinched.", buyer:false},
    {n:'Aakash, 24', c:'Pune', r:0, u:'', t:"Lives in my gym bag now. Post-workout, pre-Uber, no more ‘should I shower at office’ anxiety.", buyer:false},
    {n:'Karan, 29', c:'Delhi', r:0, u:'', t:"Smell is gone in one spray. Biryani jacket — fixed. Only wish the bottle was a bit bigger.", buyer:false}
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
              ' Verified buyers only' +
            '</div>' +
            '<h2 id="rvModalTitle">Write a review</h2>' +
            '<p class="rv-desc">To ensure 100% genuine feedback, only customers who have bought ODORSTRIKE can post reviews. Enter your order ID and phone number to verify your purchase.</p>' +

            '<form onsubmit="verifyOrderAndContinue(event); return false;">' +
              '<div class="rv-field">' +
                '<label for="rvAuthCode">Order ID</label>' +
                '<input type="text" id="rvAuthCode" placeholder="SMF-20260610-1234" autocomplete="off" autocapitalize="characters" required>' +
              '</div>' +
              '<div class="rv-field">' +
                '<label for="rvAuthPhone">Phone number</label>' +
                '<input type="tel" id="rvAuthPhone" placeholder="10-digit mobile number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required>' +
              '</div>' +
              '<button type="submit" class="rv-primary-btn" id="rvVerifyBtn">Verify order</button>' +
              '<div id="rvAuthError" class="rv-error-msg"></div>' +
            '</form>' +
            '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:13px;color:rgba(255,255,255,0.6);text-align:center">' +
              'Haven’t ordered yet? <a href="/odorstrike?buy=1" class="rv-buy-link">Buy now — ₹229</a>' +
              '<br>Got a free bottle from us? <a href="#" class="rv-buy-link" onclick="showInviteStep(); return false;">Use your invite code</a>' +
            '</div>' +
          '</div>' +

          '<!-- STEP 1b: Invite code for a gifted bottle -->' +
          '<div id="rvStepInvite" style="display:none">' +
            '<h2>Review your free bottle</h2>' +
            '<p class="rv-desc">Enter the invite code we sent you. Your review will be labelled “Received a free bottle” and won’t count toward the star rating, which comes from paying customers only.</p>' +
            '<form onsubmit="verifyInviteAndContinue(event); return false;">' +
              '<div class="rv-field">' +
                '<label for="rvInviteCode">Invite code</label>' +
                '<input type="text" id="rvInviteCode" placeholder="8 letters and numbers" maxlength="8" autocomplete="off" autocapitalize="characters" required>' +
              '</div>' +
              '<button type="submit" class="rv-primary-btn" id="rvInviteBtn">Continue</button>' +
              '<div id="rvInviteError" class="rv-error-msg"></div>' +
            '</form>' +
            '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:13px;color:rgba(255,255,255,0.6);text-align:center">' +
              'Bought it? <a href="#" class="rv-buy-link" onclick="showBuyerStep(); return false;">Verify your order instead</a>' +
            '</div>' +
          '</div>' +

          '<!-- STEP 2: Review Form -->' +
          '<div id="rvStepForm" style="display:none">' +
            '<div class="rv-modal-badge" id="rvFormBadge">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>' +
              ' <span id="rvFormBadgeText">Order verified</span>' +
            '</div>' +
            '<h2>Rate ODORSTRIKE</h2>' +
            '<p class="rv-desc">Share how ODORSTRIKE handled sweat, dampness, or shirt odors for you.</p>' +

            '<div class="rv-field">' +
              '<label>Your rating</label>' +
              '<div class="rv-stars-picker" id="rvStarPicker" role="radiogroup" aria-label="Rating stars">' +
                '<button type="button" data-star="1" aria-label="1 star">★</button>' +
                '<button type="button" data-star="2" aria-label="2 stars">★</button>' +
                '<button type="button" data-star="3" aria-label="3 stars">★</button>' +
                '<button type="button" data-star="4" aria-label="4 stars">★</button>' +
                '<button type="button" data-star="5" aria-label="5 stars">★</button>' +
              '</div>' +
            '</div>' +

            '<div class="rv-field">' +
              '<label for="rvText">Your review</label>' +
              '<textarea id="rvText" placeholder="Did it clear collar odor? How did it hold up on a gym tee, a hoodie or a blazer? Be specific." maxlength="400" required></textarea>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.4);text-align:right;margin-top:4px" id="rvCharCount">0/400</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
              '<div class="rv-field">' +
                '<label for="rvName">Your name</label>' +
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

            '<div id="rvConnectionRow" style="margin:-12px 0 20px;display:flex;align-items:flex-start;gap:8px">' +
              '<input type="checkbox" id="rvConnection" style="width:16px;height:16px;margin-top:2px;flex:none;accent-color:var(--acid,#b8ff57)">' +
              '<label for="rvConnection" style="font-size:13px;color:rgba(255,255,255,0.7);cursor:pointer">I know the founder or the Smelloff team personally. <span style="color:rgba(255,255,255,0.5)">Your review will say so and won’t count toward the star rating.</span></label>' +
            '</div>' +
            '<p id="rvInviteNote" style="display:none;margin:-8px 0 20px;font-size:13px;color:rgba(255,255,255,0.6)">This review will be labelled “Received a free bottle” and won’t count toward the star rating.</p>' +

            '<button type="button" class="rv-primary-btn rv-submit" onclick="submitVerifiedReview()">Post review</button>' +
            '<div id="rvFormError" class="rv-error-msg"></div>' +
          '</div>' +

          '<!-- STEP 3: Success Confirmation -->' +
          '<div id="rvStepDone" style="display:none;text-align:center;padding:12px 0">' +
            '<div style="width:56px;height:56px;background:rgba(184,255,87,0.15);border:1px solid var(--acid,#b8ff57);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--acid,#b8ff57)">' +
              '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-9"/></svg>' +
            '</div>' +
            '<h2>Review published</h2>' +
            '<p class="rv-desc" style="max-width:380px;margin:0 auto 24px">Thank you for sharing your experience. Your review is now live and will help other shoppers.</p>' +
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
    ['rvStepAuth', 'rvStepInvite', 'rvStepForm', 'rvStepDone'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = (id === stepId) ? 'block' : 'none';
    });
  }

  // The form step shows the disclosure that fits how this person got the bottle.
  function showForm(mode){
    reviewMode = mode;
    var invite = mode === 'invite';
    var badge = document.getElementById('rvFormBadgeText');
    if (badge) badge.textContent = invite ? 'Free bottle' : 'Order verified';
    var row = document.getElementById('rvConnectionRow');
    if (row) row.style.display = invite ? 'none' : 'flex';
    var note = document.getElementById('rvInviteNote');
    if (note) note.style.display = invite ? 'block' : 'none';
    showStep('rvStepForm');
  }

  window.showInviteStep = function(){
    ensureModalDOM();
    showStep('rvStepInvite');
  };
  window.showBuyerStep = function(){
    showStep('rvStepAuth');
  };

  function isVerifiedBuyer(){
    try {
      return !!(localStorage.getItem('smelloff_order_uuid') && localStorage.getItem('smelloff_review_token'));
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

    if (isVerifiedBuyer()) showForm('buyer');
    else showStep('rvStepAuth');
  };

  window.verifyInviteAndContinue = function(e){
    if (e && e.preventDefault) e.preventDefault();
    var btn = document.getElementById('rvInviteBtn');
    var err = document.getElementById('rvInviteError');
    var code = (document.getElementById('rvInviteCode').value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    err.style.display = 'none';
    if (code.length !== 8) {
      err.textContent = 'Invite codes are 8 letters and numbers.';
      err.style.display = 'block';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Checking…';
    fetch(SUPA_URL + '/functions/v1/submit-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code, check: true })
    })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok: r.ok, j: j }; }); })
    .then(function(res){
      btn.disabled = false;
      btn.textContent = 'Continue';
      if (!res.ok) {
        err.textContent = (res.j && res.j.error) || 'We couldn’t check that code. Please try again.';
        err.style.display = 'block';
        return;
      }
      inviteCode = code;
      showForm('invite');
    })
    .catch(function(){
      btn.disabled = false;
      btn.textContent = 'Continue';
      err.textContent = 'Connection error. Please try again.';
      err.style.display = 'block';
    });
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
    var cx = document.getElementById('rvConnection'); if (cx) cx.checked = false;
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
    btn.textContent = 'Verifying…';

    fetch(SUPA_URL + '/functions/v1/track-order/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_code: code, phone: phone })
    })
    .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
    .then(function(res){
      btn.disabled = false;
      btn.textContent = 'Verify order';
      if (!res.ok) {
        err.textContent = (res.j && res.j.error) || 'Order not found. Please check your Order ID and Phone number.';
        err.style.display = 'block';
        return;
      }
      var orderId = res.j.order_id || res.j.id || '';
      var reviewToken = res.j.review_token || '';

      if (!reviewToken || !orderId) {
        err.textContent = 'Reviews are unlocked once an order is confirmed or delivered. Thank you!';
        err.style.display = 'block';
        return;
      }

      try {
        localStorage.setItem('smelloff_order_uuid', orderId);
        localStorage.setItem('smelloff_review_token', reviewToken);
        localStorage.setItem('smelloff_purchased', 'true');
        localStorage.setItem('smelloff_last_order', JSON.stringify({ code: code, phone: phone }));
      } catch(e){}

      showForm('buyer');
    })
    .catch(function(){
      btn.disabled = false;
      btn.textContent = 'Verify order';
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

    var payload = {
      name: anon ? 'Anonymous' : (name || (reviewMode === 'invite' ? 'Anonymous' : 'Verified Buyer')),
      city: city || 'India',
      rating: selectedStars,
      body: text,
      anonymous: anon
    };

    if (reviewMode === 'invite') {
      if (!inviteCode) { showStep('rvStepInvite'); return; }
      payload.invite_code = inviteCode;
    } else {
      var orderUuid = '';
      var reviewToken = '';
      try {
        orderUuid = localStorage.getItem('smelloff_order_uuid') || '';
        reviewToken = localStorage.getItem('smelloff_review_token') || '';
      } catch(e){}

      if (!orderUuid || !reviewToken) {
        showStep('rvStepAuth');
        return;
      }
      payload.order_id = orderUuid;
      payload.review_token = reviewToken;
      payload.connection = !!(document.getElementById('rvConnection') || {}).checked;
    }

    var submitBtn = document.querySelector('#rvStepForm .rv-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Posting…'; }

    fetch(SUPA_URL + '/functions/v1/submit-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r){
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post review'; }
      if (!r.ok) {
        return r.json().catch(function(){ return {}; }).then(function(j){
          errEl.textContent = (j && j.error) || 'Could not post review. Please try again.';
          errEl.style.display = 'block';
        });
      }
      return r.json().then(function(_j){
        if (reviewMode === 'invite') inviteCode = '';
        showStep('rvStepDone');
        refreshAllReviews();
      });
    })
    .catch(function(){
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post review'; }
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
    });
  };

  // Splits reviews three ways:
  //   buyerReviews — a verified purchase with no disclosed connection. The
  //                  ONLY reviews that count toward the star rating.
  //   otherReviews — gifted bottles, buyers who know the founder, and old rows
  //                  with no order behind them. Shown with a tag, never counted.
  //   betaTesters  — the pre-launch quotes, no stars.
  var REVIEW_COLUMNS = 'name,rating,body,city,anonymous,created_at,verified_purchase,disclosure';
  var LEGACY_COLUMNS = 'name,rating,body,city,anonymous,created_at';

  function fetchReviews(columns){
    return fetch(SUPA_URL + '/rest/v1/reviews?select=' + columns + '&order=created_at.desc&limit=200', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    }).then(function(r){
      if (!r.ok) throw new Error('reviews ' + r.status);
      return r.json();
    });
  }

  function toCard(r){
    var counts = r.verified_purchase === true && (r.disclosure || 'none') === 'none';
    var tag = '';
    if (!counts) {
      // verified_purchase is undefined only on the legacy select: no tag
      // either way, and the review still doesn't count.
      tag = DISCLOSURE_TAGS[r.disclosure] || (r.verified_purchase === false ? 'Purchase not verified' : '');
    }
    return {
      n: (r.anonymous || !r.name) ? 'Anonymous' : r.name,
      c: r.city || '',
      r: Math.max(1, Math.min(5, Number(r.rating) || 5)),
      t: r.body || '',
      buyer: counts,
      tag: tag,
      created_at: r.created_at || null
    };
  }

  function refreshAllReviews(){
    fetchReviews(REVIEW_COLUMNS)
    .catch(function(){
      // Before the disclosure migration is applied the new columns don't
      // exist. Rows without verified_purchase never count toward the rating.
      return fetchReviews(LEGACY_COLUMNS);
    })
    .then(function(rows){
      var cards = (Array.isArray(rows) ? rows : []).map(toCard).filter(function(r){ return r.t; });
      var buyerReviews = cards.filter(function(r){ return r.buyer; });
      var otherReviews = cards.filter(function(r){ return !r.buyer; });

      // Callback if page handles rendering
      if (typeof window.onReviewsRefreshed === 'function') {
        window.onReviewsRefreshed(buyerReviews, BETA_TESTER_TESTIMONIALS, false, otherReviews);
      }
    })
    .catch(function(){
      // In case of error, do not fabricate numbers! Pass error flag
      if (typeof window.onReviewsRefreshed === 'function') {
        window.onReviewsRefreshed([], BETA_TESTER_TESTIMONIALS, true, []);
      }
    });
  }

  // Esc listener
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      var modal = document.getElementById('rvModal');
      if (modal && modal.classList.contains('open')) closeReviewForm();
    }
  });

  // Auto-init on page load. /reviews?invite=CODE opens the gifted-bottle
  // step with the code filled in (the link the owner sends from /admin).
  document.addEventListener('DOMContentLoaded', function(){
    refreshAllReviews();
    var invite = '';
    try { invite = new URLSearchParams(location.search).get('invite') || ''; } catch(e){}
    invite = invite.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    if (invite) {
      window.openReviewForm();
      document.getElementById('rvInviteCode').value = invite;
      showStep('rvStepInvite');
    }
  });

})();
