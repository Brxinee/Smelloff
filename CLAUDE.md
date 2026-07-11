# Smelloff — Claude Code Context

## What this project is
Smelloff is a D2C e-commerce site selling **ODORSTRIKE** — India's first pocket-sized fabric odor remover spray (50ml, ₹229). Built as a static/SSR site deployed on Vercel. Single product, direct-to-consumer, COD-enabled, ships pan-India from Hyderabad.

## Stack
- Static HTML + vanilla JS (no framework)
- Vercel deployment
- Supabase (orders/data)
- Google Sheets webhook (order backup)
- GA4 + Meta Pixel (consent-gated)
- Resend transactional email via `/api/send-email`
- Self-hosted fonts (Fraunces + JetBrains Mono + Inter Tight + Barlow Condensed)

## Design restoration (2026-07-10)
The homepage was restored to the original iconic design (dark #080808, Fraunces
serif display, acid-green #B8FF57 highlights, JetBrains Mono labels) from the
April 2026 codebase, paired with current-correct data:
- **₹229 solo (50ml) is the ONLY SKU. No duo/trio/bundles anywhere.** `/odorstrike` redirects to `/#buy`.
- Claim: "up to 8 hours odor protection on fabric". Glycerine-free, zero residue.
- 4-layer mechanism: TRAP HPβCD · NEUTRALIZE Zinc PCA · PREVENT Triethyl Citrate · ANTI-REGROWTH Zinc Gluconate (Formula v3.1).
- NEVER list Zinc Ricinoleate, Sodium Bicarbonate, or Glycerine as ingredients.
- **NEVER publish formula percentages/concentrations anywhere** (site, schema, llms.txt, blog). Ingredient NAMES are public; exact amounts are a trade secret. Say "exact concentrations are proprietary" if asked.
- `index.html` is fully self-contained (single-file CSS/JS incl. checkout: UPI + COD + Supabase mirror + Sheets logging + Resend email + consent-gated analytics). It does NOT use `/assets/js/app.js` or `/assets/css/neo.css` — other pages (faq, reviews) still do.
- Canonical domain is `https://smelloff.in` (non-www; www redirects).

## Site structure
- `/` — homepage (product hero, buy section, FAQ, reviews)
- `/blog` — blog index (50+ posts)
- `/blog/[slug]` — individual blog posts
- `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms` — policy pages
- `/llms.txt`, `/llms-full.txt` — AI/LLM context files
- `/sitemap.xml`, `/robots.txt`, `/manifest.json`
- `/admin` — private admin dashboard ("Mission Control"), served at `admin.smelloff.in` (noindex, password-gated). Single self-contained SPA `admin/index.html` + one serverless function `api/admin.js` (session login, Supabase service-role CRUD over orders/reviews/messages/waitlist/blog_comments, computed business stats, first-party analytics reports, optional GA4 Data API proxy). Order status pipeline: placed→confirmed→packed→dispatched→out_for_delivery→delivered (+upi_pending, cancelled); admin has one-tap "advance" buttons and the customer `track-order.html` timeline mirrors it. Setup + env vars in `ADMIN-SETUP.md`. Secrets (`ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GA4_*`) live only in Vercel env — never in the client. Reuses brand fonts/colors; charts follow the validated dark-mode dataviz palette.
- **First-party analytics** — cookieless, no-Google web analytics. `api/track.js` receives a beacon from every page (added inline to index/faq/odorstrike, via `assets/js/consent-analytics.js` everywhere else) and stores an anonymised row in `page_views` (daily-rotating visitor hash from IP+UA+salt; no cookie, no PII). Aggregated by the `site_analytics()`/`site_realtime()` RPCs (service-role only) and shown in the admin Analytics tab. Runs regardless of the GA/Pixel consent choice because it stores nothing on the device and no personal data. Migration: `supabase/migrations/20260711_first_party_analytics.sql`.

## SEO audit status (originally 77/100 — all 9 code-fixable issues resolved as of 2026-06-10)
1. ~~www vs non-www canonical conflict~~ — **FIXED**: everything (canonicals, sitemap, JSON-LD, robots.txt Sitemap directive, llms.txt) uses `https://www.smelloff.in`
2. ~~Future-dated sitemap entries~~ — **FIXED**: all lastmod dates are valid past dates
3. ~~Blog posts have zero images~~ — **FIXED**: all posts have WebP hero images (1200×630) + og:image
4. ~~Article schema missing author~~ — **FIXED**: all posts share one rich `Person` entity (Jogdhande Nikhil Patil, Founder, worksFor Smelloff, url → founder story post)
5. **Only 3 product reviews** — needs real customers, not code; how-to-add instructions are in an HTML comment above the Product schema in index.html
6. ~~Blog not in site navigation~~ — **FIXED**: /blog linked from homepage ("All Guides" + deep links)
7. ~~No contextual internal links~~ — **FIXED**: posts cross-link contextually
8. ~~Blog index missing ItemList schema~~ — **FIXED**
9. ~~Homepage HTML was 302KB~~ — **FIXED**: main app JS (62.8KB) + scroll effects (8.5KB) externalized to `/assets/js/app.js` and `/assets/js/scroll-effects.js` (deferred); HTML now ~224KB. Consent-critical scripts (config, analytics loader, consent bar) intentionally remain inline — do not externalize them.

## What's working well (don't break)
- Excellent robots.txt with all AI bots allowed
- llms.txt + llms-full.txt are comprehensive
- Homepage has 8 JSON-LD schema blocks (Product, FAQPage, HowTo, Speakable, etc.)
- Security headers all set correctly on www
- Self-hosted fonts with preload
- Lazy loading on all images
- Consent-gated analytics
