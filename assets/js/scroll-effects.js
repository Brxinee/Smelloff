(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  // TR7 — real number only. Leave null to keep the "bottles shipped" marker hidden.
  var BOTTLES_SHIPPED = null;

  /* AT3 — count-up stats when .problem-stats scrolls into view */
  function initCountUp(){
    var wrap = document.querySelector('.problem-stats');
    if(!wrap) return;
    var nums = wrap.querySelectorAll('.p-stat-num');
    function run(){
      nums.forEach(function(el){
        var node = el.firstChild;                       // leading text node, keeps .p-stat-unit span
        if(!node || node.nodeType !== 3) return;
        var target = parseInt(node.nodeValue, 10);
        if(isNaN(target)) return;
        if(reduce){ node.nodeValue = String(target); return; }
        var start = null, dur = 1000;
        function step(ts){
          if(!start) start = ts;
          var p = Math.min((ts - start)/dur, 1);
          node.nodeValue = String(Math.round(p * target));
          if(p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }
    if(reduce || !hasIO){ run(); return; }
    var o = new IntersectionObserver(function(es){
      if(es[0].isIntersecting){ run(); o.disconnect(); }
    }, { threshold: 0.4 });
    o.observe(wrap);
  }

  /* AT5 — section scroll-reveal (only hide sections if we can/will reveal them) */
  function initReveal(){
    if(reduce || !hasIO) return;  // no JS-hiding when we won't animate → content always visible
    var sel = '.problem,.trigger-section,.how-works,.compare,.savings,.only-fix,.reviews,.faq,.final,.so2,.so2-trust';
    var secs = document.querySelectorAll(sel);
    if(!secs.length) return;
    var o = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in-view'); o.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    secs.forEach(function(s){ s.classList.add('reveal'); o.observe(s); });
  }

  /* EN1 — interactive "find your moment" trigger cards */
  function initTriggers(){
    document.querySelectorAll('.trigger-card').forEach(function(card){
      if(!card.querySelector('.trigger-fix')) return;
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-expanded','false');
      function toggle(){
        var open = card.classList.toggle('open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      card.addEventListener('click', function(e){ if(e.target.closest('a')) return; toggle(); });
      card.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); }
      });
    });
  }

  /* EN2 — savings calculator (honest estimate) */
  var SV = { count:3, COST_PER_FIX:40, SPRAYS_PER_FIX:2, BOTTLE_SPRAYS:250, WEEKS:4.3 };
  function svBottlePrice(){
    var c = window.SMELLOFF_CONFIG;
    return (c && c.PRICES && c.PRICES.solo) ? c.PRICES.solo : 229;
  }
  function svRender(){
    var money=document.getElementById('svMoney'), loads=document.getElementById('svLoads'), cnt=document.getElementById('svCount');
    if(!money) return;
    var monthlyFixes = Math.round(SV.count * SV.WEEKS);
    var oldMonthly = monthlyFixes * SV.COST_PER_FIX;
    var bottleFixes = SV.BOTTLE_SPRAYS / SV.SPRAYS_PER_FIX;          // ~125 fixes per bottle
    var monthsPerBottle = bottleFixes / Math.max(monthlyFixes,1);
    var osMonthly = svBottlePrice() / monthsPerBottle;
    var saving = Math.max(Math.round(oldMonthly - osMonthly), 0);
    if(cnt) cnt.textContent = SV.count;
    money.textContent = '₹' + saving;
    loads.textContent = monthlyFixes;
  }
  window.svStep = function(d){ SV.count = Math.min(14, Math.max(1, SV.count + d)); svRender(); };

  /* EN5 — reading progress bar */
  function initProgress(){
    var bar = document.getElementById('scrollProgress');
    if(!bar) return;
    var ticking=false;
    function upd(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = ((h>0 ? window.scrollY/h : 0)*100).toFixed(2) + '%';
      ticking=false;
    }
    window.addEventListener('scroll', function(){ if(!ticking){ ticking=true; requestAnimationFrame(upd); } }, {passive:true});
    window.addEventListener('resize', upd, {passive:true});
    upd();
  }

  /* PH1 — product photos: probe via JS so a missing file never shows broken (CSS bottle stays) */
  function probe(src, ok, fail){ var im = new Image(); im.onload = function(){ ok(); }; im.onerror = function(){ fail(); }; im.src = src; }
  function photosReady(){ return !!(window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.PRODUCT_PHOTOS_READY); }
  function initHeroPhoto(){
    if(!photosReady()) return;                 // skip probing missing files → no 404 console errors
    var wrap = document.querySelector('.hero-bottle'); if(!wrap) return;
    var src = '/assets/product-hero.jpg';
    probe(src, function(){
      var img = document.createElement('img');
      img.src = src; img.alt = 'ODORSTRIKE fabric odor spray bottle';
      img.className = 'hero-photo'; img.fetchPriority = 'high'; img.decoding = 'async';
      wrap.classList.add('has-photo'); wrap.appendChild(img);
    }, function(){});
  }
  function initGallery(){
    if(!photosReady()) return;                 // skip probing missing files → no 404 console errors
    var gallery = document.getElementById('pcGallery'); if(!gallery) return;
    var imgs = [
      ['/assets/product-hero.jpg',   'ODORSTRIKE fabric odor spray bottle'],
      ['/assets/product-pocket.jpg', 'ODORSTRIKE — pocket size'],
      ['/assets/demo-no-stain.jpg',  'Sprayed on dark fabric — dries clear, no stain']
    ];
    var loaded = [], pending = imgs.length;
    imgs.forEach(function(pair, i){
      probe(pair[0], function(){ loaded.push(i); done(); }, function(){ done(); });
    });
    function done(){
      if(--pending > 0) return;
      if(!loaded.length) return;               // no real photos yet → CSS bottle stays
      loaded.sort(function(a,b){return a-b;});
      gallery.innerHTML = loaded.map(function(i){
        return '<img src="'+imgs[i][0]+'" alt="'+imgs[i][1]+'" loading="lazy" decoding="async">';
      }).join('');
      gallery.setAttribute('role','group');    // labelled group of product photos (imgs carry alt text)
      gallery.setAttribute('aria-label','Product photos');
      gallery.hidden = false;
      var media = gallery.closest('.pc-media');
      var cssBottle = media && media.querySelector('.pc-image');
      if(cssBottle) cssBottle.style.display = 'none';
    }
  }

  /* S5 — comparison mobile tabs */
  window.compareTab = function(btn){
    var tab = btn.getAttribute('data-tab');
    document.querySelectorAll('.compare-tab').forEach(function(t){
      var a = t === btn; t.classList.toggle('active', a); t.setAttribute('aria-selected', a ? 'true' : 'false');
    });
    var tbl = document.querySelector('.compare-table');
    if (tbl) tbl.setAttribute('data-active', tab);
  };

  /* S7 (RV3) — review scroll dots */
  function initReviewDots(){
    var scroll = document.getElementById('rvScroll'), dotsWrap = document.getElementById('rvDots');
    if (!scroll || !dotsWrap) return;
    function build(){
      var cards = scroll.querySelectorAll('.rv-card');
      if (!cards.length){ dotsWrap.innerHTML=''; return; }
      if (dotsWrap.childElementCount !== cards.length){
        dotsWrap.innerHTML = '';
        cards.forEach(function(c,i){
          var d = document.createElement('button'); d.type='button'; d.setAttribute('aria-label','Go to review '+(i+1));
          d.addEventListener('click', function(){ c.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); });
          dotsWrap.appendChild(d);
        });
      }
      var center = scroll.scrollLeft + scroll.clientWidth/2, best=0, bestD=1e9;
      cards.forEach(function(c,i){ var cc=c.offsetLeft+c.offsetWidth/2, dd=Math.abs(cc-center); if(dd<bestD){bestD=dd;best=i;} });
      Array.prototype.forEach.call(dotsWrap.children, function(d,i){ d.classList.toggle('active', i===best); });
    }
    scroll.addEventListener('scroll', function(){ requestAnimationFrame(build); }, {passive:true});
    try { new MutationObserver(build).observe(scroll, {childList:true}); } catch(e){}
    build();
  }

  function init(){
    initCountUp(); initReveal(); initTriggers(); svRender(); initProgress();
    initHeroPhoto(); initGallery(); initReviewDots();
    if (typeof window.selectQty === "function") window.selectQty(1); /* sync MRP/discount/calc-CTA on load */
    var bs = document.getElementById('bottlesShipped');
    if (bs && BOTTLES_SHIPPED != null){ bs.textContent = ' · ' + BOTTLES_SHIPPED + ' bottles shipped'; bs.hidden = false; }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
