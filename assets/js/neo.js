/* Neo-brutalist homepage interactions: OUR GOODS + testimonial carousels.
   Vanilla JS, no dependencies. Every hook is optional — missing elements
   simply skip initialisation (same defensive pattern as scroll-effects.js). */
(function(){
  'use strict';

  function initCarousel(trackId, prevId, nextId, onCenter){
    var track = document.getElementById(trackId);
    if (!track) return;
    var prev = document.getElementById(prevId);
    var next = document.getElementById(nextId);

    function cards(){
      return Array.prototype.filter.call(track.children, function(c){
        return c.nodeType === 1;
      });
    }

    function centered(){
      var cs = cards();
      if (!cs.length) return null;
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = cs[0], bestD = Infinity;
      cs.forEach(function(c){
        var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
        if (d < bestD){ bestD = d; best = c; }
      });
      cs.forEach(function(c){ c.classList.toggle('is-active', c === best); });
      if (onCenter) onCenter(best);
      return best;
    }

    function step(dir){
      var cs = cards();
      if (!cs.length) return;
      var cur = centered();
      var i = Math.max(0, Math.min(cs.length - 1, cs.indexOf(cur) + dir));
      var c = cs[i];
      track.scrollTo({
        left: c.offsetLeft + c.offsetWidth / 2 - track.clientWidth / 2,
        behavior: 'smooth'
      });
    }

    if (prev) prev.addEventListener('click', function(){ step(-1); });
    if (next) next.addEventListener('click', function(){ step(1); });

    var t;
    track.addEventListener('scroll', function(){
      clearTimeout(t); t = setTimeout(centered, 90);
    }, { passive: true });
    window.addEventListener('resize', centered, { passive: true });
    /* Reviews are injected by app.js after load — re-run when children change. */
    try { new MutationObserver(centered).observe(track, { childList: true }); } catch (e) {}
    centered();
  }

  /* Quantity stepper — replaces the pack/combo selector. Qty 1–3 maps to
     the existing solo/duo/trio variants via window.selectQty, so pricing,
     cart, checkout and tracking stay untouched. */
  var _nbQty = 1;
  window.nbQtyStep = function(d){
    _nbQty = Math.min(3, Math.max(1, _nbQty + d));
    document.querySelectorAll('.nb-qty-val').forEach(function(v){ v.textContent = _nbQty; });
    document.querySelectorAll('.nb-qty-btn[data-step="-1"]').forEach(function(b){ b.disabled = _nbQty <= 1; });
    document.querySelectorAll('.nb-qty-btn[data-step="1"]').forEach(function(b){ b.disabled = _nbQty >= 3; });
    var per = document.getElementById('nbQtyPer');
    if (per){
      var prices = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRICES) || { solo:229, duo:399, trio:549 };
      var total = _nbQty === 3 ? prices.trio : _nbQty === 2 ? prices.duo : prices.solo;
      per.textContent = '₹' + Math.round(total / _nbQty) + ' per bottle' + (_nbQty >= 3 ? ' · max 3 per order' : '');
    }
    if (typeof window.selectQty === 'function') window.selectQty(_nbQty);
  };

  function init(){
    if (document.querySelector('.nb-qty-stepper')) window.nbQtyStep(0);
    var name  = document.getElementById('nbGoodsName');
    var price = document.getElementById('nbGoodsPrice');
    var desc  = document.getElementById('nbGoodsDesc');
    initCarousel('nbGoodsTrack', 'nbGoodsPrev', 'nbGoodsNext', function(card){
      if (!card || !card.dataset) return;
      if (name  && card.dataset.name)  name.textContent  = card.dataset.name;
      if (price) price.textContent = card.dataset.price || '';
      if (desc)  desc.textContent  = card.dataset.desc  || '';
    });
    initCarousel('rvScroll', 'nbRevPrev', 'nbRevNext', null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
