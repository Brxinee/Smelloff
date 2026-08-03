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
    // Never load GA4 / Meta Pixel for automated browsers (headless/scraper bots
    // auto-click "Accept all", which was inflating both platforms).
    if (window.smfIsBot ? window.smfIsBot() : navigator.webdriver === true) return;
    if (window.__smelloffAnalyticsLoaded) return;
    window.__smelloffAnalyticsLoaded = true;
    var g = document.createElement('script');
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    g.async = true;
    document.head.appendChild(g);
    g.onload = function () {
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', GA4_ID);
      var aiR = (document.referrer || '').match(/https?:\/\/([^\/]*\.)?(chatgpt\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com)/);
      if (aiR) { gtag('event', 'ai_referral', { ai_source: aiR[2], landing_page: location.pathname }); }
    };
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
    loadClarity();
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
    var css = '#smelloff-consent-bar{display:block;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#111;border-top:1px solid rgba(244,241,234,.12);padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));font-family:"Inter Tight","DM Sans",system-ui,sans-serif}' +
      '#smelloff-consent-bar .cb-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '#smelloff-consent-bar p{flex:1;font-size:13px;color:#9a958d;line-height:1.5;margin:0;min-width:200px}' +
      '#smelloff-consent-bar p a{color:#b8ff57;text-decoration:none}' +
      // flex-wrap + shrink: this row was `flex-shrink:0` with no wrap, so at
      // 320px the two buttons measured 315px inside a 300px content box and
      // "Reject non-essential" hung off the right edge of the screen. Below
      // the phone breakpoint they take a row each instead. Kept in sync with
      // chrome.css §5.2 and the two inline copies in index/odorstrike.
      '#smelloff-consent-bar .cb-actions{display:flex;flex-wrap:wrap;gap:10px;flex-shrink:1;min-width:0}' +
      '#smelloff-consent-bar button{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:9px 18px;min-height:44px;border-radius:2px;cursor:pointer}' +
      '@media(max-width:520px){#smelloff-consent-bar .cb-actions{width:100%}#smelloff-consent-bar .cb-actions button{flex:1 1 100%}}' +
      '#smelloff-consent-bar .cb-accept{background:#b8ff57;color:#080808;border:none}' +
      '#smelloff-consent-bar .cb-reject{background:transparent;color:#f4f1ea;border:1px solid rgba(244,241,234,.25)}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'smelloff-consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie and tracking consent');
    bar.innerHTML = '<div class="cb-inner">' +
      '<p>We use analytics cookies (Google Analytics, Meta Pixel) to understand how you use our site. You can opt out — core shopping functions work either way. <a href="/privacy">Privacy Policy</a></p>' +
      '<div class="cb-actions">' +
      '<button class="cb-accept" onclick="window.smelloffSetConsent(\'accepted\')">Accept all</button>' +
      '<button class="cb-reject" onclick="window.smelloffSetConsent(\'rejected\')">Reject non-essential</button>' +
      '</div></div>';
    document.body.appendChild(bar);
  }

  // Track clicks on buy CTAs (links to /#buy or /odorstrike) so blog → buy
  // intent is attributable per page in GA4.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('#buy') === -1 && href.indexOf('/odorstrike') === -1) return;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'buy_cta_click', {
        link_url: href,
        link_text: (a.textContent || '').trim().slice(0, 80),
        page_path: location.pathname
      });
    }
  }, true);

  function init() {
    var consent = getConsent();
    if (consent === 'accepted') {
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
