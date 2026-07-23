# Meta Pixel + Conversions API — Phase 1 Audit

**Date:** 2026-07-23
**Scope:** Every file that fires or forwards a Meta event on smelloff.in.
**Method:** Read-only audit of the live tracking surface. No fixes applied in this document — this is the "prove what's wrong with evidence" pass the brief asks for before any code changes.

> **Two premises in the original brief do not match this codebase.** There is **no Razorpay** integration (prepaid is a UPI deep-link with manual UTR reconciliation over WhatsApp) and there is **no OTP / Firebase auth flow** (COD orders are placed directly and confirmed by phone call). Any phase that depends on a Razorpay webhook or an OTP-verified `Lead` has to be re-scoped against the real architecture. See [§6 Scope corrections](#6-scope-corrections-brief-vs-reality) and [§7 Out of scope](#7-broken-but-out-of-scope).

---

## 1. The live tracking surface

| File | Role | Meta code |
|---|---|---|
| `index.html` | Homepage / brand page | Inline Pixel init + `PageView` (`:162`), `<noscript>` PageView (`:956`) |
| `odorstrike.html` | Product page **+ checkout** (the money page) | Inline Pixel init + `PageView` (`:238`); `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Purchase` (browser + CAPI beacon) |
| `faq.html` | FAQ | Inline Pixel init + `PageView` (`:70`) |
| `assets/js/consent-analytics.js` | Shared loader for every other page (blog, policies, reviews, about, contact, track-order) | Pixel init + `PageView` (`:34`) |
| `api/meta-capi.js` | Server-side Conversions API | `Purchase` only |

**Not part of the live surface (evidence):**
- `assets/js/app.js` — contains a full duplicate event set (AddToCart/InitiateCheckout/ViewContent/Purchase) **but is loaded by zero HTML files** (`grep -rln "assets/js/app.js" --include="*.html"` → empty). It is orphaned dead code and still references non-existent duo/trio packs. See [§7](#7-broken-but-out-of-scope).
- `api/track.js` + `assets/js/track.js` — first-party cookieless analytics. Not Meta; unrelated to this audit except that it is the *correct* consent-free model already in place.

---

## 2. Every Meta event currently fired

| Event | Trigger (file:line) | Browser | Server | `event_id`? | Params sent |
|---|---|---|---|---|---|
| `PageView` | `index.html:162`, `odorstrike.html:238`, `faq.html:70`, `consent-analytics.js:34` | ✅ | ❌ | ❌ | — |
| `ViewContent` | `odorstrike.html:3668` (IntersectionObserver on `#buy`, 30%) | ✅ | ❌ | ❌ | `content_ids:[OS-001-50ML]`, `content_type:product`, `content_name`, `value`, `currency:INR`, `contents`, `num_items` |
| `AddToCart` | `odorstrike.html:3608` via `trackAddToCart()` (called from `buyNow()` `:2954`) | ✅ | ❌ | ❌ | same `fbContents()` payload (qty defaults to 1) |
| `InitiateCheckout` | `odorstrike.html:3615` via `trackInitCheckout()` | ✅ | ❌ | ❌ | same `fbContents()` payload |
| `AddPaymentInfo` | `odorstrike.html:3101` (payment method toggle) | ✅ | ❌ | ❌ | `fbContents()` + `payment_type` |
| `Purchase` | `odorstrike.html:3633` (browser) + `:3643–3653` (CAPI beacon). Reached from `showSuccess()` `:3293` (COD **and** UPI-pending) and `showUpiSuccess()` `:3473` | ✅ | ✅ (browser-initiated) | ✅ `purchase_<orderId>` | browser: `fbContents()`; server: `value`, `currency`, `content_ids`, `contents`, `num_items`, `order_id`, hashed `em`/`ph`, `fbp`, `fbc`, IP, UA |
| `Lead` | **not fired** — no OTP flow exists | — | — | — | — |

`fbContents()` (`odorstrike.html:3594`) is the shared payload builder: `value`, `currency:INR`, `content_ids:['OS-001-50ML']`, `content_type:'product'`, `content_name`, `contents:[{id,quantity,item_price}]`, `num_items`.

---

## 3. Findings ranked by revenue impact

### 🔴 F1 — `Purchase` fires at order *placement*, for unpaid UPI and for COD, from the browser (inflates ROAS and mistrains the algorithm)

**Evidence:** `submitOrder()` (`odorstrike.html:3306`) writes a `UPI_PENDING` order and calls `showUpiSuccess()` → `trackPurchase()` (`:3473`) **before any payment is made** — the customer still has to open their UPI app and send a UTR over WhatsApp for the merchant to reconcile manually. The COD path (`:3293`) fires `Purchase` the moment the order is placed, before the confirmation phone call and long before delivery.

**Impact:** Every opened-UPI-intent and every COD order — including the ones that never pay and the COD parcels that return to origin (RTO) — is reported to Meta as a `Purchase` with full `value`. On India mobile COD, RTO commonly runs 20–40%. Meta optimises toward whatever you call a conversion, so it will actively learn to find people who *order and don't pay*. This is simultaneously the biggest ROAS inflation **and** the biggest ad-spend-quality problem on the site. It is the reason Phase 4 exists.

**Correct behaviour:** `Purchase` should be the *confirmed-revenue* signal, emitted server-side — for UPI when the UTR is verified, for COD at (or toward) delivery — and paired with the RTO/cancellation correction in F2.

---

### 🔴 F2 — No COD/RTO correction path exists (Phase 4 is entirely unimplemented)

**Evidence:** grep for `Refund` / negative-value events / a fulfilment-state field driving Meta corrections → nothing. The CAPI payload carries no prepaid-vs-COD custom property, and the Supabase order lifecycle (`placed→…→delivered`, `cancelled`) never emits a Meta event.

**Impact:** Even once F1 is fixed, reported ROAS cannot converge to real margin without sending a `Refund`/negative event when a COD order is cancelled, refused, or returns to origin. This is called out in the brief as mattering "more than anything above."

---

### 🟠 F3 — Server-side Purchase is browser-initiated, not a true server source of truth

**Evidence:** the CAPI call is a `navigator.sendBeacon('/api/meta-capi', …)` fired from the success screen (`odorstrike.html:3652`), gated on `typeof fbq !== 'undefined'` (`:3643`). If the browser is closed, the session drops, an ad-blocker kills the beacon, or the Pixel never loaded (no consent), **no server event is sent either.**

**Impact:** The entire point of CAPI — recovering the conversions the browser loses on Indian mobile — is defeated, because the server event rides on the same fragile browser moment as the Pixel. A real server-of-truth would fire from the order lifecycle (the Supabase `create-order` Edge Function / admin confirmation), independent of the shopper's browser.

---

### 🟠 F4 — Advanced Matching is weak: browser sends none; server sends only email + phone

**Evidence:** every `fbq('init','1455100092891684')` (`index.html:162`, `odorstrike.html:238`, `faq.html:70`, `consent-analytics.js:34`) is called **with no advanced-matching object** — no email/phone handed to the Pixel for automatic AM. Server-side (`api/meta-capi.js:79–86`) hashes only `em` and `ph`. The checkout form already collects **name, city, state, pincode** (`f_name`, `f_city`, `f_state`, `f_pin`) but none of `fn`, `ln`, `ct`, `st`, `zip`, `country` are hashed and sent.

**Impact:** Low Event Match Quality → weaker attribution and worse optimisation, especially on the recovered CAPI conversions where the browser cookie is exactly what's missing. Every additional matched field measurably raises EMQ.

**Note (correct where present):** the two fields it *does* send are normalised correctly — email lowercased/trimmed (`:36`), Indian phone forced to `91##########` E.164-without-plus before hashing (`:41–46`), and IP prefers `cf-connecting-ip` over the Cloudflare POP (`:52–58`). SHA-256 is applied server-side and raw PII is never transmitted or stored. That part is right.

---

### 🟠 F5 — CAPI is neither idempotent nor logged

**Evidence:** `api/meta-capi.js` has no dedup store and writes nothing to Supabase. It relies solely on Meta collapsing duplicates by `event_id`. On failure it `console.error`s and returns `204` (`:112`) — invisible to anyone not tailing Vercel logs.

**Impact:** A retried beacon produces a second Graph API call (Meta usually dedupes it, but the system has no guarantee and no record). Worse, **failures are silent** — exactly the "failures visible instead of silent" requirement the brief calls out. Phase 3 wants every request/response logged to Supabase keyed by `event_id`.

---

### 🟡 F6 — Only `Purchase` is deduplicated; the rest of the funnel has no `event_id` and no CAPI mirror

**Evidence:** `event_id`/`eventID` appears only on `Purchase` (`odorstrike.html:3633`, `api/meta-capi.js:97`). `ViewContent`/`AddToCart`/`InitiateCheckout`/`AddPaymentInfo` are browser-only with no ID.

**Impact:** Lower than F1–F5 (these are upper-funnel signals), but the Phase 2 taxonomy asks for a shared `event_id` on every mirrored event, and browser-only upper funnel loses the same ad-blocker share as Purchase did.

---

### 🟡 F7 — `fbc` is only ever auto-created by the Pixel; no fallback from `fbclid`

**Evidence:** the CAPI beacon reads `_fbc` straight from cookie (`odorstrike.html:3649`). `_fbc` is only ever populated by the Pixel script, which loads **after** page-load **and only after consent**. There is no code that constructs `fbc` from an `fbclid` landing-URL param.

**Impact:** A shopper who lands from a Meta ad (`?fbclid=…`), delays or declines consent, then later converts, loses click-level attribution because `_fbc` was never built. Moderate attribution leak on paid traffic specifically.

---

### 🟡 F8 — `num_items` is hard-coded to 1 on upper-funnel events

**Evidence:** `trackAddToCart()`/`trackInitCheckout()`/`ViewContent` call `fbContents(v)` with no qty (`odorstrike.html:3608/3615/3669`), so `num_items` defaults to 1 even when the cart holds several bottles. `Purchase` passes the real `cartQty`, so only the upper funnel is affected.

**Impact:** Minor — under-reports multi-unit basket value/quantity on upper-funnel events; does not affect Purchase revenue.

---

## 4. Direct answers to the brief's checklist

| Question | Answer |
|---|---|
| Do browser & server `Purchase` share a matching `event_id` for dedup? | **Yes, correctly.** Both use `purchase_<orderId>` (`odorstrike.html:3633`, `api/meta-capi.js:97`). This one is right. |
| Can `Purchase` fire more than once per order? | **Low browser risk, but not guaranteed server-side.** In-memory guard `_purchasedOrders` (`odorstrike.html:3623`) blocks re-fire within a page load; there is no thank-you page reload with the order in the URL, so refresh returns to a clean product page. But the guard resets on reload and the **server has no idempotency** (F5). Meta's `event_id` dedup is the only backstop. |
| Does `Purchase` fire client-side only? | **Effectively yes** — the "server" event is browser-initiated and dies with the browser (F3). |
| Are `fbp`/`fbc` captured and forwarded? | `fbp` yes; `fbc` yes **when it exists**, but it's never constructed from `fbclid` (F7). |
| Advanced matching sent & hashed correctly? | Server: only `em`+`ph`, but those are normalised & SHA-256'd correctly. Browser: **none**. Missing `fn`/`ln`/`ct`/`st`/`zip`/`country` despite being collected (F4). |
| `value` & `currency` on every commercial event? | **Yes** — all commercial events carry numeric `value` + `currency:'INR'`. Correct. |
| `content_ids` stable SKU or ad-hoc? | **Stable** — `'OS-001-50ML'` everywhere via `fbContents()`. Correct. |

---

## 5. What is already correct (do not regress)

- Shared `event_id` on the Purchase pair (dedup works).
- Stable SKU `content_ids`, correct `value`/`currency:INR` on all commercial events.
- Server-side SHA-256 of email/phone with correct Indian E.164 normalisation; real client IP behind Cloudflare.
- CAPI is inert until `META_CAPI_TOKEN` is set and fail-silent (never blocks checkout) — good production hygiene.
- Consent gate exists (`smelloff_consent_v1`); Pixel/GA4 load only on accept; bots excluded.
- Tracking is off the critical path (async Pixel, `defer`, beacon/keepalive).

---

## 6. Scope corrections (brief vs reality)

| Brief assumes | Reality on smelloff.in | Consequence for the plan |
|---|---|---|
| Razorpay prepaid + payment webhook | **UPI deep-link**, UTR reconciled manually via WhatsApp; no webhook, no signature handler | "Fire Purchase on verified Razorpay webhook" → must instead fire on **UTR verification in admin** (or order status → `confirmed`). |
| COD OTP verification → `Lead` | **No OTP / no Firebase**; COD placed directly, confirmed by phone | `Lead` on OTP can't exist. Either drop `Lead` or redefine its trigger (e.g. checkout contact captured). Needs a decision. |
| ₹229 / ₹399 / ₹549 catalog | **Single SKU ₹229** only (CLAUDE.md is authoritative; duo/trio are forbidden) | Keep single-SKU everywhere. `num_items`/`value` scale by cart quantity, not by pack SKU. |
| Server order-write endpoint to hook Purchase | Exists: Supabase **`create-order` Edge Function** (`odorstrike.html:2836`), called from the browser | This + the admin status pipeline (`placed→…→delivered`, `cancelled`) is the real place to emit server-truth Purchase and the RTO Refund correction. |

**Decisions needed before Phase 3–4 implementation:**
1. **Prepaid Purchase trigger** — fire on UTR-verified/`confirmed`, or keep at placement but tagged `unverified`? (Recommend: fire server-side on `confirmed`.)
2. **`Lead` event** — drop it, or repoint it to "checkout contact captured"?
3. **Where to run CAPI** — extend the Vercel `api/meta-capi.js` and call it from the Supabase Edge Function / admin status change, vs. moving CAPI into Supabase. (Recommend: keep `api/meta-capi.js`, invoke it server-to-server from the order lifecycle, make it idempotent + logged.)

---

## 7. Broken-but-out-of-scope

- **`assets/js/app.js` is orphaned dead code** (loaded by no page) yet still contains a full Meta event set and references non-existent ₹399/₹549 duo/trio packs. Recommend deletion in a separate cleanup PR — leaving it invites a future page to `<script src>` it and silently ship wrong pricing + un-mirrored Purchases.
- **Client-generated order IDs** (`genOrderId()` `odorstrike.html:3142`, random 4-digit suffix) — collision-prone and client-trusted; the same value becomes the Meta `event_id`. Not a tracking bug per se, but it weakens Purchase idempotency. Flag for the order-flow owner.
- **No Limited Data Use flag** for Meta (Phase 5) — not wired anywhere; low urgency given first-party analytics already runs consent-free and Pixel is consent-gated, but worth adding for DPDP posture.

---

## 8. Verification (Phase 6) — cannot be done from code alone

Confirming browser⇄server pairing/dedup in Events Manager → Test Events, reading the `Purchase` Event Match Quality score, and running live test orders on both payment paths all require Meta Events Manager access and a live deploy with `META_CAPI_TOKEN` set. Those steps must be run by someone with the ad account; this audit documents what to expect and what "good" looks like so they can be checked off after the fixes land.
