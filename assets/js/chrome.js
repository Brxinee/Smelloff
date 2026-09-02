/* =====================================================================
   Smelloff — shared site chrome behaviour  (v3, Stage 1)
   =====================================================================
   Shared behaviour for the unified site chrome:
     1. mobile burger — a11y (escape, focus trap, body lock)
     2. cart count badge
     3. current-page nav state
     4. mobile sticky buy bar (IntersectionObserver vs #buy)
     5. campaign attribution persistence for internal navigation
     6. new blog guides injection/filtering on /blog
   Safe on pages without the shared header.
   ===================================================================== */
(function () {
  'use strict';

  function truth() {
    return window.SMELLOFF_TRUTH || {
      productName: 'ODORSTRIKE',
      size: '50ml',
      category: 'Fabric-only odor mist',
      pricePrepaid: 229,
      priceCod: 289,
      codFee: 60,
      spraysApprox: 250,
      whatsappNumber: '+919392974031'
    };
  }

  function rupee(n) { return '₹' + n; }

  /* --- burger ------------------------------------------------------- */
  var burger = document.querySelector('.sf-burger');
  var menu = document.getElementById('sfMenu');
  var hdr = document.querySelector('.sf-hdr');
  var lastMenuFocus = null;

  function menuFocusables() {
    var nodes = [];
    if (burger) nodes.push(burger);
    if (menu) {
      var links = menu.querySelectorAll('a[href], button:not([disabled])');
      for (var i = 0; i < links.length; i++) nodes.push(links[i]);
    }
    return nodes;
  }

  function openMenu() {
    if (!burger || !menu) return;
    lastMenuFocus = document.activeElement;
    menu.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.documentElement.classList.add('so-nav-open');
    var items = menu.querySelectorAll('a[href]');
    if (items[0]) items[0].focus();
  }

  function closeMenu(opts) {
    if (!burger || !menu) return;
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.documentElement.classList.remove('so-nav-open');
    if (!opts || opts.focus !== false) burger.focus();
  }

  if (burger && menu) {
    if (hdr && !document.querySelector('.sf-hdr__scrim')) {
      var scrim = document.createElement('div');
      scrim.className = 'sf-hdr__scrim';
      scrim.setAttribute('hidden', '');
      hdr.insertAdjacentElement('afterend', scrim);
      scrim.addEventListener('click', function () { closeMenu(); });
    }

    burger.addEventListener('click', function () {
      if (menu.classList.contains('is-open')) closeMenu({ focus: false });
      else openMenu();
    });

    menu.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('a')) closeMenu({ focus: false });
    });

    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeMenu();
        return;
      }
      if (e.key !== 'Tab') return;
      var nodes = menuFocusables();
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 960px)').matches) closeMenu({ focus: false });
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
  try {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    for (var j = 0; j < keys.length; j++) {
      var value = params.get(keys[j]);
      if (value) localStorage.setItem('smelloff_' + keys[j], value.slice(0, 120));
    }
  } catch (e) { /* storage blocked */ }

  /* --- new blog guides --------------------------------------------- */
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
        '<div class="b-card-thumb"><img loading="lazy" src="' + g.img + '" alt="' + g.title.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"') + '" width="1600" height="900" decoding="async"></div>' +
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

  /* --- mobile sticky buy bar ----------------------------------------
     PDP already has #mobileBar + IntersectionObserver in its own page
     script. Legal / checkout pages stay clean. Content pages get one
     compact bar that appears after #buy (or the top of the page) leaves
     view — never over the hero CTA. */
  var excluded = /(^|\/)(odorstrike|track-order|payment-failed|returns|refunds|refund|cancellation|privacy|terms)(\/|$)/i.test(path);
  var isContentPage = /(^|\/)(blog|faq|reviews|about|contact|solutions)(\/|$)/i.test(path) || path === '' || path === '/';

  if (!excluded && isContentPage && !document.getElementById('soSticky') && !document.getElementById('mobileBar')) {
    var T = truth();
    var hasBuy = !!document.getElementById('buy');
    var ctaHref = hasBuy ? '#buy' : '/?buy=1';
    var bar = document.createElement('div');
    bar.className = 'so-sticky';
    bar.id = 'soSticky';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Buy ' + T.productName);
    bar.innerHTML =
      '<div class="so-sticky__copy">' +
        '<span class="so-sticky__name">' + T.productName + '</span>' +
        '<span class="so-sticky__price">' + rupee(T.pricePrepaid) + '</span>' +
      '</div>' +
      '<a class="so-btn so-btn--p1" href="' + ctaHref + '" data-smelloff-buy="mobile_sticky">Buy</a>';
    document.body.appendChild(bar);

    var buy = document.getElementById('buy');
    var buyInView = false;
    var scrolledEnough = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function updateSticky() {
      var show = scrolledEnough && !buyInView;
      bar.classList.toggle('is-visible', show);
      document.documentElement.classList.toggle('so-sticky-on', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    if (buy && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        buyInView = entries[0].isIntersecting;
        updateSticky();
      }, { threshold: 0.08 }).observe(buy);
    }

    var ticking = false;
    function onScroll() {
      scrolledEnough = window.scrollY > (hasBuy ? 280 : 360);
      ticking = false;
      updateSticky();
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();

    if (reduce) {
      bar.style.transition = 'none';
    }
  }

  /* --- FAQ: one open panel at a time (native name= is the modern path;
     this is the fallback for browsers that ignore exclusive details). */
  document.addEventListener('toggle', function (event) {
    var opened = event.target;
    if (!opened || opened.tagName !== 'DETAILS' || !opened.open) return;
    var group = opened.closest('.so-faq');
    if (!group) return;
    var items = group.querySelectorAll('details');
    for (var i = 0; i < items.length; i++) {
      if (items[i] !== opened) items[i].open = false;
    }
  }, true);

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

  /* --- shop gallery (dots, thumbs, snap) -------------------------- */
  (function () {
    var root = document.getElementById('gallery');
    if (!root) return;
    var viewport = root.querySelector('.so-gallery__viewport');
    var slides = root.querySelectorAll('.so-gallery__slide');
    var dots = root.querySelectorAll('.so-gallery__dots button');
    var thumbs = root.querySelectorAll('.so-gallery__thumbs button');
    if (!viewport || !slides.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setIndex(i, scroll) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      for (var s = 0; s < slides.length; s++) slides[s].classList.toggle('is-on', s === i);
      for (var d = 0; d < dots.length; d++) dots[d].setAttribute('aria-selected', d === i ? 'true' : 'false');
      for (var t = 0; t < thumbs.length; t++) thumbs[t].setAttribute('aria-selected', t === i ? 'true' : 'false');
      if (scroll && slides[i]) {
        slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
      }
    }
    function bind(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        (function (n) {
          nodes[n].addEventListener('click', function () { setIndex(n, true); });
        })(i);
      }
    }
    bind(dots);
    bind(thumbs);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = Array.prototype.indexOf.call(slides, en.target);
          if (i >= 0) setIndex(i, false);
        });
      }, { root: viewport, threshold: 0.6 });
      for (var s = 0; s < slides.length; s++) io.observe(slides[s]);
    }
    setIndex(0, false);
  })();

})();
