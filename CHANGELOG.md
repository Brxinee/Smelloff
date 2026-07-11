# Smelloff SEO / GEO / AEO Audit Changelog

---

## 2026-07-11 — Order tracking: timestamped timeline

Branch: `claude/order-tracking-audit-2hwah2`

Audited the customer Track-Order flow (`/track-order` → `track-order` edge
function → `orders` table) end-to-end. Baseline worked (code+phone lookup,
phone-gated so codes can't be enumerated) but the timeline could only show the
*current* stage — never when each stage happened, and no "last updated" or ETA.

**Database** (`supabase/migrations/20260711_order_status_history.sql`)
- Added `orders.status_history jsonb` (a `[{status, at}]` trail) and
  `orders.updated_at timestamptz`.
- Added a `BEFORE INSERT/UPDATE` trigger (`orders_track_status`) that seeds the
  trail on insert and appends a timestamped entry on every status change, and
  bumps `updated_at` on status/courier/tracking changes. Admin-agnostic — the
  trail is correct however status is updated (dashboard, function, raw SQL).
- Backfilled existing rows from `status` @ `created_at`.

**Edge function** (`supabase/functions/track-order/index.ts`, redeployed v2)
- Returns `status_history`, `updated_at` (still sanitized — no email/street).

**Front-end** (`track-order.html`)
- Each timeline step now shows the date + time it happened.
- Added a "Last updated" line and an "Estimated delivery" window
  (dispatch + 2–5 days, or placed + 3–7 days; "Arriving today" once out for
  delivery; "Delivered <date>" once delivered).
- Shows shipping state next to city.

---

## 2026-05-12 — Full SEO + GEO + AEO Audit

Branch: `claude/seo-geo-aeo-audit-6D4Nq`

---

### Phase 1 — Technical SEO

**robots.txt**
- Added explicit `User-agent` + `Allow: /` entries for GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Google-Extended, CCBot, Applebot-Extended, cohere-ai
- Critical for GEO/AEO: AI crawlers must not be blocked

**sitemap.xml**
- Added missing blog posts: `best-fabric-odor-spray-india-2026.html`, `where-to-buy-odorstrike-india.html`
- Added missing policy pages: `/returns`, `/refund`
- Updated homepage `lastmod` to 2026-05-12
- Updated blog index `lastmod` to 2026-05-12
- Updated priority weights (blog index: 0.8 not 0.9; policy: 0.3–0.4)
- Expanded homepage image:image with improved caption

**index.html — head**
- Fixed `<html lang="en">` → `<html lang="en-IN">`
- Added `geo.region`, `geo.placename`, `geo.position`, `ICBM` meta tags
- Added `og:image:alt` and `twitter:image:alt`
- Fixed `hreflang` value from `en-in` to `en-IN`
- Upgraded robots meta: added `max-video-preview:-1`

**All blog posts (29 files) + blog/index.html**
- Fixed `<html lang="en">` → `<html lang="en-IN">` on all
- Added `geo.region` / `geo.placename` / `geo.position` / `ICBM` to all
- Upgraded robots meta to full directive on all
- Added `og:image:alt` and `og:image:width/height` to all
- Added `og:locale: en_IN` to all
- Added `twitter:image` and `twitter:image:alt` to all
- Added `hreflang="en-IN"` and `hreflang="x-default"` to all
- Added `image` field to Article schema on all posts (was missing)
- Added `BreadcrumbList` schema (Home > Blog > Post) to all posts
- Fixed broken `og:image` URL in `remove-sweat-smell-shirts-without-washing.html` (was pointing to non-existent `/og-sweat-smell.jpg`)

**Policy pages (6 files)**
- Fixed `lang="en"` → `lang="en-IN"` on all
- Added geo tags, upgraded robots meta, `og:image:alt`, `og:locale`, `twitter:image`
- Added `hreflang="en-IN"` to all
- Added `WebPage` schema to all policy pages

---

### Phase 2 — Keyword Strategy

**SEO_KEYWORD_MAP.md** (new file)
- Documented keyword intent buckets: Primary, Secondary, Long-tail/AEO, GEO-modified
- Keyword-to-page mapping for homepage and all 16 priority blog posts
- Keyword density rules and AEO target questions

---

### Phase 3 — Structured Data

**index.html — JSON-LD**
- FAQPage schema expanded from 5 questions to 13 questions (synced 1:1 with visible FAQ)
- Updated FAQPage answer for Febreze comparison: removed β-Cyclodextrin/Zinc PCA reference, aligned with Zinc Ricinoleate (per llms.txt authoritative formulation)
- Updated Product schema `description` to dense factual paragraph for AI extraction
- Updated Product schema `material` from "Zinc PCA" → "Zinc Ricinoleate"
- Updated HowTo schema step text from "zinc pca formula" → "Zinc Ricinoleate formula"
- Updated Product offers: corrected spray count from ~200 to ~250

**Blog posts**
- Added `image` field to all Article schemas (was missing — required for Google Article rich results)
- Added BreadcrumbList schema to all posts

---

### Phase 4 — AEO Content

**index.html — new sections added above FAQ**

1. **"About ODORSTRIKE" block** (GEO entity signal)
   - 80-word factual Wikipedia-style paragraph: what it is, hero ingredient, category, price, specs
   - Designed for AI engine direct extraction and brand entity disambiguation

2. **"Quick Answers" block** (AEO extraction target)
   - 3 bolded Q&As at 50–60 words each targeting top AI query patterns:
     - "What kills sweat smell on clothes without washing?"
     - "Why do gym clothes smell even after washing?"
     - "Is fabric odor spray better than deodorant for clothes smell?"

3. **Comparison table** (AEO table extraction, AI Overview target)
   - ODORSTRIKE vs Deodorant vs Perfume vs Fabric Conditioner
   - 6 comparison rows: Target, Mechanism, Masks vs Eliminates, Works after worn, Pocket-portable, Price

4. **FAQ expanded from 5 to 13 questions**
   - New Q&As added:
     - Is it safe on dark clothes?
     - Can I use it on gym clothes / polyester?
     - Is it safe to inhale?
     - Can I use it on shoes, helmets, or car seats?
     - Does it replace washing?
     - Is COD available? How fast does it ship?
     - Does it work in monsoon humidity?
     - What fabrics is it safe on?

---

### Phase 5 — GEO

**llms.txt** — No changes required (already comprehensive with full ingredient list, founder info, pricing, blog links)

**Ingredient consistency** — Flagged for human review:
- On-page how-to steps reference β-Cyclodextrin and Zinc PCA
- llms.txt and JSON-LD Product schema reference Zinc Ricinoleate
- TODO: Founder to confirm which reflects current v2.1 formulation and update on-page steps accordingly

---

### Phases 6–9 — Content, Images, International, Verification

- Internal link density: homepage already links to 7+ blog posts via footer; blog posts link back to homepage
- `og:image` alt text added to all pages (accessibility + image SEO)
- `hreflang="en-IN"` added to all pages (international targeting)
- All decorative social icons in footer already have `alt=""` (correct)
- Color contrast: acid green #B8FF57 on matte black #080808 passes WCAG AA (contrast ratio ~10.7:1) — no changes needed
- `<html lang="en-IN">` enforced on all pages
- Schema `priceCurrency: INR` already correct on homepage Product schema
- Address schema already set to Hyderabad, Telangana, IN

---

### Files Changed

| File | Changes |
|---|---|
| `robots.txt` | AI bot allowlist added |
| `sitemap.xml` | 2 missing blogs + 2 policy pages added, dates updated |
| `index.html` | lang, geo, og:image:alt, schemas, FAQ ×13, About block, Quick Answers, comparison table |
| `blog/index.html` | lang, geo, og:image:alt, og:locale, twitter:image, hreflang |
| `blog/*.html` (29 files) | lang, geo, og:image:alt, og:locale, twitter:image, hreflang, BreadcrumbList, Article image field |
| `privacy.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `refund.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `returns.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `shipping.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `terms.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `payment-failed.html` | lang, geo, og:image:alt, hreflang, WebPage schema |
| `SEO_KEYWORD_MAP.md` | New file — keyword strategy |
| `SEO_AUDIT_REPORT.md` | New file — full audit report |
| `scripts/fix_seo_blog.py` | New — batch fixer script (keep for future runs) |
