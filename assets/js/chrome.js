/* =====================================================================
   Smelloff — shared site chrome behaviour  (v2, 2026-08-17)
   =====================================================================
   Shared behaviour for the unified site chrome:
     1. mobile burger + keyboard escape
     2. cart count badge
     3. current-page nav state
     4. cross-site mobile purchase bar on non-checkout pages
     5. campaign attribution persistence for internal navigation
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