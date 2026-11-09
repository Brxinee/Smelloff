/* Smelloff — shared consent-gated analytics (GA4 + Meta Pixel).
 * Include with: <script src="/assets/js/consent-analytics.js" defer></script>
 * Mirrors the inline setup on index/faq/odorstrike: nothing is contacted
 * before the user opts in via the consent bar (localStorage smelloff_consent_v1).
 * Pages with their own inline consent setup must NOT include this file.
 */
(function () {
  'use strict';

  var KEY = 'smelloff_consent_v1';
  var GA4_ID = 'G-S1MJ58PD89';
  var META_PIXEL_ID = '1455100092891684';
  // Microsoft Clarity — session recordings + heatmaps. Paste the project ID
  // from clarity.microsoft.com to switch it on; empty means the tag is never
  // requested, so shipping it unset costs nothing. Clarity writes a first-party
  // cookie and reads localStorage, so it loads on "Accept all" only, alongside
  // GA4 and the Pixel — never on the cookieless /api/track beacon path.
  // This constant exists in FOUR places, same as GA4_ID and META_PIXEL_ID:
  // here, and inline in index.html, faq.html and odorstrike.html. Set all four.
  var CLARITY_ID = '';

  function loadAnalytics() {
    if (!primeAnalytics()) return;
    if (window.__smelloffAnalyticsLoaded) return;
    window.__smelloffAnalyticsLoaded = true;
    var g = document.createElement('script');
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    g.async = true;
    document.head.appendChild(g);
    var p = document.createElement('script');
    p.src = 'https://connect.facebook.net/en_US/fbevents.js';
    p.async = true;
    document.head.appendChild(p);
    loadClarity();
  }

  // The queues (2026-10-20): gtag and fbq exist as soon as consent is known
  // and hold every call until their scripts arrive. gtag used to be defined
  // only when its script loaded, so earlier events were dropped by the
  // `typeof gtag` checks. Never for automated browsers (headless/scraper bots
  // auto-click "Accept all", which was inflating both platforms). Same block
  // inline in index.html, faq.html and odorstrike.html.
  function primeAnalytics() {
    if (window.__smfAnalyticsPrimed) return true;
    var n = navigator;
    if (window.smfIsBot ? window.smfIsBot() : (n.webdriver === true || /Headless|PhantomJS|Puppeteer|Playwright|Electron\//i.test(n.userAgent || ''))) return false;
    if (smfGaExcluded()) return false;
    window.__smfAnalyticsPrimed = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, smfGaConfig());
    var aiR = (document.referrer || '').match(/https?:\/\/([^\/]*\.)?(chatgpt\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com)/);
    if (aiR) { window.gtag('event', 'ai_referral', { ai_source: aiR[2], landing_page: location.pathname }); }
    if (!window.fbq) {
      var q = window.fbq = function () { q.callMethod ? q.callMethod.apply(q, arguments) : q.queue.push(arguments); };
      if (!window._fbq) window._fbq = q;
      q.push = q; q.loaded = !0; q.version = '2.0'; q.queue = [];
    }
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
    return true;
  }

  // GA4 config (2026-11-02): the owner's own devices send nothing (the same
  // smelloff_owner flag track.js uses; /admin sets it on login), every page
  // carries a content_group, and ?ga_debug=1 turns on DebugView for that tab.
  // Same block inline in index.html, faq.html and odorstrike.html.
  function smfGaExcluded() {
    try {
      var s = location.search;
      if (/[?&]smf_owner=1(&|$)/.test(s)) return true;
      if (/[?&]smf_owner=0(&|$)/.test(s)) return false;
      return localStorage.getItem('smelloff_owner') === '1';
    } catch (e) { return false; }
  }
  function smfGaConfig() {
    var p = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    var cg = p === '/' ? 'home' : p === '/odorstrike' ? 'product' : p === '/blog' ? 'blog_index' : /^\/blog\//.test(p) ? 'blog_post' : /^\/(shipping|returns|refund|privacy|terms|cancellation)$/.test(p) ? 'policy' : p.slice(1).split('/')[0];
    var c = { content_group: cg };
    try {
      if (/[?&]ga_debug=1(&|$)/.test(location.search)) sessionStorage.setItem('smf_ga_debug', '1');
      if (sessionStorage.getItem('smf_ga_debug') === '1') c.debug_mode = true;
    } catch (e) {}
    return c;
  }

  // Kept separate from loadAnalytics() so the bot guard and the consent gate
  // above apply to it unchanged, and so a missing ID is a no-op rather than a
  // request to clarity.ms that 404s on every page view.
  function loadClarity() {
    if (!CLARITY_ID || window.clarity) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function getConsent() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  window.smelloffSetConsent = function (v) {
    try { localStorage.setItem(KEY, v); } catch (e) { }
    var b = document.getElementById('smelloff-consent-bar');
    if (b) b.style.display = 'none';
    if (v === 'accepted') loadAnalytics();
  };

  function injectConsentBar() {
    if (document.getElementById('smelloff-consent-bar')) return;
    var css = '#smelloff-consent-bar{display:block;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#111;border-top:1px solid rgba(242,245,239,.12);padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));font-family:var(--body,system-ui,sans-serif)}' +
      '#smelloff-consent-bar .cb-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '#smelloff-consent-bar p{flex:1;font-size:13px;color:#9DA398;line-height:1.5;margin:0;min-width:200px}' +
      '#smelloff-consent-bar p a{color:#B8FF57;text-decoration:underline;text-underline-offset:2px}' +
      // flex-wrap + shrink: this row was `flex-shrink:0` with no wrap, so at
      // 320px the two buttons measured 315px inside a 300px content box and
      // "Reject non-essential" hung off the right edge of the screen. Below
      // the phone breakpoint they wrap. Kept in sync with chrome.css §5 and
      // the three inline copies in index/odorstrike/faq.
      '#smelloff-consent-bar .cb-actions{display:flex;flex-wrap:wrap;gap:10px;flex-shrink:1;min-width:0}' +
      '#smelloff-consent-bar button{font-family:var(--body,system-ui,sans-serif);font-size:14px;font-weight:500;letter-spacing:.01em;padding:9px 18px;min-height:44px;border-radius:8px;cursor:pointer}' +
      '#smelloff-consent-bar .cb-accept{background:#F2F5EF;color:#0A0A0A;border:none}' +
      '#smelloff-consent-bar .cb-reject{background:transparent;color:#F2F5EF;border:1px solid rgba(242,245,239,.25)}' +
      // CONSENT-COMPACT (2026-11-08, owner: smaller cookie bar): phones get one
      // row, the sentence beside two equal 44px buttons; under ~370px of room
      // the buttons wrap under the sentence and share that row.
      '@media(max-width:519px){' +
      '#smelloff-consent-bar{padding:4px 12px calc(4px + env(safe-area-inset-bottom,0px))}' +
      '#smelloff-consent-bar .cb-inner{gap:6px 8px;flex-wrap:wrap}' +
      '#smelloff-consent-bar p{flex:999 1 150px;min-width:150px;max-width:none;margin:0;font-size:12px;line-height:1.25}' +
      '#smelloff-consent-bar .cb-who{display:none}' +
      '#smelloff-consent-bar .cb-actions{flex:1 0 198px;width:auto;gap:6px;flex-wrap:nowrap}' +
      '#smelloff-consent-bar .cb-actions button{flex:1 1 96px;min-height:44px;padding:4px 6px;font-size:13px;line-height:1.2}' +
      '}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'smelloff-consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie and tracking consent');
    bar.innerHTML = '<div class="cb-inner">' +
      '<p>Analytics cookies<span class="cb-who"> (Google Analytics, Meta Pixel)</span> help us improve the site. <a href="/privacy">Privacy Policy</a></p>' +
      '<div class="cb-actions">' +
      '<button class="cb-accept" onclick="window.smelloffSetConsent(\'accepted\')">Accept all</button>' +
      '<button class="cb-reject" onclick="window.smelloffSetConsent(\'rejected\')">Reject non-essential</button>' +
      '</div></div>';
    document.body.appendChild(bar);
  }

  // buy_cta_click moved to assets/js/track.js (2026-11-02): this file isn't on
  // index, faq or odorstrike, so those pages never sent it.

  function init() {
    var consent = getConsent();
    if (consent === 'accepted') {
      primeAnalytics();
      if (document.readyState === 'complete') loadAnalytics();
      else window.addEventListener('load', loadAnalytics, { once: true });
    } else if (!consent) {
      injectConsentBar();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // The first-party pageview beacon moved to /assets/js/track.js, which every
  // page now loads directly — it also captures clicks, funnel events and cart
  // snapshots. Nothing consent-gated lives there (cookieless, no PII).
})();
