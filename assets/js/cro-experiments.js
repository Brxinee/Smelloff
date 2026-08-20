/* =====================================================================
   Smelloff & ODORSTRIKE — CRO Experimentation Engine (v1.0)
   =====================================================================
   Deterministic, cookieless, zero-CLS experimentation framework.
   Prioritized Experiments:
     1. Hero / Category Clarity
     2. 1-Pack vs 2-Pack Default
     3. Pricing Architecture & Bundle Tiering
     4. COD Fee vs Prepaid Incentive
     5. Demonstration Placement
     6. Review Placement
   ===================================================================== */
(function() {
  'use strict';

  if (window.SMELLOFF_EXPERIMENTS) return;

  var STORAGE_KEY = 'smf_exp_bucket_v1';

  // Seed / Hash generator for deterministic A/B assignment
  function getVisitorSeed() {
    try {
      var sid = localStorage.getItem(STORAGE_KEY);
      if (!sid) {
        sid = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEY, sid);
      }
      return sid;
    } catch (e) {
      return 'fallback_guest_' + Math.floor(Math.random() * 10000);
    }
  }

  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Get URL param overrides for testing (e.g. ?exp_hero=b or ?exp_bundle=duo)
  var urlParams = new URLSearchParams(window.location.search);

  var visitorId = getVisitorSeed();

  // Active Experiment Registry
  var EXPERIMENT_SPECS = {
    exp_hero_clarity: {
      id: 'EXP-01-HERO',
      name: 'Hero Category Clarity',
      variants: ['control', 'action_reset', 'clothes_deodorant'],
      weights: [0.34, 0.33, 0.33],
      overrideParam: 'exp_hero'
    },
    exp_bundle_default: {
      id: 'EXP-02-BUNDLE',
      name: '1-Pack vs 2-Pack Default',
      variants: ['solo', 'duo'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_bundle'
    },
    exp_pricing_arch: {
      id: 'EXP-03-PRICING',
      name: 'Pricing Architecture',
      variants: ['standard', 'tiered_savings'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_pricing'
    },
    exp_payment_incentive: {
      id: 'EXP-04-PAYMENT',
      name: 'COD Fee vs Prepaid Incentive',
      variants: ['standard_cod_fee', 'prepaid_discount'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_payment'
    },
    exp_demo_placement: {
      id: 'EXP-05-DEMO',
      name: 'Demonstration Placement',
      variants: ['standard', 'high_priority'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_demo'
    },
    exp_review_placement: {
      id: 'EXP-06-REVIEWS',
      name: 'Review & Proof Placement',
      variants: ['standard', 'prominent'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_reviews'
    }
  };

  var activeVariants = {};

  // Assign variants deterministically
  Object.keys(EXPERIMENT_SPECS).forEach(function(expKey) {
    var spec = EXPERIMENT_SPECS[expKey];
    var overrideVal = urlParams.get(spec.overrideParam);

    if (overrideVal && spec.variants.indexOf(overrideVal) !== -1) {
      activeVariants[expKey] = overrideVal;
    } else {
      // Deterministic bucket allocation
      var h = hashString(visitorId + '_' + spec.id) % 100;
      var cumulative = 0;
      var chosen = spec.variants[0];

      for (var i = 0; i < spec.variants.length; i++) {
        cumulative += (spec.weights[i] * 100);
        if (h < cumulative) {
          chosen = spec.variants[i];
          break;
        }
      }
      activeVariants[expKey] = chosen;
    }
  });

  // Track Experiment Allocation via beacon & analytics
  function emitExperimentEvents() {
    try {
      if (typeof window.smfTrack === 'function') {
        window.smfTrack({
          type: 'experiment_assigned',
          label: 'CRO_V1',
          meta: Object.assign({}, activeVariants)
        });
      }
      if (typeof gtag !== 'undefined') {
        var gPayload = Object.assign({ event_category: 'Experimentation' }, activeVariants);
        gtag('event', 'cro_experiment_loaded', gPayload);
      }
      if (typeof fbq !== 'undefined') {
        fbq('trackCustom', 'ExperimentAssigned', activeVariants);
      }
    } catch (e) {}
  }

  // Apply Hero Variant Copy
  function applyHeroExperiment() {
    var variant = activeVariants.exp_hero_clarity;
    if (variant === 'control') return;

    var heroTitle = document.getElementById('heroHeadline') || document.getElementById('heroTitle') || document.querySelector('.product-info h1');
    var heroSub = document.getElementById('heroSubheading') || document.querySelector('.hero-sub') || document.querySelector('.ph-tagline');

    if (variant === 'action_reset') {
      if (heroTitle) heroTitle.innerHTML = 'Target Fabric Odor<br>At The Weave.';
      if (heroSub) heroSub.innerHTML = 'Stop spraying heavy perfume over sweaty shirts. ODORSTRIKE atomizes molecular cyclodextrins directly into fabric weaves to neutralize odor on clothes.';
    } else if (variant === 'clothes_deodorant') {
      if (heroTitle) heroTitle.innerHTML = 'Fabric Odor Spray<br>For Your Clothes.';
      if (heroSub) heroSub.innerHTML = 'Daytime sweat odor stays trapped in your shirt fabric, not on your skin. ODORSTRIKE captures and eliminates odor compounds directly at the fiber source.';
    }
  }

  // Apply Bundle Default (1-bottle vs 2-bottle default test)
  function applyBundleDefaultExperiment() {
    var variant = activeVariants.exp_bundle_default;
    if (variant === 'duo' && typeof window.pdpQtyStep === 'function') {
      try {
        if (!sessionStorage.getItem('smf_user_selected_qty')) {
          var qv = document.getElementById('pdpQtyVal');
          if (qv && qv.textContent.trim() === '1') {
            window.pdpQtyStep(1);
          }
        }
      } catch (e) {}
    }
  }

  // Apply DOM experiments on DOMContentLoaded
  function initExperiments() {
    applyHeroExperiment();
    applyBundleDefaultExperiment();
    emitExperimentEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExperiments);
  } else {
    initExperiments();
  }

  // Public API
  window.SMELLOFF_EXPERIMENTS = {
    getVariant: function(expName) {
      return activeVariants[expName] || null;
    },
    getAllVariants: function() {
      return Object.assign({}, activeVariants);
    },
    setVariantOverride: function(expName, variantVal) {
      if (EXPERIMENT_SPECS[expName] && EXPERIMENT_SPECS[expName].variants.indexOf(variantVal) !== -1) {
        activeVariants[expName] = variantVal;
        initExperiments();
      }
    },
    getVisitorId: function() {
      return visitorId;
    }
  };

})();
