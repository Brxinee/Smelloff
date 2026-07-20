# SEO Audit Report — smelloff.in

**Date:** 2026-05-01
**Branch:** `claude/seo-audit-smelloff-2xs2K`
**Scope:** keyword cannibalization + intent-conflict cleanup across the homepage, blog hub, 30 blog posts, and 6 policy pages.

Source artifacts:
- `seo-audit/url-map.json` — every indexable URL with primary keyword + intent.
- `seo-audit/conflicts.md` — full reasoning per conflict.

---

## 1. URL × Keyword × Action table

| URL | Primary keyword | Intent | Conflict with | Action taken | Priority |
|---|---|---|---|---|---|
| `/` | fabric odor remover spray (ODORSTRIKE buy) | transactional | `/blog/where-to-buy-odorstrike-india` | Receives 308 from where-to-buy; footer anchors cleaned | **P0** |
| `/blog` | smelloff blog (hub) | informational | — | Anchor text cleaned; redirected URLs removed from grid + marquee + footer | P1 |
| `/blog/best-fabric-odor-spray-india-2026` | best fabric odor spray india 2026 | commercial | `/blog/best-fabric-odor-spray-india-2026-body-odor` | **308 → body-odor variant** (consolidate) | **P0** |
| `/blog/best-fabric-odor-spray-india-2026-body-odor` | best fabric odor spray india 2026 (body odor) | commercial | (winner) | None — receives consolidated equity | — |
| `/blog/where-to-buy-odorstrike-india` | where to buy odorstrike india | transactional | `/` | **308 → homepage** (consolidate) | **P0** |
| `/blog/best-body-odor-remover-spray-for-men-india` | indian men body odor causes / 4-factor biology | informational | `/blog/best-fabric-odor-spray-india-2026-body-odor` | **Differentiated**: rewrote title/H1/meta/lead/JSON-LD to men's biology angle, away from product ranking | **P1** |
| `/blog/best-deodorant-spray-for-clothes-not-skin` | deodorant spray for clothes (5-product comparison) | commercial | `/blog/alternative-to-deodorant-for-clothes-smell` | **Differentiated**: rewrote title/H1/meta/lead/JSON-LD to be a side-by-side product spec-sheet | **P1** |
| `/blog/gym-clothes-smell-after-washing` | polyester gym clothes smell / Dri-Fit | informational | `/blog/clothes-smell-after-washing` | **Differentiated**: rewrote title/H1/meta/lead/JSON-LD to lock onto synthetic-fabric science | **P1** |
| `/blog/alternative-to-deodorant-for-clothes-smell` | alternative to deodorant for clothes smell | informational | (winner over `best-deodorant-spray-for-clothes-not-skin`) | None | — |
| `/blog/clothes-smell-after-washing` | clothes smell after washing | informational | (winner over `gym-clothes-smell-after-washing`) | None | — |
| `/blog/odorstrike-review-30-day-india-test` | odorstrike review | commercial | (kept distinct — review format) | None | — |
| `/blog/odorstrike-vs-febreze-india` | odorstrike vs febreze | commercial | (kept distinct — comparison format) | None | — |
| `/blog/deodorant-vs-fabric-mist` | deodorant vs fabric mist | informational | (overlap with deodorant cluster — kept; angle is "comparison") | None | — |
| `/blog/why-deodorant-stops-working-after-3-hours` | why deodorant stops working after 3 hours | informational | (overlap with deodorant cluster — kept; angle is "timing") | None | — |
| `/blog/spray-to-remove-sweat-smell-from-clothes-instantly` | spray to remove sweat smell from clothes instantly | commercial | (overlap with `remove-sweat-smell-shirts-without-washing` — kept; angle is "5-spray test") | None | — |
| `/blog/remove-sweat-smell-shirts-without-washing` | remove sweat smell from shirts without washing | informational | (overlap with above — kept; angle is "no-wash methods") | None | — |
| `/blog/bike-rider-sweat-smell-india` | bike rider sweat smell india | informational | — | None | — |
| `/blog/confidence-spray-pre-meeting-date` | confidence spray pre-meeting/date | informational | — | None | — |
| `/blog/fix-shirt-odor-before-meeting` | fix shirt odor before meeting | informational | — | None | — |
| `/blog/gym-to-office-without-showering` | gym to office without showering | informational | — | None | — |
| `/blog/hostel-clothes-smell-college-guide` | hostel clothes smell (college india) | informational | — | None | — |
| `/blog/how-to-not-smell-sweaty-at-work` | how to not smell sweaty at work | informational | — | None | — |
| `/blog/indian-summer-sweat-smell-guide` | indian summer sweat smell | informational | — | None | — |
| `/blog/is-zinc-ricinoleate-safe-for-clothes` | is zinc ricinoleate safe for clothes | informational | — | None | — |
| `/blog/keep-gym-clothes-fresh-in-bag` | keep gym clothes fresh in bag | informational | — | None | — |
| `/blog/mumbai-humidity-sweat-smell-survival-guide` | mumbai humidity sweat smell | informational | — | None | — |
| `/blog/office-ac-trap-why-rewear-shirts-smell-worse` | office ac re-worn shirts smell | informational | — | None | — |
| `/blog/perfume-plus-sweat-chemical-reaction` | perfume plus sweat chemical reaction | informational | — | None | — |
| `/blog/why-i-built-odorstrike` | why i built odorstrike (founder) | informational | — | None | — |
| `/blog/why-indian-men-sweat-smell-more` | why indian men sweat smell more | informational | — | None | — |
| `/blog/zinc-ricinoleate-fabric-odor-ingredient` | zinc ricinoleate fabric odor ingredient | informational | — | None | — |
| `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms`, `/payment-failed` | policy pages | informational | — | Anchor cleanup only (footer "Where to buy" → `/#buy`) | P2 |

---

## 2. Diff summary

**Files changed (total: 38)**

- `vercel.json` — 2 redirects added (308).
- `sitemap.xml` — 2 URLs removed; 5 lastmod bumps.
- `index.html` — homepage footer "Read" column anchors fixed (2 changes).
- `blog/index.html` — marquee swap (2), grid cards removed (2), footer link rewrite (1).
- 28 blog posts and 6 policy pages — bulk anchor-text + link-target replacement (carousel cards, footer links, inline-CTAs) so all transactional links now go to `/#buy`, not the redirected blog URL.
- 3 blog posts (`best-body-odor-remover-spray-for-men-india`, `best-deodorant-spray-for-clothes-not-skin`, `gym-clothes-smell-after-washing`) — full rewrite of `<title>`, `<h1>`, `<meta name="description">`, OG, Twitter, Article JSON-LD `headline`, `articleSection`, and the lead paragraph.

**Redirects added**

```json
{ "source": "/blog/best-fabric-odor-spray-india-2026",
  "destination": "/blog/best-fabric-odor-spray-india-2026-body-odor",
  "permanent": true },
{ "source": "/blog/where-to-buy-odorstrike-india",
  "destination": "/",
  "permanent": true }
```

`permanent: true` resolves to **HTTP 308** on Vercel — matches the existing redirect pattern in `vercel.json`.

**Pages noindexed**: 0. Cannibalization was best resolved via 308 + differentiation; no thin pages warranted noindex.

**Pages with new canonical**: 0. The two losing URLs are 308'd at the edge, so a canonical tag wasn't needed.

**Anchor-text fixes**

- Homepage `/index.html` footer "Read" column:
  - `Best fabric odor spray` → `Compare fabric odor sprays` (informational)
  - `Where to buy` → `Pricing & COD details` (retargeted to `/#buy`)
- Blog hub `/blog/index.html` footer "Popular reads":
  - `Best fabric odor spray` → `Compare fabric odor sprays`
  - `Where to buy ODORSTRIKE` → `ODORSTRIKE vs Febreze` (retargeted to `/blog/odorstrike-vs-febreze-india`)
- Blog hub trending marquee:
  - `Where to buy ODORSTRIKE in India` card swapped for `ODORSTRIKE vs Febreze on Indian clothes`
- All blog posts + 6 policy pages: footer `<a href="/blog/where-to-buy-odorstrike-india">Where to buy</a>` → `<a href="/#buy">Buy ODORSTRIKE</a>` (transactional anchor preserved, target moved to homepage).
- All blog posts: carousel "Where to buy ODORSTRIKE" cards retargeted to `/#buy` with the card title changed to `Buy ODORSTRIKE direct — ₹229, COD, free shipping`.
- Two inline-CTA references in body copy (`mumbai-humidity-sweat-smell-survival-guide`, `why-deodorant-stops-working-after-3-hours`, `odorstrike-review-30-day-india-test`, `best-body-odor-remover-spray-for-men-india`) retargeted from blog URL to `/#buy` with anchor `buy ODORSTRIKE` / `grab a bottle`.

**Validations**

- `vercel.json` is valid JSON ✓
- `sitemap.xml` is valid XML ✓
- `seo-audit/url-map.json` is valid JSON ✓
- Brand palette (`#080808` matte black + `#B8FF57` acid green) preserved in all rewrites — only metadata, headlines, and lead paragraph copy changed; CSS untouched.
- CRO elements (checkout overlay, engagement popup, email capture, BUY NOW CTAs) untouched.
- Tracking (GA4, Meta Pixel, Sheets logging) untouched.

---

## 3. Commit log

```
seo: url map
seo: conflict report
seo: apply redirects
seo: differentiate blog posts
seo: fix internal anchors
seo: update sitemap
```

Each commit isolates one logical step so you can review/revert independently.

---

## 4. Backlog — items needing your decision

These are **not blockers**. The audit is complete and shippable as is. These are judgment calls I noted along the way that you might want to act on.

1. **`spray-to-remove-sweat-smell-from-clothes-instantly` is still a commercial-intent page in `/blog/`.** Today its angle ("5-spray test, ODORSTRIKE wins") keeps it distinct from the homepage, but the slug + meta description leans transactional. If branded ODORSTRIKE traffic outperforms generic "instant spray" traffic over the next 60 days, consider 308'ing this to either `/blog/best-fabric-odor-spray-india-2026-body-odor` or `/`. Watch GSC clicks on this URL.
2. **The deodorant cluster has four URLs touching the same theme.** I kept `deodorant-vs-fabric-mist`, `why-deodorant-stops-working-after-3-hours`, `alternative-to-deodorant-for-clothes-smell`, and the now-pivoted `best-deodorant-spray-for-clothes-not-skin` distinct via angle (comparison / timing / solution / spec-sheet). If you see SERP overlap in 60 days, the cleanest consolidation is to fold `why-deodorant-stops-working-after-3-hours` into `deodorant-vs-fabric-mist` as a section.
3. **`odorstrike-review-30-day-india-test` is branded commercial intent in `/blog/`.** It's a legitimate review-format page that should be safe alongside the homepage, but if you ever want a single canonical for "odorstrike review" queries, the homepage with on-page review schema would be the consolidation target.
4. **The user brief said "18 articles, paginated 3/page".** The repo has 30 blog posts, all on a single page (no pagination markup found). Either the brief is stale or pagination got removed at some point. Worth confirming what you intended — paginated archive vs. single-page archive will affect how /blog distributes link equity.
5. **`/blog/best-fabric-odor-spray-india-2026.html` file is still on disk** because Vercel handles the 308 at the edge. Safe to delete the source file in a future cleanup commit (same for `/blog/where-to-buy-odorstrike-india.html`) once the redirect is verified live in production. I left them in place to avoid coupling git deletes to a redirect rollout that might not be your call.
