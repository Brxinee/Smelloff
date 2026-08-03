/* =============================================================================
 * Google Customer Reviews — opt-in survey + (optional) seller-rating badge.
 * Merchant Center account 5772928187.
 *
 * TWO PARTS, ONE FILE:
 *
 *   1. THE OPT-IN (required by the programme). Renders on the order
 *      confirmation moment and asks the buyer whether Google may email them a
 *      survey about this order later. This is what actually produces seller
 *      ratings. Call smfGoogleReviewOptIn() — see below.
 *
 *   2. THE BADGE (optional). Shows the seller rating on the site. Off by
 *      default — see BADGE_ENABLED for why.
 *
 * WHY THIS IS CONSENT-GATED
 * -------------------------
 * The opt-in call hands the customer's EMAIL ADDRESS to Google. That is
 * personal data going to a third party for a non-essential purpose, which is
 * exactly the category this site puts behind `smelloff_consent_v1`. /privacy
 * states that non-essential third parties load "only after you give explicit
 * consent via the cookie banner" — firing this regardless would make that
 * sentence false, and an accurate privacy policy is worth more than a few
 * extra review invitations.
 *
 * The practical cost is real and you should know it: a buyer who has not
 * answered the consent bar never sees the opt-in, so opt-in volume will be
 * lower than a Shopify store that fires it unconditionally. If the decision is
 * ever made to fire it on legitimate-interest grounds instead, change
 * hasConsent() below AND update /privacy in the same commit — never one
 * without the other.
 *
 * CSP
 * ---
 * This needs four things that vercel.json did not previously allow:
 *   script-src   https://apis.google.com      (the opt-in loader)
 *   script-src   https://www.gstatic.com      (the badge widget)
 *   frame-src    https://www.google.com       (the opt-in renders in an IFRAME
 *                                              — `frame-src 'none'` blocked it
 *                                              outright, silently)
 *   connect-src  https://apis.google.com
 * If the opt-in ever stops appearing, check the console for a CSP violation
 * before anything else.
 * ============================================================================= */
(function () {
  'use strict';

  var MERCHANT_ID = 5772928187;
  var CONSENT_KEY = 'smelloff_consent_v1';

  /* The badge prints "no rating available" until Google has gathered enough
     surveys to publish a seller rating — and a box on your own site saying it
     has no rating is a worse trust signal than no box at all. Flip this to
     true once ratings are actually live in Merchant Center, and add this
     script to the shared chrome (scripts/apply-chrome.mjs) so the badge can
     appear site-wide rather than on the product page only. */
  var BADGE_ENABLED = false;
  var BADGE_POSITION = 'BOTTOM_RIGHT';
  var BADGE_REGION = 'IN';

  /* Ships pan-India only. */
  var DELIVERY_COUNTRY = 'IN';

  /* /track-order tells customers 3–7 days from order placement, and the PDP
     says "delivers in 3-7 days". Google wants one date, so use the far end:
     promising the optimistic date and missing it is how a survey turns into a
     bad rating. Keep this in step with the ETA logic in track-order.html. */
  var DELIVERY_DAYS = 7;

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; }
    catch (e) { return false; }
  }

  /* Same guard the analytics loaders use: headless browsers auto-accept the
     consent bar, and a survey opt-in rendered for a crawler is noise in
     Merchant Center. */
  function isBot() {
    return window.smfIsBot ? window.smfIsBot() : navigator.webdriver === true;
  }

  function isoDatePlus(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    // YYYY-MM-DD in local time. toISOString() would shift IST back a day.
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function loadScript(src, onload) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    if (onload) s.onload = onload;
    document.head.appendChild(s);
    return s;
  }

  /* ---------------------------------------------------------------------
   * 1 · OPT-IN
   * Called from showSuccess() in odorstrike.html once an order actually
   * exists. Everything is best-effort and wrapped: this runs on the screen
   * that confirms someone's order, and a survey widget failing must never be
   * visible to them, let alone throw.
   *
   * `email` is optional here on purpose — the checkout marks it optional
   * (phone is the required contact), and Google needs an address to send a
   * survey to. No email, no opt-in, no error.
   * --------------------------------------------------------------------- */
  window.smfGoogleReviewOptIn = function (order) {
    try {
      order = order || {};
      if (!order.orderId || !order.email) return;
      if (!hasConsent() || isBot()) return;
      if (window.__smfGcrRendered) return;      // one order, one opt-in
      window.__smfGcrRendered = true;

      window.renderOptIn = function () {
        try {
          window.gapi.load('surveyoptin', function () {
            window.gapi.surveyoptin.render({
              merchant_id: MERCHANT_ID,
              order_id: String(order.orderId),
              email: String(order.email),
              delivery_country: order.country || DELIVERY_COUNTRY,
              estimated_delivery_date: order.deliveryDate || isoDatePlus(DELIVERY_DAYS)
              /* `products` (GTINs) is deliberately omitted: ODORSTRIKE has an
                 internal SKU (ODORSTRIKE-50ML) but no GTIN, and an internal SKU
                 is not a GTIN. The field is optional; sending a wrong value is
                 worse than sending none. Add it here once a real barcode
                 exists. */
            });
          });
        } catch (e) { /* never surface on the confirmation screen */ }
      };

      loadScript('https://apis.google.com/js/platform.js?onload=renderOptIn');
    } catch (e) { /* ditto */ }
  };

  /* ---------------------------------------------------------------------
   * 2 · BADGE
   * --------------------------------------------------------------------- */
  function initBadge() {
    if (!BADGE_ENABLED || !hasConsent() || isBot()) return;
    var s = loadScript('https://www.gstatic.com/shopping/merchant/merchantwidget.js');
    s.id = 'merchantWidgetScript';
    s.addEventListener('load', function () {
      try {
        window.merchantwidget.start({
          merchant_id: MERCHANT_ID,
          position: BADGE_POSITION,
          region: BADGE_REGION
        });
      } catch (e) { /* ignore */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBadge);
  } else {
    initBadge();
  }
})();
