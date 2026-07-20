# SEO / AEO / GEO Audit — smelloff.in
**Date:** 2026-06-12 · **Auditor:** Claude Code · **Scope:** all 62 HTML routes, sitemap, robots, vercel.json, structured data, internal links, AEO/GEO readiness

> **Stack note:** the task brief described a Next.js 14 App Router project. The actual repo is a static HTML + vanilla JS site deployed on Vercel (per CLAUDE.md). All Next.js-specific asks (generateMetadata, sitemap.ts, robots.ts, next/image) were implemented as their static-site equivalents: per-page `<meta>`/`<link>` tags, static `sitemap.xml`/`robots.txt`, and hand-tuned `<img>` attributes. There is no `npm run build` step (no build script in package.json) — validation was done via HTML/JSON-LD/sitemap integrity checks instead.

---

## Scorecard

| Area | Status before | Status after |
|---|---|---|
| Titles / descriptions / H1 uniqueness | ✅ Zero duplicates across all 62 pages | unchanged |
| Canonicals | ✅ All pages, all `https://www.smelloff.in`, self-referencing | unchanged |
| robots.txt | ✅ All AI bots allowed, sitemap declared | unchanged |
| Sitemap accuracy | ⚠️ 1 utility page listed, fine otherwise | ✅ fixed |
| Indexability | ⚠️ `/payment-failed` indexable | ✅ noindexed |
| Redirect chains | ⚠️ 2 two-hop chains in vercel.json | ✅ fixed |
| Internal links | ⚠️ 7 links pointing at 301'd URLs | ✅ fixed |
| Structured data | ✅ strong; ⚠️ 4 priority posts missing FAQPage | ✅ added |
| AEO direct answers | ✅ ~90% of posts open with a direct answer | unchanged |
| GEO (llms.txt, entity clarity) | ✅ excellent (see below) | unchanged |
| Images | ✅ dims + lazy + WebP everywhere; PNG kept for og:image (WhatsApp compat) | unchanged |
| Performance (static analysis) | ✅ fonts preloaded + swap, JS deferred, no head scripts | unchanged |

---

## Issues found and fixed in this pass

### 1. `/payment-failed` was indexable and in the sitemap — FIXED
- **Before:** `payment-failed.html` carried `robots: index,follow…`, sat in `sitemap.xml` (priority 0.3), and the global `X-Robots-Tag: index, follow` header applied to it. A thin checkout-utility page competing for crawl budget and potentially surfacing in SERPs for brand queries.
- **After:** meta robots set to `noindex,follow`, removed from `sitemap.xml`, and a dedicated `X-Robots-Tag: noindex, follow` header rule added in `vercel.json` (placed after the catch-all so it wins).

### 2. Two redirect chains in `vercel.json` — FIXED
- **Before:** with `trailingSlash: false`, two redirect destinations ended in `/`, forcing a second hop:
  - `/blog/best-fabric-odor-spray-india-2026` → `/blog/best-fabric-odor-spray-india-2026-body-odor/` → (slash strip) → final
  - `/blog/index` → `/blog/` → `/blog`
- **After:** both destinations rewritten without trailing slash. Single 301 hop each.

### 3. Internal links pointing at redirected URLs — FIXED
- **Before:** `/blog/best-fabric-odor-spray-india-2026` and `/blog/where-to-buy-odorstrike-india` are 301'd away in vercel.json (the .html files still exist but are unreachable — Vercel redirects take precedence). Yet:
  - `blog/index.html` showed cards for both dead URLs and listed both in its ItemList schema (positions 28–29)
  - `blog/does-febreze-work-on-sweat-smell-clothes.html` had 3 links to the old buyer's-guide URL
  - `blog/what-is-fabric-odor-eliminator.html` had 2 links to it
- **After:** blog-index cards + ItemList entries for the two retired URLs removed (the `-body-odor` successor already holds position 1); the 5 in-post links repointed to `/blog/best-fabric-odor-spray-india-2026-body-odor`. Link equity now flows without a 301 hop, and no anchor lands on the homepage unannounced.
- **Note:** the two orphaned `.html` files were left in the repo (unreachable in production, zero SEO effect). Delete them whenever convenient.

### 4. Four priority posts had no FAQPage schema / FAQ blocks — FIXED
The four target queries from the brief, mapped to their ranking pages:

| Target query | Page | Before | After |
|---|---|---|---|
| how to remove smell from clothes without washing | `/blog/remove-sweat-smell-shirts-without-washing` | HTML FAQ existed, **no schema** | FAQPage JSON-LD added covering all 5 Q&As (1 new lead Q answering the query verbatim) |
| why do clothes smell after washing | `/blog/clothes-smell-after-washing` | no FAQ at all | HTML FAQ block (3 Q&As) + FAQPage schema |
| fabric odor spray vs deodorant | `/blog/deodorant-vs-fabric-mist` | no FAQ at all | HTML FAQ block (3 Q&As) + FAQPage schema |
| best odor remover for gym clothes india | `/blog/gym-clothes-smell-after-washing` | no FAQ at all | HTML FAQ block (3 Q&As) + FAQPage schema |

All FAQ answers open with the direct answer in sentence one (AEO extraction pattern), reuse the existing `details.faq-item` component, and keep the locked brand voice.

### 5. Three posts missing the robots meta tag — FIXED
`best-fabric-odor-spray-india-2026-body-odor`, `is-zinc-ricinoleate-safe-for-clothes`, `odorstrike-vs-febreze-india` had no `<meta name="robots">` (default is index anyway, but every other page declares it — inconsistency removed).

### 6. 404 page had no H1 — FIXED
`404.html` "Page not found" label converted from `<div class="nf-label">` to `<h1 class="nf-label">` (class carries all typography, zero visual change). Page already correctly `noindex,follow`.

---

## Audited and healthy (no action taken)

- **Canonical discipline:** every page self-canonicals to `https://www.smelloff.in/...`; vercel.json strips `.html`, `cleanUrls` on, host consolidation done.
- **Sitemap:** 60 URLs, all real, no future lastmod dates, correct content-type header.
- **Titles/descs/H1s:** zero duplicates. ~12 titles run 70–83 chars and ~20 descriptions run 165–194 chars — display-truncation only, not a ranking problem. Mass-rewriting titles on pages with 220 tracked keywords risks rank volatility, so these go to the backlog as individual content decisions, not a blanket code fix.
- **Product schema (homepage + /odorstrike):** already exactly what the brief asked for — `AggregateOffer` with all 3 tiers (₹229 low / ₹549 high, offerCount 3), brand, shipping details, return policy, and an `aggregateRating` (4.7, count 3) backed by 3 **real** marked-up reviews. Nothing invented; nothing changed.
- **Schema coverage elsewhere:** Organization + WebSite + Speakable + Product + FAQPage + HowTo on homepage; Article + BreadcrumbList on all 50 posts (all sharing one rich `Person` author entity); Blog + ItemList on /blog; AboutPage / ContactPage on those pages. 19 posts already carried FAQPage; 9 carry Speakable.
- **WebSite SearchAction:** intentionally **not** added. The site has no search results page (single-product site), and Google retired the sitelinks-searchbox feature in late 2024. Schema pointing at a nonexistent endpoint would be a lie detectable by validators.
- **AEO:** ~45 of 50 posts open with a direct answer to the title query within the first two sentences (spot-checked all 50 openings). The handful of narrative openers (`bike-rider`, `office-ac-trap`, `why-i-built-odorstrike`) are deliberate story posts — listed in backlog, not force-rewritten.
- **GEO:** `llms.txt` and `llms-full.txt` are genuinely strong — fact-dense, quotable, prices/sizes/ingredients with percentages, explicit "NOT a perfume, NOT a deodorant, fabric-only" disambiguation, comparison sections (vs Febreze / deodorant / perfume / re-washing), correct content-type + `X-Robots-Tag: index` headers. `/about` page exists with AboutPage schema. Entity clarity is unambiguous across Product schema, llms.txt, and on-page copy.
- **Performance (static analysis; no headless Chrome available in this environment — Lighthouse runs go to backlog):**
  - No render-blocking scripts in `<head>`; app JS (62.8KB) + scroll effects externalized and deferred
  - Both critical fonts preloaded as woff2, fonts.css loaded async with preload-swap pattern, `font-display: swap` in fonts.css
  - Every `<img>` on key pages has explicit `width`/`height` (CLS-safe), `loading="lazy"` below the fold, hero images `fetchpriority="high"` + eager (correct LCP treatment)
  - WebP on-page + PNG for og:image — correct split (WhatsApp/older scrapers mishandle WebP og images); immutable cache headers on all static assets
- **Internal link flow:** all 50 posts link to product/homepage with descriptive anchors in body copy; `/odorstrike` links out to 5 posts (brief asked for 3); no broken internal links; no orphan pages (after fix #3).
- **Security/headers:** full set (CSP, HSTS preload, X-Frame-Options, etc.) — untouched, as instructed.

## Known cosmetic non-issues (documented, deliberately not mass-edited)

- **h2→h4 jumps** inside ~48 posts: the `<h4>` is the product-name element in comparison cards (in-content component). Accessibility-cosmetic; fixing means touching every post template for zero ranking effect. Backlogged.
- `/blog/fix-shirt-odor-before-meeting` and `/blog/gym-to-office-without-showering` carry HowTo (+ Breadcrumb) but no Article schema. HowTo rich results were retired by Google in 2023 but the markup still feeds GEO; adding a parallel Article block is a nice-to-have. Backlogged.
