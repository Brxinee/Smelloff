/* =====================================================================
   Smelloff — shared site chrome behaviour  (v2, 2026-08-17)
   =====================================================================
   Shared behaviour for the unified site chrome:
     1. mobile burger + keyboard escape
     2. cart count badge
     3. current-page nav state
     4. cross-site mobile purchase bar on non-checkout pages
     5. campaign attribution persistence for internal navigation
     6. new blog guides injection/filtering on /blog
   Safe on pages without the shared header.
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
    window.addEventListener('storage', refresh);
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

  /* --- attribution -------------------------------------------------- */
  // Preserve campaign source/medium/campaign/content across the visitor's
  // internal click path. This does not store raw query strings or PII.
  try {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    for (var j = 0; j < keys.length; j++) {
      var value = params.get(keys[j]);
      if (value) localStorage.setItem('smelloff_' + keys[j], value.slice(0, 120));
    }
  } catch (e) { /* storage blocked */ }

  /* --- new blog guides --------------------------------------------- */
  // The blog index is intentionally mostly static for fast SSR, so newly
  // published guides are injected here from a small first-party data array.
  // The extra guides participate in the existing category/search controls and
  // never alter the existing article markup or analytics integrations.
  if (path === '/blog' && document.getElementById('latestGrid') && !document.getElementById('smelloff-new-guides')) {
    var NEW_GUIDES = [
      {slug:'why-clothes-smell-bad-again-after-sweating',cat:'how-to',label:'Fabric Science',time:'8 min',title:'Why Do Clothes Smell Bad Again After You Start Sweating?',desc:'Why heat and moisture can bring retained odorants back to life on a shirt.',img:'/blog/assets/why-clothes-smell-bad-again-after-sweating.svg'},
      {slug:'why-clothes-smell-bad-after-drying',cat:'how-to',label:'Fabric Care',time:'8 min',title:'Why Do Clothes Smell Bad After Drying?',desc:'Slow drying, retained odorants and the fix before you rewash everything.',img:'/blog/assets/why-clothes-smell-bad-after-drying.svg'},
      {slug:'why-clothes-smell-musty-after-being-stored',cat:'how-to',label:'Fabric Care',time:'8 min',title:'Why Do Clothes Smell Musty After Being Stored?',desc:'How humidity, trapped air and storage conditions change clean clothing.',img:'/blog/assets/why-clothes-smell-musty-after-being-stored.svg'},
      {slug:'why-clothes-smell-in-wardrobe-even-when-clean',cat:'how-to',label:'Fabric Care',time:'8 min',title:'Why Do Clothes Smell in the Wardrobe Even When They’re Clean?',desc:'Sometimes the wardrobe is the source of the stale clothing odor.',img:'/blog/assets/why-clothes-smell-in-wardrobe-even-when-clean.svg'},
      {slug:'why-polyester-holds-odor-longer-than-cotton',cat:'science',label:'Fabric Science',time:'9 min',title:'Why Does Polyester Hold Odor Longer Than Cotton?',desc:'What textile research says about polyester, cotton, sweat and odor.',img:'/blog/assets/why-polyester-holds-odor-longer-than-cotton.svg'},
      {slug:'why-clean-shirt-starts-smelling-within-hours',cat:'science',label:'Fabric Science',time:'8 min',title:'Why Does a Clean Shirt Start Smelling Within a Few Hours?',desc:'How sweat, skin oils, microbes and fabric history create fast odor return.',img:'/blog/assets/why-clean-shirt-starts-smelling-within-hours.svg'},
      {slug:'how-to-freshen-clothes-stored-for-months',cat:'how-to',label:'How To',time:'8 min',title:'How to Freshen Clothes After They’ve Been Stored for Months',desc:'A practical seasonal reset: air, inspect, wash when needed, then neutralize.',img:'/blog/assets/how-to-freshen-clothes-stored-for-months.svg'},
      {slug:'how-to-pack-sweaty-clothes-without-bag-smell',cat:'how-to',label:'How To',time:'8 min',title:'How to Pack Sweaty Clothes Without Making Your Bag Smell',desc:'Separate, dry and contain worn clothing without turning your bag into an odor chamber.',img:'/blog/assets/how-to-pack-sweaty-clothes-without-bag-smell.svg'},
      {slug:'why-body-odor-comes-back-on-clothes-so-quickly',cat:'science',label:'Fabric Science',time:'9 min',title:'Why Does Body Odor Come Back on Clothes So Quickly?',desc:'Why the shirt can hold onto odor even after the skin feels fresh.',img:'/blog/assets/why-body-odor-comes-back-on-clothes-so-quickly.svg'},
      {slug:'odor-on-clothes-vs-odor-in-clothes',cat:'science',label:'Fabric Science',time:'9 min',title:'Odor on Clothes vs Odor in Clothes: What’s Actually Happening?',desc:'Surface odor, retained odorants and why heat or moisture can make smell return.',img:'/blog/assets/odor-on-clothes-vs-odor-in-clothes.svg'}
    ];

    var section = document.createElement('section');
    section.className = 'b-posts smelloff-new-guides';
    section.id = 'smelloff-new-guides';
    section.setAttribute('aria-labelledby', 'smelloff-new-guides-heading');
    var cards = '';
    for (var n = 0; n < NEW_GUIDES.length; n++) {
      var g = NEW_GUIDES[n];
      cards += '<a href="/blog/' + g.slug + '" class="b-card" data-new-guide="true" data-cat="' + g.cat + '">' +
        '<div class="b-card-thumb"><img loading="lazy" src="' + g.img + '" alt="' + g.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') + '" width="1600" height="900" decoding="async"></div>' +
        '<div class="b-card-body"><div class="b-card-meta"><span class="b-card-cat">' + g.label + '</span><span class="b-card-sep">·</span><span>' + g.time + '</span><span class="b-card-sep">·</span><span>New</span></div>' +
        '<h3>' + g.title + '</h3><p>' + g.desc + '</p><span class="b-card-arrow">Read Guide</span></div></a>';
    }
    section.innerHTML = '<div class="b-section-head"><h2 class="b-section-tag" id="smelloff-new-guides-heading">New Guides</h2><span class="b-section-count">10 new</span></div><div class="b-grid" id="smelloff-new-guides-grid">' + cards + '</div>';

    var latestSection = document.getElementById('latestSection');
    if (latestSection && latestSection.parentNode) latestSection.parentNode.insertBefore(section, latestSection);

    var oldCards = Array.prototype.slice.call(document.querySelectorAll('#latestGrid a.b-card'));
    var newCards = Array.prototype.slice.call(section.querySelectorAll('a.b-card'));
    var allCountEl = document.getElementById('latestCount');
    var searchBox = document.getElementById('blogSearch');
    var categoryButtons = document.querySelectorAll('.b-cats .b-cat');
    var allButton = document.querySelector('.b-cats .b-cat[data-cat="all"]');
    if (allButton) allButton.textContent = 'All Guides (39)';

    function getActiveCat() {
      for (var x = 0; x < categoryButtons.length; x++) {
        if (categoryButtons[x].classList.contains('is-active')) return categoryButtons[x].dataset.cat || 'all';
      }
      return 'all';
    }

    function updateNewGuideFilter() {
      var q = searchBox ? (searchBox.value || '').trim().toLowerCase() : '';
      var cat = getActiveCat();
      var newVisible = 0;
      for (var a = 0; a < newCards.length; a++) {
        var card = newCards[a];
        var catMatch = cat === 'all' || card.dataset.cat === cat;
        var txt = card.textContent.toLowerCase();
        var queryMatch = !q || txt.indexOf(q) !== -1;
        var show = catMatch && queryMatch;
        card.style.display = show ? '' : 'none';
        if (show) newVisible++;
      }
      var baseVisible = 0;
      for (var b = 0; b < oldCards.length; b++) {
        if (oldCards[b].style.display !== 'none') baseVisible++;
      }
      section.style.display = newVisible > 0 ? '' : 'none';
      if (allCountEl) allCountEl.textContent = (baseVisible + newVisible) + (baseVisible + newVisible === 1 ? ' guide' : ' guides');
    }

    for (var c = 0; c < categoryButtons.length; c++) {
      categoryButtons[c].addEventListener('click', function () { setTimeout(updateNewGuideFilter, 0); });
    }
    if (searchBox) searchBox.addEventListener('input', function () { setTimeout(updateNewGuideFilter, 220); });
    if (typeof window.resetSearch === 'function') {
      var resetSearchOriginal = window.resetSearch;
      window.resetSearch = function () { resetSearchOriginal(); setTimeout(updateNewGuideFilter, 0); };
    }
    updateNewGuideFilter();
  }

  /* --- mobile purchase bar ----------------------------------------- */
  // The product page has its own purchase UI and must not get a duplicate
  // bottom bar. Transaction/status/legal pages also stay uncluttered.
  var excluded = /(^|\/)(odorstrike|track-order|payment-failed|returns|refunds|cancellation|privacy|terms)(\/|$)/i.test(path);
  var isContentPage = /(^|\/)(blog|faq|reviews|about|contact)(\/|$)/i.test(path) || path === '' || path === '/';

  if (!excluded && isContentPage && !document.getElementById('smelloff-mobile-buybar')) {
    var style = document.createElement('style');
    style.id = 'smelloff-mobile-buybar-style';
    style.textContent = [
      '#smelloff-mobile-buybar{display:none}',
      '@media(max-width:899px){',
      '#smelloff-mobile-buybar{position:fixed;left:0;right:0;bottom:0;z-index:80;display:flex;align-items:center;gap:12px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(8,8,8,.96);border-top:1px solid rgba(184,255,87,.22);box-shadow:0 -10px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}',
      '#smelloff-mobile-buybar .smb-copy{min-width:0;flex:1}',
      '#smelloff-mobile-buybar .smb-title{display:block;color:#f4f1ea;font:700 12px/1.15 "DM Sans",system-ui,sans-serif;letter-spacing:.02em}',
      '#smelloff-mobile-buybar .smb-meta{display:block;color:#a7a39b;font:500 10px/1.25 "JetBrains Mono",monospace;margin-top:3px;white-space:nowrap}',
      '#smelloff-mobile-buybar .smb-cta{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-height:44px;padding:0 16px;border-radius:11px;background:#b8ff57;color:#080808;text-decoration:none;font:800 11px/1 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase}',
      '#smelloff-mobile-buybar .smb-cta:focus-visible{outline:2px solid #f4f1ea;outline-offset:2px}',
      'body{padding-bottom:64px}',
      '}',
      '@media(prefers-reduced-motion:reduce){#smelloff-mobile-buybar{backdrop-filter:none;-webkit-backdrop-filter:none}}'
    ].join('');
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'smelloff-mobile-buybar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Buy ODORSTRIKE');
    bar.innerHTML = '<div class="smb-copy"><span class="smb-title">ODORSTRIKE · fabric odor control</span><span class="smb-meta">50ml · ~250 sprays · ₹229 · free shipping</span></div><a class="smb-cta" href="/odorstrike" data-smelloff-buy="mobile_sticky">Buy now</a>';
    document.body.appendChild(bar);
  }

  /* --- mobile CTA analytics hook ---------------------------------- */
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-smelloff-buy]') : null;
    if (!target || typeof window.gtag !== 'function') return;
    window.gtag('event', 'buy_cta_click', {
      cta_location: target.getAttribute('data-smelloff-buy') || 'unknown',
      page_path: location.pathname,
      link_text: (target.textContent || '').trim().slice(0, 60)
    });
  }, true);
})();