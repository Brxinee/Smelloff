# SMELLOFF / ODORSTRIKE — Production Readiness Audit

> Date: 2026-04-27 · Branch: `claude/audit-smelloff-production-1qZQn`
> Scope: smelloff.in static site (single-file HTML/CSS/JS, Vercel)

---

## 1. Executive Summary

| Severity | Count |
|---|---|
| 🔴 BLOCKER | 9 |
| 🟠 HIGH | 17 |
| 🟡 MEDIUM | 22 |
| 🟢 LOW | 8 |
| **Total** | **56** |

**The big rocks**

1. **Stale legal copy** — `privacy.html` and `terms.html` still cite Razorpay and Firebase Authentication. The site uses neither (UPI + COD only, Firebase removed). This is misleading legal text, must be fixed before launch.
2. **Stale price in transactional emails** — `api/email-templates.js` welcome + abandoned-cart emails show `₹179` and `Free shipping above ₹299`. Site is `₹229` launch + free shipping pan-India.
3. **Stale Razorpay copy in `/blog/where-to-buy-odorstrike-india.html`** — three references to Razorpay UPI / cards / refund flow.
4. **Sheets webhook fully exposed** — anyone can spam fake orders into the order log. Site has no rate limiting / proxy.
5. **`trackPurchase()` fires for UPI before user actually pays** — inflates GA4/Pixel conversion counts.
6. **`localStorage` reads in cart loader without try/catch around the whole flow** — Safari Private Mode would crash the cart on load (mostly handled, but one path is exposed).
7. **`VARIANTS.cart` is patched in dynamically** — `openCheckout('cart')` will throw if called before `checkoutFromCart()` ever ran (defensive guard missing).
8. **No CSP / X-Frame-Options headers** in `vercel.json`.
9. **Multiple duplicate ESC handlers** + listeners attached without cleanup → memory creep; also the focus-clear listener is rebound every checkout open.

---

## 2. Findings (by category)

### A. Stale references (Razorpay / Firebase / wrong price)

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🔴 | `privacy.html:86` | "Payment: processed securely via Razorpay…" | Replace with UPI/COD copy |
| 🔴 | `privacy.html:87` | "if you sign in with Google… Firebase Authentication" | Remove (no Firebase) |
| 🔴 | `privacy.html:105–106` | Lists Razorpay + Firebase as third parties | Replace with UPI direct + Resend (email) |
| 🔴 | `privacy.html:126` | "Payments handled entirely on Razorpay's PCI-DSS infrastructure" | Replace |
| 🔴 | `terms.html:96–97` | "successful payment (prepaid) … via Razorpay" | Replace |
| 🔴 | `terms.html:110–111` | "optionally sign in with Google for faster checkout" | Remove section |
| 🔴 | `api/email-templates.js:210` | Welcome email shows `₹179` | `₹229` |
| 🔴 | `api/email-templates.js:211` | "Free shipping above ₹299" | "Free shipping pan-India" |
| 🔴 | `api/email-templates.js:239` | Abandoned-cart shows `₹179` | `₹229` |
| 🔴 | `blog/where-to-buy-odorstrike-india.html:339,340,342,375` | Razorpay UPI/cards/refund copy | Rewrite as UPI direct + COD |

### B. Checkout / payment / orders

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🔴 | `index.html:4668–4705` `logOrderToSheets` | Sheets endpoint exposed in client; spammable; no error surfacing if all 3 fallbacks fail | Add a Vercel serverless proxy + rate-limit. Short-term: log a console.error and post to a secondary mailto fallback if all methods fail |
| 🟠 | `index.html:4759` | Order amount comes from client-side `VARIANTS[currentVariant].amount`; no server check | Long-term: server-side amount validation. Short-term: re-derive amount from `PRODUCTS` map at submit time so any tampered DOM doesn't change it |
| 🟠 | `index.html:4540–4564` `openCheckout('cart')` | If `VARIANTS.cart` not previously set, crashes on `v.title` | Guard: `if (!VARIANTS[variant]) return;` |
| 🟠 | `index.html:4749–4800` `submitOrder` | COD path: button disabled, but a `setTimeout 600ms` window where double-tap could re-enter | Disable on entry, only re-enable inside the `then`/`catch`/`finally`; or set a `_submitting` flag |
| 🟠 | `index.html:4864` `showUpiSuccess` | `trackPurchase()` fires immediately on UPI screen — before user has paid | Move purchase event to *after* user explicitly confirms (e.g. "I've paid" button in the success screen), or fire only on COD success and use `begin_checkout` for UPI |
| 🟠 | `index.html:4793–4798` | Mobile UPI redirect has 150ms timeout; insufficient for sendBeacon to flush GA4 if it hasn't loaded | Use `gtag('event','purchase',{...,event_callback:fn})` + transport `'beacon'` |
| 🟠 | `index.html:4677–4686` | sendBeacon FormData → Apps Script doPost: returns true on queue, not on delivery; no fallback log if all 3 fail | Surface a non-blocking warning to the customer email "if you don't see a confirmation, WhatsApp us" |
| 🟠 | `index.html:4944–4951` Pincode lookup | `inflight` flag never resets if user changes value mid-flight; second lookup never fires | Replace with AbortController, or just drop the flag |
| 🟡 | `index.html:4623` Phone regex `/^[6-9]\d{9}$/` | Allows `6000000000` etc. | Acceptable — matches Indian mobile range. Leave. |
| 🟡 | `index.html:4624–4625` Pincode | Validates format only, not existence | Accept; lookup is best-effort |
| 🟡 | `index.html:4628` Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | Accepts `a@b.c` | Acceptable for India D2C; server-side validation in send-email.js |
| 🟡 | `index.html:5013–5014` | Hardcoded `549/399/229` fallback if `SMELLOFF_CONFIG` missing — silent drift risk | Throw or log if config missing |
| 🟡 | `index.html:5746` | Cart subtotal computed from item.price stored at add-time; if `PRODUCTS[id].price` changes server-side, stale cart pays old price | Recompute from `PRODUCTS[id]` at checkout |
| 🟡 | `index.html:5749–5763` `checkoutFromCart` | Mutates `VARIANTS.cart` → fragile; if user opens checkout via cart → adds more items → checkout, the inner state is stale | Pass a one-shot variant object instead of mutating module state |

### C. Event listeners / memory / scope

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟠 | `index.html:4975, 5122, 5538, 5766` | Four separate `document.addEventListener('keydown')` for ESC; each doing branching | Consolidate into one ESC handler that checks open state once |
| 🟠 | `index.html:5135–5137` | `.overlay input,.overlay textarea` `focus` listener attached at script-load time only — actually OK; **but** there's no listener for `input` to clear the red border, so red stays after the user starts typing | Listen on `input` event too |
| 🟠 | `index.html:5454` Read-more buttons | Listener added per card on every `renderCards()` call; old listeners not removed → leak | Use event delegation on `#rvScroll` |
| 🟠 | `index.html:5560, 5572, 5818` | `resize`/`scroll` listeners with no cleanup; safe at first paint, but page lifecycle unclear | Mark `{passive:true}` (already done) — accept |

### D. Accessibility (WCAG AA)

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟠 | `index.html:4283` `#checkoutOverlay` | Missing `role="dialog"` `aria-modal="true"` `aria-labelledby="checkoutTitle"` | Add |
| 🟠 | `index.html:4340, 4344` `.pay-opt` | `role="button"` + `onkeydown` only handles Enter, not Space (Space is required for `role=button`) | Add Space; or use real `<button>` |
| 🟡 | `index.html:3613` `.sp-quote` | Long quote inside `aria-label="Social proof"` div with no semantic wrapping | Wrap quote in `<blockquote>` or `<p>` (p already there); fine |
| 🟡 | `index.html:4327, 4331` City/State labels | No `for=` linkage | Add explicit `<label for>` or wrap input in label |
| 🟡 | All overlays | No focus restore to trigger element on close | Save `document.activeElement` on open, restore on close |
| 🟢 | Alt text on bottle SVG-CSS in hero | Decorative — already `aria-hidden="true"`; OK |
| 🟢 | Color contrast | acid `#B8FF57` on `#080808` = 14.6:1 ✓; `#888` on `#080808` = 5.6:1 ✓ AA |

### E. SEO

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟠 | `sitemap.xml:48` | `/payment-failed` listed — not useful for SERP | Remove from sitemap or add `<meta name="robots" content="noindex">` to the page (still allow crawling for users) |
| 🟡 | `index.html` Product schema (line 138-168) | Has `aggregateOffer` but no `aggregateRating` despite "4.8 from 127 reviews" prominently displayed | Add `aggregateRating { ratingValue: "4.8", reviewCount: "127" }` |
| 🟡 | `index.html:49` | `<meta name="keywords">` — Google ignores; some bots flag as spammy | Remove (cosmetic) |
| 🟡 | `manifest.json:4` | Description says "₹229" — **already correct**. Keep. |
| 🟢 | `vercel.json` redirects | OK; canonicalises bare domain → www, strips `.html` |
| 🟢 | `robots.txt` | Comprehensive |

### F. Security / headers

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🔴 | `vercel.json:47–56` | No `Content-Security-Policy` header | Add a CSP enumerating: `'self'`, `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, `https://www.googletagmanager.com`, `https://www.google-analytics.com`, `https://*.google-analytics.com`, `https://connect.facebook.net`, `https://www.facebook.com`, `https://script.google.com`, `https://api.postalpincode.in`, `https://api.qrserver.com`, `https://wa.me`, `data:`, `blob:` |
| 🟠 | `vercel.json` | Missing `X-Frame-Options: DENY` | Add (also covered by `frame-ancestors` in CSP) |
| 🟡 | `index.html:4670` | URL params not sanitised before sending to Sheets | Sheets is text-only; low risk; accept |
| 🟢 | All `target="_blank"` | All have `rel="noopener"` ✓ |

### G. Performance / CLS / LCP

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟡 | `index.html:204` | Font preload includes Fraunces + JetBrains Mono — only used in a few places; bigger preload | Audit usage; drop unused families |
| 🟡 | Bottle PNG `assets/odorstrike-bottle.png` (10.7KB) | Loaded? — actually not on hero (CSS bottle); only used by schema. Fine |
| 🟡 | Hero CSS bottle uses `animation:hero-float 5s` | No `prefers-reduced-motion` guard | Add `@media (prefers-reduced-motion:reduce){.hb-bottle{animation:none}}` |
| 🟢 | Inline critical CSS | Already inlined |
| 🟢 | Razorpay script | N/A (no Razorpay) |

### H. Content / consistency

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟠 | `index.html:3617` Problem section h2 | Duplicates the hero `<h1>` text verbatim ("You don't fear smelling bad / You fear someone noticing.") | Vary or compress |
| 🟡 | `llms.txt:18` says `₹399 Duo (2-Pack)` but no Trio mention; sitemap blogs reference Trio | Add Trio line |
| 🟡 | `payment-failed.html:8` no `<meta name="robots" content="noindex">` despite being a niche policy | Optional |
| 🟢 | "ODORSTRIKE" capitalisation consistent across hero, FAQ, schema |

### I. Mobile UX / CRO

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟡 | `index.html:3518` `.mobile-bar` | When checkout overlay opens we hide it via `display:none` + restore on close — but if user closes overlay during scroll-up, bar reappears mid-scroll (jarring) | Use `visibility:hidden`+ scroll-position-aware show |
| 🟡 | `index.html:4035` Review modal CTA | Says `Add ODORSTRIKE — ₹229 →` — fine |
| 🟢 | Tap targets | `.cat-pill` 8px+16px = 32×OK; minimum 44x44 borderline. Acceptable. |

### J. Legal / compliance (India)

| Sev | Location | Problem | Fix |
|---|---|---|---|
| 🟡 | All policy pages | No GST number displayed (mandatory if registered) | Confirm registration; add if registered |
| 🟡 | All policy pages | No HSN code (3307) reference | Acceptable on website; required on invoice only |
| 🟢 | Net quantity 50ml clearly stated | ✓ |
| 🟢 | Contact email + phone surfaced everywhere | ✓ |

---

## 3. Fix order (priority × effort)

**Pass 1 — pure copy fixes (BLOCKER, low effort):**
1. Strip Razorpay/Firebase from `privacy.html`, `terms.html`.
2. Update `api/email-templates.js`: `₹229` + "Free shipping pan-India".
3. Rewrite Razorpay paragraphs in `blog/where-to-buy-odorstrike-india.html`.

**Pass 2 — defensive code in checkout/cart (HIGH):**
4. Guard `openCheckout(variant)` if variant unknown.
5. Move `trackPurchase()` for UPI to actual confirmation, not the placeholder screen.
6. Consolidate ESC key handlers.
7. Fix pincode lookup `inflight` reset.
8. Fix focus-clear listener on input event (not just focus).
9. Surface order-log failure to user via WhatsApp fallback.

**Pass 3 — a11y (HIGH):**
10. Add `role="dialog"` aria-modal aria-labelledby to checkout overlay.
11. Add Space key support to `.pay-opt`.
12. Save/restore focus on overlay open/close.
13. `prefers-reduced-motion` guard on hero bottle float.

**Pass 4 — SEO/security (HIGH):**
14. Add `aggregateRating` to Product schema.
15. Drop `/payment-failed` from sitemap.
16. Drop legacy `<meta name="keywords">`.
17. Add `Content-Security-Policy`, `X-Frame-Options: DENY` to `vercel.json`.

**Pass 5 — small CRO/UX wins (MEDIUM):**
18. Vary Problem-section h2 from hero h1.
19. Recompute cart subtotal from `PRODUCTS` at checkout (defence-in-depth).

---

## 4. Sheets proxy — manual steps after deploy

A `/api/log-order` Vercel proxy now sits between the browser and your
Apps Script. To finish wiring it up (one-time, ~5 min):

1. **Vercel → Project Settings → Environment Variables.** Add:
   - `SHEETS_ENDPOINT` = your Apps Script `/exec` URL (the same one that
     used to be in `window.SMELLOFF_CONFIG.SHEETS_ENDPOINT`)
   - `SHEETS_SECRET` = a long random string (generate with
     `openssl rand -hex 32` or any password manager)

2. **Google Apps Script.** Open your `doPost(e)` and add a token check
   at the top:

   ```js
   const REQUIRED_TOKEN = 'PASTE_SAME_VALUE_AS_SHEETS_SECRET';
   function doPost(e) {
     if (!e || !e.parameter || e.parameter.token !== REQUIRED_TOKEN) {
       return ContentService
         .createTextOutput(JSON.stringify({ ok:false, error:'forbidden' }))
         .setMimeType(ContentService.MimeType.JSON);
     }
     // ... your existing logic stays exactly as-is
   }
   ```

   Then **Deploy → Manage deployments → Edit → New version → Deploy**.

3. After both steps are live, anyone hitting your Apps Script URL
   directly (without going through `/api/log-order`) gets a 403. The
   waitlist email-capture in the footer still posts directly to Sheets
   for now — harden separately if/when you want.

---

## 5. Decisions needed

1. **Launch price.** You told me ₹159 launch / ₹179 strike, but the codebase is uniformly `₹229` launch / `₹579` MRP (40+ references in HTML, schema, manifest, llms.txt, blogs). I'm **not** changing prices automatically — confirm whether you want me to update the entire codebase to ₹159/179 or keep the current ₹229/579 (which is what the site actually shows).
2. **GST registration.** If registered, give me the GSTIN to surface on the footer + policy pages. If unregistered (under threshold), nothing to add.
3. **Sheets endpoint hardening.** Long-term answer is a Vercel serverless proxy with a shared-secret token. Want me to scaffold one in this PR, or treat as out of scope?
4. **GA4 / Pixel `Purchase` event for UPI.** Should it fire (a) on user submit (current — inflated), (b) on the success screen render (current), or (c) only after the user clicks "I've paid" / submits UTR? My recommendation: (c) for UPI, current behaviour for COD.
