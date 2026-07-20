# Claude Code Prompt — Smelloff.in Full Website Redesign (Landing Page → Real Store)

Paste everything below this line into Claude Code.

---

## Context

You are working on **smelloff.in** — a D2C site selling ODORSTRIKE, India's first pocket-sized fabric odor remover spray (50ml, ₹229, COD + UPI, ships from Hyderabad). Static HTML + vanilla JS on Vercel, Supabase backend, no build step — changes go live on push.

**Read `CLAUDE.md` first**, then read any file fully before editing it.

**Goal:** evolve the site from a single long landing page into a real multi-page e-commerce website with a modern D2C design, without damaging the SEO and CRO work already done.

## Hard constraints — DO NOT touch or break

1. **Blog** (`/blog/*`) — do not edit any blog post or the blog index.
2. **Policy pages** — `/privacy`, `/terms`, `/returns`, `/refund`, `/shipping`, `/payment-failed`: content stays as-is.
3. **SEO assets** — all 8 JSON-LD blocks in `index.html`, canonicals (`https://www.smelloff.in`), `sitemap.xml` validity, `robots.txt`, `llms.txt`/`llms-full.txt`.
4. **Consent-gated analytics** — the inline config/analytics-loader/consent-bar scripts in `index.html` must stay inline and functional (GA4 + Meta Pixel load only after consent).
5. **Checkout flow** — the cart drawer, checkout overlay, UPI/COD logic in `assets/js/app.js`, the Google Sheets webhook, and the `create-order` Supabase mirror must keep working. Test mentally end-to-end after every change.
6. **Self-hosted fonts** (Barlow Condensed 900 + Inter Tight) with preload; never add third-party font/script origins (CSP in `vercel.json` is strict).
7. When you edit `main.css` or `app.js`, bump their `?v=` query in `index.html` **and** in `sw.js` (PRECACHE + VERSION).

## Already done (build on it, don't redo)

- **Supabase backend (deployed on project `tnuqjydmoxczdjnsgpci`):**
  - `orders.order_code` column stores the customer-facing ID (`SMF-YYYYMMDD-XXXX`); email now optional; every order mirrors to Supabase (phone-gated, not email-gated).
  - `contact_messages` table (RLS: anon insert-only).
  - Edge functions: `create-order` (accepts `order_code`), `track-order` (order code + phone → sanitized status/tracking), `cancel-order`.
  - Local copies in `supabase/functions/` and `supabase/migrations/`.
- **Pages:** `/track-order` (live status timeline), `/contact` (form → `contact_messages`), `/reviews` (all reviews from Supabase). All follow the dark/acid-green `.p-nav` subpage pattern from `about.html`.
- **Homepage:** desktop nav links (Shop · Science · Reviews · Track Order · Blog · Contact, ≥980px), track-order links in pills/menu/footer/success-screen.

## Design direction (from competitor research: Liquid Death, Magic Spoon, Frank Body, Febreze, mCaffeine, Beardo, Bombay Shaving Co, Bold Care, Man Matters, Koparo)

Keep the existing brand system — near-black `#080808`, acid green `#B8FF57`, huge all-caps Barlow Condensed headlines, Inter Tight body. The structure (problem → triggers → reviews → buy → compare → science → FAQ) already matches best practice; the gaps are **visual boldness, trust density, and site structure**, not section order. Voice: irreverent, Liquid-Death-adjacent, India-specific ("smell like you didn't take the 5:40 local").

## Tasks (in order)

### 1. Announcement bar
Thin bar above the nav: rotating messages — "FREE SHIPPING PAN-INDIA · COD AVAILABLE · SHIPS IN 48 HRS FROM HYDERABAD". Pure CSS animation, no new JS files. Must not break the fixed nav offset or the skip-link.

### 2. Trust-chip strip under hero
Koparo-style iconified chips immediately after the hero: ✓ COD Available · ✓ UPI Accepted · ✓ Ships pan-India 3–5 days · ✓ Made in India · ✓ 7-day refund. Reuse existing icon assets in `/assets/`.

### 3. Homepage visual polish pass (section by section, smallest diff that modernizes)
- Bento-grid treatment for the "Trigger Points" cards (varied card sizes, one featured).
- Product card (`#buy`): add a real photo gallery slot (the `#pcGallery` element exists, hidden) — wire it to show `/assets/odorstrike-bottle.png` plus any new product shots dropped into `/assets/`, with the CSS-drawn bottle as fallback.
- Reviews: card style with name + city + use-case chip (data already has city).
- Micro-interactions only where they confirm an action (add-to-cart bounce already exists; keep the static-site speed).

### 4. Make the success → track-order loop airtight
After checkout, the success screen links to `/track-order?code=SMF-…` (done). Add the same link to the order-confirmation email template in `emails/` and the WhatsApp order message strings in `app.js`.

### 5. Positive prepaid nudge (checkout)
In the payment toggle, frame UPI as "ships first" (e.g. "UPI orders skip the confirmation call and dispatch first") — never penalize COD. Copy change only; no pricing logic changes.

### 6. Navigation & footer coherence across ALL pages
Every non-blog page (`about`, `track-order`, `contact`, `reviews`, policy pages) uses the same `.p-nav` header (← Home / logo / Buy ₹229) and a footer with: Home · Track Order · Contact · Shipping · Returns · Privacy. Policy pages: only touch their nav/footer markup if they deviate — never the policy text.

### 7. SEO hygiene for anything you add
- New/changed pages: canonical, meta description, OG/Twitter tags, one JSON-LD block with BreadcrumbList, entry in `sitemap.xml` with a real past-dated `lastmod`.
- Keep homepage HTML lean: new JS goes into the existing external files, not inline (except consent-critical scripts).

### 8. Verify before pushing
- `grep` that no `https://smelloff.in` (non-www) URLs were introduced.
- Every `onclick` handler name used in new HTML exists in `app.js` or the page's own script (the click-queue stub list in `index.html` head must include any new global handlers).
- Open each changed page's HTML and check: no unclosed tags, CSP-safe (no external origins beyond the allowed list), fonts preloaded.
- Bump `?v=` versions + `sw.js` VERSION if `main.css`/`app.js` changed.

## What NOT to do

- No frameworks, no build step, no npm.
- No new third-party scripts (chat widgets, review widgets, sliders).
- No fake review counts, fake scarcity, or fabricated press logos — the site's honesty is a deliberate trust strategy.
- Don't reorder the homepage's major sections — the current order is CRO-tested.
- Don't externalize the inline config/consent/analytics scripts.

## Commit & ship

Work on a feature branch, commit in logical chunks with clear messages, push, and open a draft PR describing: what changed visually, what changed in the backend, and a manual test checklist (place a test COD order → see it in Supabase `orders` with `order_code` → track it on `/track-order`).
