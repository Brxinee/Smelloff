/* =====================================================================
   Smelloff — shared site chrome behaviour  (v1, 2026-07-28)
   =====================================================================
   Two jobs, both previously duplicated inline on the pages that happened
   to have a real header (index, odorstrike, blog) and simply absent on
   the 13 pages that shipped `.p-nav`:

     1. the burger toggle for the stacked mobile menu
     2. the cart count badge, read from the same localStorage key the
        /odorstrike checkout writes ('smelloff_cart_v1')

   Deferred — nothing here is on the critical render path. Written to be
   safe to load on a page with no header at all.
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
    // Close on Escape so keyboard users aren't trapped behind the sheet.
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
    // bfcache restore: coming back from the product page must show the
    // count that page just wrote.
    window.addEventListener('pageshow', refresh);
  }

  /* --- current page ------------------------------------------------- */
  // Mark the nav item matching this URL so "you are here" is visible.
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
})();
