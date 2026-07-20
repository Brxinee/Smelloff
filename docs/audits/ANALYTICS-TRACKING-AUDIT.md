# Analytics & Pixel Tracking Audit — Smelloff

**Date:** 2026-07-11
**Scope:** Every Google Analytics 4 (GA4 `G-S1MJ58PD89`) and Meta Pixel (`1455100092891684`) touchpoint across the site.
**Trigger:** Meta Events Manager → Diagnostics flagged _"Fix price information for web Purchase events — all of your web Purchase events are sending the same price information."_

---

## 1. How tracking is wired today

| Surface | Loader | Events |
|---|---|---|
| `index.html` (homepage + checkout) | inline, consent-gated | PageView, ViewContent, **AddToCart** (new), InitiateCheckout, AddPaymentInfo, Purchase |
| `faq.html` | inline, consent-gated | PageView |
| `odorstrike.html` + `assets/js/app.js` | inline + app.js | full funnel — **but `/odorstrike` 302-redirects to `/#buy`, so this is dead code** |
| All other pages (blog ×50, reviews, contact, about, policies, track-order, payment-failed, 404) | `assets/js/consent-analytics.js` | PageView, `buy_cta_click` |

**Consent:** GA4 + Meta are opt-in only. Nothing is contacted before the user clicks _Accept_ in the consent bar (`localStorage.smelloff_consent_v1`). No preconnect/dns-prefetch to Google/Meta before consent. This is DPDP-Act-friendly and was left unchanged.

**CSP:** `vercel.json` already whitelists `googletagmanager.com`, `connect.facebook.net`, `facebook.com`, `google-analytics.com`, `analytics.google.com`, `stats.g.doubleclick.net`. No CSP change was needed.

---

## 2. Findings & fixes

### 🔴 Critical — resolved

**F1. Purchase sent bare `{value, currency}` → Meta "same price information" error.**
Every `Purchase` (and `InitiateCheckout`, `AddPaymentInfo`) sent only value + currency, with no per-item structure. Meta could not validate the price as a real, dynamic transaction value and raised the diagnostic in the screenshot.
**Fix:** all commerce events now send Meta's full content payload — `value`, `currency`, `content_ids`, `content_type`, `content_name`, `contents:[{id, quantity, item_price}]`, `num_items` — and GA4 now sends the matching `items[]` array. Value is coerced to a `Number` > 0.

**F2. Purchase could double-count.** No idempotency guard — a page reload or duplicate success render could fire `Purchase` twice for one order, inflating conversions/ROAS.
**Fix:** `_purchasedOrders{}` guard fires each order once; Meta also gets `eventID: 'purchase_<orderId>'` so the platform dedupes server-side too (and it's CAPI-ready for later).

### 🟠 Medium — resolved

**F3. GA4 ecommerce events were missing `items[]`.** `purchase`, `begin_checkout`, `add_payment_info` had no `items`, so GA4's Monetisation / funnel reports were blind to the product.
**Fix:** every GA4 commerce event now carries `items:[{item_id, item_name, price, quantity}]`.

**F4. Funnel had no AddToCart step** (ViewContent → InitiateCheckout jumped a stage).
**Fix:** `AddToCart` / `add_to_cart` now fires when the checkout overlay opens, completing the standard 5-step funnel.

**F5. `app.js` Purchase had the same bare-payload + double-fire flaws.** Legacy/dead (only the redirected `/odorstrike` loads it) but fixed for parity so it can't re-introduce the Meta error if ever re-enabled.

### 🟡 Low — noted, not changed

- **L1. UPI "Purchase" fires on intent, not confirmed payment.** In the UPI path, `Purchase` fires when the QR/deep-link is shown — before the customer has actually paid. COD is fine (order is placed). This over-counts UPI purchases. A proper fix needs a server-side payment confirmation (Meta Conversions API from a Vercel function, keyed on the same `purchase_<orderId>` eventID already emitted). Recommended as a follow-up.
- **L2. No Meta Conversions API (server-side).** With iOS/ad-blocker signal loss, browser-only pixel under-reports. The `eventID` groundwork is now in place; adding a `/api/meta-capi` endpoint would close the gap. Needs a Meta access token (env var).
- **L3. `buy_cta_click` is only on `consent-analytics.js` pages**, not on the inline `index.html`/`faq.html`. Homepage is covered by ViewContent/InitiateCheckout; FAQ buy-intent clicks are not captured. Minor.
- **L4. Four near-identical loader copies** (`index`, `faq`, `odorstrike` inline + `consent-analytics.js`) invite drift (already visible: only the shared file has `buy_cta_click`). Consider consolidating all pages onto `consent-analytics.js`.
- **L5. `odorstrike.html` + `app.js` are dead code** (`/odorstrike` → `/#buy`). Candidate for removal to shrink the maintenance surface.
- **L6. Google Consent Mode v2 not used.** The hard opt-in gate is stricter and fine for India; Consent Mode would add conversion modeling if you later run Google Ads. Optional.

---

## 3. Event reference (after fixes)

| Funnel stage | GA4 event | Meta event | Key params now sent |
|---|---|---|---|
| View product | `view_item` | `ViewContent` | value, currency, items/contents, content_ids |
| Open checkout | `add_to_cart` | `AddToCart` | value, currency, items/contents, num_items |
| Begin checkout | `begin_checkout` | `InitiateCheckout` | value, currency, items/contents, num_items |
| Choose payment | `add_payment_info` | `AddPaymentInfo` | payment_type, value, currency, items/contents |
| Order placed | `purchase` | `Purchase` | transaction_id, value, currency, items/contents, num_items, **eventID**, dedup guard |

---

## 4. Verify after deploy

1. Meta **Events Manager → Test Events** — place a test order; confirm `Purchase` shows `value`, `currency`, `contents`, `num_items` and no "same price" warning after 24–72h.
2. GA4 **DebugView** — confirm `purchase` carries `items[]` and `transaction_id`.
3. Reload the success screen — confirm `Purchase` does **not** fire a second time.
