/* =====================================================================
   Smelloff & ODORSTRIKE — CRO Experimentation Engine (v1.1)
   =====================================================================
   Deterministic, cookieless, single-experiment isolation architecture.
   Only ONE experiment is active by default to prevent statistical contamination.
   
   ACTIVE EXPERIMENT:
     1. Hero / Category Clarity (EXP-01-HERO)
        - Control: Approved Baseline Hero
        - Variant A (action_reset): Problem & Behavior Framing
        - Variant B (clothes_deodorant): Category & Product Clarity Framing
   
   Dormant / Flag-Gated Experiments (Preserved for sequential iterations):
     2. 1-Pack vs 2-Pack Default (EXP-02-BUNDLE)
     3. Pricing Architecture (EXP-03-PRICING)
     4. COD Fee vs Prepaid Incentive (EXP-04-PAYMENT)
     5. Demonstration Placement (EXP-05-DEMO)
     6. Review & Proof Placement (EXP-06-REVIEWS)
   ===================================================================== */
(function() {
  'use strict';

  if (window.SMELLOFF_EXPERIMENTS) return;

  var STORAGE_KEY = 'smf_exp_bucket_v2';

  // Configurable active experiments list — single experiment active by default
  var ACTIVE_EXPERIMENTS = (window.SMELLOFF_CONFIG && window.SMELLOFF_CONFIG.ACTIVE_EXPERIMENTS) || ['exp_hero_clarity'];

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
      return 'guest_' + Math.floor(Math.random() * 10000);
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

  // URL overrides for internal QA / review (?exp_hero=control | action_reset | clothes_deodorant)
  var urlParams = new URLSearchParams(window.location.search);
  var visitorId = getVisitorSeed();

  // Full Experiment Specifications Registry
  var EXPERIMENT_SPECS = {
    exp_hero_clarity: {
      id: 'EXP-01-HERO',
      name: 'Hero Category Clarity',
      defaultVariant: 'control',
      variants: ['control', 'action_reset', 'clothes_deodorant'],
      weights: [0.34, 0.33, 0.33],
      overrideParam: 'exp_hero'
    },
    exp_bundle_default: {
      id: 'EXP-02-BUNDLE',
      name: '1-Pack vs 2-Pack Default',
      defaultVariant: 'solo',
      variants: ['solo', 'duo'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_bundle'
    },
    exp_pricing_arch: {
      id: 'EXP-03-PRICING',
      name: 'Pricing Architecture',
      defaultVariant: 'standard',
      variants: ['standard', 'tiered_savings'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_pricing'
    },
    exp_payment_incentive: {
      id: 'EXP-04-PAYMENT',
      name: 'COD Fee vs Prepaid Incentive',
      defaultVariant: 'standard_cod_fee',
      variants: ['standard_cod_fee', 'prepaid_discount'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_payment'
    },
    exp_demo_placement: {
      id: 'EXP-05-DEMO',
      name: 'Demonstration Placement',
      defaultVariant: 'standard',
      variants: ['standard', 'high_priority'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_demo'
    },
    exp_review_placement: {
      id: 'EXP-06-REVIEWS',
      name: 'Review & Proof Placement',
      defaultVariant: 'standard',
      variants: ['standard', 'prominent'],
      weights: [0.50, 0.50],
      overrideParam: 'exp_reviews'
    }
  };

  var activeVariants = {};

  // Assign variants deterministically (only active experiments receive randomized buckets)
  Object.keys(EXPERIMENT_SPECS).forEach(function(expKey) {
    var spec = EXPERIMENT_SPECS[expKey];
    var overrideVal = urlParams.get(spec.overrideParam);

    if (overrideVal && spec.variants.indexOf(overrideVal) !== -1) {
      activeVariants[expKey] = overrideVal;
    } else if (ACTIVE_EXPERIMENTS.indexOf(expKey) !== -1) {
      // Deterministic bucket allocation for active experiment
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
    } else {
      // Inactive experiments strictly locked to baseline default
      activeVariants[expKey] = spec.defaultVariant;
    }
  });

  // Track Experiment Allocation via beacon & analytics
  function emitExperimentEvents() {
    try {
      if (typeof window.smfTrack === 'function') {
        window.smfTrack({
          type: 'experiment_assigned',
          label: 'CRO_V1_SINGLE_HERO',
          meta: {
            active_experiment: 'exp_hero_clarity',
            variant: activeVariants.exp_hero_clarity,
            all_variants: Object.assign({}, activeVariants)
          }
        });
      }
      if (typeof gtag !== 'undefined') {
        gtag('event', 'cro_experiment_loaded', {
          event_category: 'Experimentation',
          experiment_id: 'EXP-01-HERO',
          variant: activeVariants.exp_hero_clarity
        });
      }
      if (typeof fbq !== 'undefined') {
        fbq('trackCustom', 'ExperimentAssigned', {
          experiment_id: 'EXP-01-HERO',
          variant: activeVariants.exp_hero_clarity
        });
      }
    } catch (e) {}
  }

  // Apply Hero Variant Copy (Strictly verified claims only)
  function applyHeroExperiment() {
    var variant = activeVariants.exp_hero_clarity;
    if (variant === 'control') return;
    // Stage 2 locked the homepage ATF as category-first. Do not rewrite it.
    // Assignment + tracking still run; only the DOM mutation is skipped.
    if (document.querySelector('section.so-hero')) return;

    var heroTitle = document.getElementById('heroHeadline') || document.getElementById('heroTitle') || document.querySelector('.product-info h1');
    var heroSub = document.getElementById('heroSubheading') || document.querySelector('.hero-sub') || document.querySelector('.ph-tagline');

    if (variant === 'action_reset') {
      // Variant A: Problem & Behavior Framing
      if (heroTitle) heroTitle.innerHTML = 'Target Sweat Odor<br>At The Clothing Weave.';
      if (heroSub) heroSub.innerHTML = 'Stop spraying heavy perfume over sweaty shirts. ODORSTRIKE mist neutralizes odor compounds directly on fabric fibers with up to 8 hours of odor protection on fabric under normal office/commute conditions.';
    } else if (variant === 'clothes_deodorant') {
      // Variant B: Category & Product Clarity Framing
      if (heroTitle) heroTitle.innerHTML = 'Pocket Fabric Odor Spray<br>For Your Clothes.';
      if (heroSub) heroSub.innerHTML = 'Daytime sweat odor stays trapped in shirt fabric, not on your skin. ODORSTRIKE captures and eliminates odor compounds directly at the fiber source — not a perfume, not a deodorant.';
    }
  }

  // Apply DOM experiments on DOMContentLoaded
  function initExperiments() {
    applyHeroExperiment();
    emitExperimentEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExperiments);
  } else {
    initExperiments();
  }

  // Public API
  window.SMELLOFF_EXPERIMENTS = {
    getActiveExperiment: function() {
      return 'exp_hero_clarity';
    },
    getVariant: function(expName) {
      return activeVariants[expName] || (EXPERIMENT_SPECS[expName] ? EXPERIMENT_SPECS[expName].defaultVariant : null);
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
