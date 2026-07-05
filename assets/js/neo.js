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

  function init(){
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
