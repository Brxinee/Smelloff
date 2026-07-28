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
- **₹229 solo (50ml) is the ONLY SKU. No duo/trio/bundles anywhere.**
- Claim: "up to 8 hours odor protection on fabric". Glycerine-free, zero residue.
- 4-layer mechanism: TRAP HPβCD · NEUTRALIZE Zinc PCA · PREVENT Triethyl Citrate · ANTI-REGROWTH Zinc Gluconate (Formula v3.1).
- NEVER list Zinc Ricinoleate, Sodium Bicarbonate, or Glycerine as ingredients.
- **NEVER publish formula percentages/concentrations anywhere** (site, schema, llms.txt, blog). Ingredient NAMES are public; exact amounts are a trade secret. Say "exact concentrations are proprietary" if asked.
- Canonical domain is `https://smelloff.in` (non-www; www redirects).

## Page roles (corrected 2026-07-28)
Earlier notes here claimed `index.html` carried the buy section and that
`/odorstrike` redirected to `/#buy`. Neither is true. The actual split:
- **`index.html` (~55KB)** — the **brand page**. Hero (bottle + price + buy CTA
  that links out), benefits strip, ticker, zones, territory, problem, featured
  product, voices, founder, proof, FAQ. No checkout on this page.
- **`odorstrike.html` (~166KB)** — the **product page and the entire checkout**
  (UPI + COD + Supabase mirror + Sheets logging + Resend email + consent-gated
  analytics). This is the money page; be careful editing it.
- Both are deliberately self-contained single-file pages (inline CSS/JS) so the
  LCP path carries no extra render-blocking request. They do **not** use
  `/assets/js/app.js`.

## Shared site chrome (2026-07-28)
Every page now carries the **same header and footer** — the homepage's. Before
this there were four headers (homepage, `/odorstrike`, `/blog`, and a `.p-nav`
that was just a logo plus "← Back to home" on the other 13 pages) and three
footers, so moving from `/` to `/privacy` or `/blog` read as a different site.
- `assets/css/chrome.css` — header, footer, page shell (`.sf-wrap`,
  `.sf-section`, `.sf-eyebrow`, `.sf-masthead`) and long-form prose
  (`.sf-prose`). All `.sf-` prefixed; declares **no hex values**, only tokens.
- `assets/js/chrome.js` — burger toggle, cart badge, `aria-current` on the nav
  link matching the URL. Replaces the inline copies that used to live on each
  page that happened to have a header.
- **`soft.css` and `chrome.css` must be the LAST stylesheets in `<head>`,
  after every other `<link>` and after the page's inline `<style>`.** They win
  by source order, not specificity — most of their rules sit at the same
  weight as the page's own. `apply-chrome.mjs` enforces this by stripping and
  re-inserting them immediately before `</head>`; don't hand-place them.
  (Getting this wrong is not theoretical: parked before `blog.css`, the blog
  posts picked up that file's `.faq details{border-radius:0}` and its own
  summary padding, so blog FAQs rendered square and double-height while the
  rest of the site's were round and compact.)
- **FAQ accordions: the `<details>` owns the shape, the `<summary>` owns the
  padding.** Both padding sets applied at once is what made every row twice as
  tall as its text. The canonical spec is in `soft.css` §3 and covers
  `.faq details`, `.faq-item`, `.faq-q` and `.faq-list details`; it uses
  `!important` on padding/radius specifically to beat `blog.css`. The list
  container is one column on phones and two at ≥900px, everywhere.
- The markup is **generated**, not hand-written. `scripts/apply-chrome.mjs`
  holds the canonical header/footer and stamps them between
  `<!-- SF-CHROME:HEADER -->` / `<!-- SF-CHROME:FOOTER -->` markers on all 24
  pages. It is idempotent (`--check` for a dry run). **Edit the script, re-run
  it, commit the result — never hand-edit the markup between the markers.**
- One deliberate variant: the cart control. On `/odorstrike` it is a
  `<button onclick="openCartDrawer()">` whose badge is `#cartCount` (driven by
  that page's checkout JS); everywhere else it is a link to
  `/odorstrike?cart=open` with badge `#sfCartCount` (driven by `chrome.js` from
  `localStorage`). Pass `cart: 'drawer'` in the script's `PAGES` table.
- The blog's slide-out drawer is gone — it was a fourth nav pattern with its own
  logo, socials and guide list. Its topic chips survive inline above the grid as
  `.b-cats` / `.b-cat`, wired to the same `window.filterCards`.
- **The footer is three link columns side by side at every width**, with the
  brand block and the social row as full-width bands. Stacked one group per
  row it ran ~1200px on a phone — taller than the viewport, so the footer
  alone was a screen and a half of scrolling and made pages look like their
  content had vanished. Keep the labels short enough not to wrap in a
  ~110px column ("Refunds", "Partners", not "Refund policy", "Partner
  program"). `text-align:left` is pinned on `.sf-ftr` because contact,
  reviews and track-order centre their page wrapper and it inherited in.

## Design system (2026-07-28)
`assets/css/tokens.css` is the **single source of truth** for colour, type
scale, rhythm, borders and motion. Before it, nine `:root` blocks had drifted
apart across three naming families — three different whites (`#F4F1EA`,
`#F5F5F5`, `#FFFFFF`), two card fills, two border colours and four greys.
- Canonical: `--ink #080808` · `--surface #0F0F0F` · `--text #F4F1EA` ·
  `--muted #9A958D` · `--text-2 #C9C5BD` · `--acid #B8FF57` · `--acid-hi #D1FF8A`.
- Every page links `tokens.css`. The two self-contained pages inline a
  **byte-identical copy** of its `:root` block, marked `TOKENS v1` — change a
  value in one, change all three.
- `tokens.css` also carries a frozen alias layer mapping the old names
  (`--paper/--bg/--accent`, `--black/--white/--card/--border/--green/--gray`,
  `--nb-*`) onto the canonical tokens, so legacy rules keep resolving. Write new
  CSS against the canonical names; don't grow the aliases.
- Metric-matched fallback faces (`Fraunces Fallback` etc.) live in
  `assets/fonts.css` and inline in `index.html`, holding CLS near zero.
- Unreferenced stylesheets: `assets/css/neo.css`, `neo-lite.css` and `main.css`
  are no longer loaded by any page (blog posts use `blog.css`). Left in place,
  but they are dead weight and safe to delete.
- Text selection is enabled site-wide. It used to be blocked on `body` in
  `odorstrike.html` and `blog.css`, which stopped customers copying their own
  order ID and readers quoting a guide. Only interactive chrome opts out now.

## Soft form language (2026-07-28)
`assets/css/soft.css` replaces the old brutalist shapes (90° corners, 3px
borders, hard offset shadows) with the squircle language modelled on
wimpdecaf.com: generous radii, hairline outlines, no offset shadows, pill
buttons with uppercase wide-tracked labels and a bounce on hover.
**Palette and type are unchanged** — only the shapes.
- Radii scale: `--sq-sm 11px` (buttons, matching wimpdecaf's `.6875rem`),
  `--sq-lg 28px` (cards), `--sq-xl 36px` (panels, gallery tiles), `--sq-pill`.
- **It is linked *after* each page's inline `<style>` on purpose.** Most pages
  here are self-contained, and an inline `<style>` beats a preceding `<link>`
  at equal specificity. Loading last lets one file restyle every component
  across ~24 pages, and makes the whole change reversible by removing one
  `<link>`. If you add a page, link `soft.css` last in `<head>`.
- FAQs are `<details>` accordions everywhere (homepage, `/odorstrike`, `/faq`).
  The +/− marker, the open state and the row transition all live in `soft.css`;
  a page only needs `<details class="faq-item"><summary><h3>…</h3></summary>`.
- `/odorstrike` hero is a scrolling squircle gallery beside a **sticky buy
  panel** (`.product-info` is `position:sticky` at ≥960px). The gallery is a
  horizontal scroll-snap carousel on mobile so the CTA stays reachable.
- **PDP gallery = product photography only, three tiles**:
  `odorstrike-hero-disc.webp` (bottle on the acid disc), `shot-studio.webp`
  (clean studio shot), `odorstrike-bottle-cutout.webp` (contained, as a detail).
  It used to render `shot-pocket`, `shot-gymbag` and `shot-flatlay` too — those
  are **ad creatives with headline copy, bullet lists and icon rows burnt into
  the pixels**. Two type systems fought in every tile and the claims inside were
  unselectable, untranslatable and invisible to search. **Do not put them back
  in the gallery.** The claims they carried are real markup now (`.fix-carry`).
  The three files are still in `/assets` for paid social.
- `assets/odorstrike-hero-disc.webp` was derived from a founder-supplied render
  whose disc was `#BFE20A`. It is recoloured to the brand `--acid #B8FF57`
  exactly, and its background is lifted from `#000000` to the page ink
  `#080808` so the tile is seamless. Any replacement must match both.
- The `.spec-scale` rows (protection / fragrance) are the analogue of
  wimpdecaf's roast-strength slider. Levels are 1–4; "up to 8 hrs" is the
  locked claim, so the protection dot sits at the top of the scale, not past it.
- `.spec-row` is used by **two** components on `/odorstrike` — the hero scale
  and the showcase spec table. Both are scoped (`.spec-scale .spec-row`,
  `.specs .spec-row`); they were not, and the hero's grid columns were leaking
  into the table. Keep them scoped.

## Site structure
- `/` — brand homepage (hero, benefits, problem, product, voices, founder, FAQ)
- `/odorstrike` — product page + checkout
- `/blog` — blog index (8 posts)
- `/blog/[slug]` — individual blog posts
- `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms` — policy pages
- `/llms.txt`, `/llms-full.txt` — AI/LLM context files
- `/sitemap.xml`, `/robots.txt`, `/manifest.json`
- `/admin` — private admin dashboard ("Mission Control"), served at `admin.smelloff.in` (noindex, password-gated). Single self-contained SPA `admin/index.html` + one serverless function `api/admin.js` (session login, Supabase service-role CRUD over orders/reviews/messages/waitlist/blog_comments, computed business stats, first-party analytics reports, optional GA4 Data API proxy). Order status pipeline: placed→confirmed→packed→dispatched→out_for_delivery→delivered (+upi_pending, cancelled); admin has one-tap "advance" buttons and the customer `track-order.html` timeline mirrors it. Every status change is timestamped into `orders.status_history` (jsonb `[{status,at}]`) + `orders.updated_at` by the `orders_track_status` DB trigger (migration `20260711_order_status_history.sql`), so the customer timeline shows *when* each stage happened plus an estimated-delivery window — no admin wiring needed, the trigger fires on any status update. Setup + env vars in `docs/ADMIN-SETUP.md`. Secrets (`ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GA4_*`) live only in Vercel env — never in the client. Reuses brand fonts/colors; charts follow the validated dark-mode dataviz palette.
- **First-party analytics** — cookieless, no-Google web analytics. `api/track.js` receives a beacon from every page (added inline to index/faq/odorstrike, via `assets/js/consent-analytics.js` everywhere else) and stores an anonymised row in `page_views` (daily-rotating visitor hash from IP+UA+salt; no cookie, no PII). Aggregated by the `site_analytics()`/`site_realtime()` RPCs (service-role only) and shown in the admin Analytics tab. Runs regardless of the GA/Pixel consent choice because it stores nothing on the device and no personal data. Migration: `supabase/migrations/20260711_first_party_analytics.sql`.

## Blog prune (2026-07-28)
The blog was cut from 48 posts to **8** — brand, founder and ODORSTRIKE product
content only. Kept: `why-i-built-odorstrike`, `odorstrike-review-30-day-india-test`,
`odorstrike-vs-febreze-india`, `ambi-pur-vs-odorstrike`, `what-is-fabric-odor-eliminator`,
`hpbcd-cyclodextrin-fabric-odor`, `zinc-pca-fabric-odor-ingredient-guide`,
`beta-cyclodextrin-odor-removal-science`.
- All 40 deleted slugs **301 to `/odorstrike`** in `vercel.json`, so existing
  backlinks still land somewhere useful instead of 404ing.
- Sitemap went 61 → 22 URLs; `llms.txt` / `llms-full.txt` pruned to match.
- The blog index collapsed from six sections (Featured / Trending / Most Read /
  Browse by Topic / Latest / You might also like) to one grid — with 8 posts the
  rest just repeated the same cards. The curated-slot arrays in its inline JS are
  now empty; re-populate them to bring those sections back.
- Note this reverses SEO audit items 3, 6, 7 and 8 below for the deleted posts.
  This was a deliberate product decision, not a regression.

## SEO audit status (originally 77/100 — all 9 code-fixable issues resolved as of 2026-06-10)
1. ~~www vs non-www canonical conflict~~ — **FIXED**: everything (canonicals, sitemap, JSON-LD, robots.txt Sitemap directive, llms.txt) uses non-www `https://smelloff.in` (no trailing slash, https). `vercel.json` 301s www→non-www; `cleanUrls:true` + `trailingSlash:false`.
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
