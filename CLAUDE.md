# Smelloff — Claude Code Context

## What this project is
Smelloff is a D2C e-commerce site selling **ODORSTRIKE** — pocket-sized fabric odor remover spray for clothes (50ml, ₹229). Static pages plus one Cloudflare Worker, deployed on Cloudflare Workers only. Single product, direct-to-consumer, COD-enabled, ships pan-India from Hyderabad.

## Stack
- Static HTML + vanilla JS (no framework)
- Cloudflare Workers deployment (`wrangler.jsonc`, `src/index.js`); redirects + headers live in `config/routing.json` — see below
- Supabase (orders/data)
- Google Sheets webhook (order backup)
- GA4 + Meta Pixel (consent-gated)
- Resend transactional email via `/api/send-email`
- Self-hosted fonts (Fraunces + JetBrains Mono + Inter Tight + Barlow Condensed)

## Cloudflare Workers deploy (2026-10-10)
Production moved from Vercel to Cloudflare Workers on 2026-09-26. Three things
the move silently dropped, now restored:
- **`src/index.js` crashed on every Worker request** (`worker.fetch is not a
  function`, Cloudflare error 1101): `httpServerHandler()` returns `{ fetch }`,
  and the object itself was exported as `fetch`. Static pages masked it; every
  `/api/*` call — checkout, payment verify, webhooks — failed.
- **`npm run build` is the Cloudflare build** and must do what Vercel's
  `buildCommand` did: `optimize:critical` (the homepage `<picture>` points at
  `/assets/optimized/*`, which is gitignored build output) and `apply:chrome`.
  Both mutate the working tree, so a second local build reports stale pages —
  restore with `git restore .` first; CI always builds from a fresh clone.
- **Routing lives in `config/routing.json`** (it was `vercel.json`; Vercel was
  removed for good on 2026-10-10 — see below). `scripts/cloudflare-routing.mjs`
  compiles its redirects and headers into `public/_redirects` and
  `public/_headers` on every build — edit `config/routing.json`. Host-based
  rules (www → apex) can't be expressed there; the Worker does them
  (`src/canonical.js`, see "Search Console fixes" below). `assets.html_handling = "drop-trailing-slash"` replaces
  `cleanUrls` + `trailingSlash:false`.
- **The Worker owns `smelloff.in` and `www.smelloff.in` as custom domains**
  (`routes` in `wrangler.jsonc`, applied by `wrangler deploy`). Before that,
  only `/` reached the Worker; every other path fell through to a zone DNS
  record pointing at a Cloudflare IP and returned **error 1000**. Don't add
  dashboard routes or hand-made DNS records for these hosts.
- The Worker parses JSON with a `verify` hook that keeps `req.rawBody`: the
  Razorpay and Resend webhooks HMAC the exact bytes, and the fallback of
  re-serialising `req.body` does not reproduce them.

## Impressions, no clicks: search-result titles (2026-10-15)
Owner: "only impressions, no clicks." Full write-up:
`docs/audits/ctr-impressions-no-clicks-2026-10.md`. Clicks are mostly brand
(homepage); guides get impressions only. Causes: AI Overviews on how-to queries,
page-2 positions, low authority, no review stars, and snippets that promised
nothing, with seven slogan H1s that Google could swap in as the title.
- **`scripts/seo/apply-serp-titles.mjs` owns the title, H1, description, og/
  twitter titles, Article headline and breadcrumb name of the 32 posts it lists.**
  Edit the entry there and re-run it (then `apply-reader.mjs` for Related cards,
  `build-llms.mjs`, `build-sitemap.mjs`); `--check` is in `npm run build`.
- Rules: title = H1 (test: H1 shares ≥ half the title's words, every post); 40–60
  chars, no " | Smelloff"; a number only if the post backs it; no price in how-to
  descriptions.
- Per-query GSC data wasn't reachable (Ahrefs/Semrush/Windsor plans). Next round
  needs the owner's 3-month Queries + Pages export.

## Search Console round 4: page indexing (2026-10-14, export dated 10-09)
The five Coverage exports hold counts only (no URLs) and stop on 9 Oct, the
day before the custom-domain fix. Indexed: 74 → 35 (22 Sep) → 22 (5 Oct);
submitted 69 → 32 → 19; 403s 79 known / 38 submitted — the error-1000 window.
Google drops a URL that answers 4xx (403 included) and re-adds it only after a
recrawl gets 200, so the number climbs back as Google recrawls, not at once.
- **Live crawl with Googlebot's UA (14 Oct), 510 URLs** — every URL in any
  committed sitemap, every page ever committed, every routing source, and the
  www/http/slash/.html spelling of each sitemap URL: all 200 or one 301 to a
  200, except **bare `/public` (200 with the homepage — a duplicate of `/`)**
  and `/public/solutions/*` (two hops). `src/canonical.js` now strips
  `/public` and resolves the table in one 301.
- **Capitalised paths** (`/Odorstrike`, `/FAQ`) 404'd on the case-sensitive
  asset server. After a 404 only, the Worker tries the lowercase spelling and
  301s if it exists (`lowercaseRedirect` in `src/index.js`); unknown paths
  still 404, `/r/<code>` keeps its case.
- **Guessed URLs** with a real equivalent 301 (`/shop`, `/product(s)`, `/cart`,
  `/checkout`, `/home`, `/about-us`, `/contact-us`, `/*-policy`,
  `/terms-and-conditions`, `/track`, `/feed`, `/rss`, `/sitemap_index.xml`).
  A test fails if any plain redirect points at a page that doesn't exist.
  Other unknown URLs stay 404 — Google: a 404 for a page with no replacement
  is correct.
- `X-Robots-Tag: noindex` on `/products.json`, `/manifest.json`, `/sw.js` and
  the IndexNow key, so "Crawled – currently not indexed" lists pages only.
  `llms*.txt` and `feed.xml` stay indexable on purpose.
- Footer "Smell guide" → the hub `blog/remove-smell-from-clothes-without-washing`
  (it had 4 inbound links; it links every per-smell guide).
- `node scripts/audit-live-seo.mjs --live --all-known` re-runs the crawl
  (~600 URLs, Googlebot UA; flags 4xx anywhere, a redirect to a non-200, a
  second spelling answering 200, noindex in the sitemap). Run it after a
  deploy, before Validate fix.
- **Rows that need no fix** (Google's own help): Page with redirect (the
  retired slugs, www/http, the 75 `/public/…` URLs), Alternate page with
  proper canonical (`?buy=1`, `?cart=open`, `?ref=`), Excluded by noindex
  (`/404`, `/payment-failed`, `/admin`), Blocked by robots.txt (`/api/`,
  `/admin`).
- **Owner, in GSC:** remove the submitted `https://www.smelloff.in/sitemap.xml`
  (keep the apex one) and resubmit `https://smelloff.in/sitemap.xml`; URL
  Inspection → Test live URL on `/` and `/odorstrike` (must say "URL is
  available to Google"; if it shows 403, a Cloudflare security rule is
  blocking real Googlebot — Security → Events); Request indexing for `/`,
  `/odorstrike`, `/blog`, the hub and the top posts (≈10 a day); Validate fix
  on "Blocked (403)" and "Not found (404)" (about two weeks). Don't validate
  "Crawled – currently not indexed" — Google says no resubmission is needed.
  For per-URL lists, click a reason row and export from that page.

## Founder + co-founder (2026-10-12, owner's call)
**Jogdhande Nikhil Patil is the Founder; Vineeth Kumar Duggepogu is the
Co-founder** (`brand.coFounder` / `coFounderJobTitle` in `config/product.json`).
The Organization schema's `founder` is an array: `#founder` (Nikhil, Founder)
and `#cofounder` (Vineeth, Co-founder). Both are on `/about` ("The founders"),
the homepage founder strip, `llms-full.txt` and the founder-story FAQ.
- How they met (owner's words): friends who met at a job interview in Hyderabad,
  then worked together ~1.5 years at Zomato Everyday, a cloud kitchen. On `/about`.
- **Not changed, on purpose:** post bylines and Article `author` stay Nikhil
  (`brand.founder`, `#founder`), since he wrote them. The legal lines also stay:
  "Manufactured by", Grievance Officer, and the sole-proprietor wording in
  `/terms` and the policy footers. A sole proprietorship has one proprietor, so
  changing those is a registration question for the owner, not a copy edit.

## Sharp images, skeleton loading (2026-10-12, owner: "no blurry images")
- **Logo:** the build used to swap in one 160px WebP (q82) for a logo drawn
  120–148px wide, so it was soft on every 2x/3x screen. It is now a committed
  lossless set `assets/brand/logo-smelloff-white-{160,320,480}.webp` (4–9KB)
  with `srcset` + `sizes="(min-width:900px) 148px, 120px"`, in every page and
  in `apply-chrome.mjs`. Nothing to strip after a local apply-chrome run.
- **No blurred previews.** Photos on `/` and `/odorstrike` (hero included)
  show the soft.css §10 skeleton shimmer until loaded; a test forbids
  `data:image` previews in `.ph-pic`. Transparent cutouts keep `data-no-skel`.
- Blog index lead story has its own `sizes` (`lead` in apply-thumbnails).
- **Owner: no cutouts and no cropping ("don't cut").** The offer boxes
  (`/#buy`, `/odorstrike#buy`), the cart drawer, every post's end card and
  the blog index band show the owner's photo of the bottle in hand on pure
  black (`assets/photos/offer-in-hand-black*`, AVIF q76 4:4:4 + WebP q88 at
  400/640/960/1152 from the original upload), **whole**: `object-fit:contain`
  on a `#000` panel, so the photo's black meets the panel and no bars show.
  The PDP's `.ph-photo` grey background is cleared for it (it showed beside
  the photo). The old 241px `odorstrike-bottle-cutout` stays in `/assets`
  for emails only; a test forbids any bottle cutout on pages and pins
  `contain` on both offer photos.
- **Label artwork typos, owner's call:** every bottle render and the in-hand
  photo read "Fabric Oolor Eiiminator Mist" and "GYMWEAR" as "OYMWEAR" /
  "GYNWEAR". Readable on desktop in the offer box.
- A DPR-3/DPR-2 audit of the built site: every image now gets ≥2 device px per
  CSS px except four photos already at their largest file
  (`home-04-dried-clear`, `pdp-05-dried-clear`, `pdp-commute-collar`,
  `home-01-collar-check` on a post): they need higher-resolution originals.

## Search, citation and GSC compliance, round 3 (2026-10-11/12, owner: "rank everywhere in the niche")
A compliance audit of every JSON-LD block, the merchant feed and all live URLs,
plus GSC query data. Every structured-data error in the export came from markup
#460/#482 already removed; the only live warning left is "Missing review /
aggregateRating", which needs real verified-buyer reviews (never beta quotes).
- **One set of facts** (`test/claims-consistency.test.mjs`): dry time is
  15–30 s everywhere (146 "~10 seconds" in 42 posts, feed, llms), no pH, no
  fragrance %, no absolute "no residue", HPβCD (not β-CD) as the active. AI
  engines drop or hedge facts a site contradicts. The same test fails on pasted
  AI-tool residue (a "filecite…turn8file0" token was live in a post).
- **`llms.txt` / `llms-full.txt` are generated** by `scripts/seo/build-llms.mjs`
  (`npm run llms`; `--check` in the build) from `config/product.json` and the
  post list. Its ANSWERS cite post slugs and throw if one disappears.
  `product.definition` in the config is the one definition passage, used as the
  first FAQ ("What is ODORSTRIKE?") on `/`, `/odorstrike` and `/faq`.
- **PDP H1** is `ODORSTRIKE <span class="pd-title__cat">Pocket-sized fabric odor
  spray for clothes</span>` (replaced the tagline; hero no taller).
- **Schema:** Offer MRP is `StrikethroughPrice` (Google: "no other values are
  supported"); `returnPolicyCountry` IN; `validFrom` 2026-10-11 (₹229 returned);
  product images are tiles the PDP shows; `category` is the Google taxonomy
  path; no `material`. Merchant feed has no `identifier_exists` (brand + MPN are
  identifiers). Organization `sameAs` = profiles only (no wa.me, no FB share
  link). The founder is one Person `@id https://smelloff.in/#founder` on every
  post, `/about` and the Organization.
- **`apply-reader.mjs` now also stamps** on every post: author/publisher by
  `@id`, `speakable` on the Article (free-standing SpeakableSpecification blocks
  were invalid), datePublished ≤ dateModified, the visible "Updated" date from
  `dateModified` (edit the schema date, never the text), the byline → `/about`,
  and **Related guides**: three links from its topic cluster (`CLUSTERS`), rotated
  so each post is linked from three others. A new post must join a cluster or
  the build fails. Seven posts had no inbound guide link before.
- **Routing:** `/solutions` and its four city pages are retired (thin, orphaned,
  0 clicks in six months) and 301 to the matching guides; the export's Not
  found URLs (`/smelloff`, `/index-2`, `/Index`) and `/public/*` 301; `/ai.txt`
  and `/.well-known/llms*.txt` 301 to the one file; no global X-Robots-Tag
  (pages carry meta robots); `/404` returns status 404; the GSC verification
  file is served at its `.html` URL without a redirect. `routing.json` accepts
  `/prefix/:name*` splats. Sitemap: 71 URLs.
- **Content aimed at GSC queries at #5–12 with no clicks:** best fabric
  freshener (H1 = query; "Are cheap fabric refreshers as good as the popular
  brands in India?" + a five-type table), can deodorant be used on clothes (H1
  = question, body-or-clothes table), cyclodextrin in deodorant + safety +
  solubility (Saokham 2018), washing-machine H1 is the question. Every `/#buy`
  in posts → `/odorstrike`. Per-spray maths: ₹0.92.
- **Owner, outside the repo:** GSC → Validate fix on every Merchant listings,
  Product snippets and Page indexing issue, resubmit `sitemap.xml`, request
  indexing for `/odorstrike`; Merchant Center: add the feed and set shipping and
  returns; ask the five delivered customers for reviews (the only route to
  review stars).

## Competitor-informed SEO (2026-10-12, owner: "learn from competitors, don't change design")
Source: Notion "Fabric Odor Spray Competitor Intelligence" (Faultless ReWear,
Fresh Wave, Febreze, Mrs. Meyer's, Aquos Silver, NEPSAN, Sano Maxima…). Taken
as structure, never copy or claims:
- **Hub `blog/remove-smell-from-clothes-without-washing`** (Fresh Wave's "shop
  by odor" + ReWear's "between washes"): a smell → where it sits → fix → guide
  table linking the per-smell and per-garment posts, a refresh-or-wash table,
  and a Hinglish section ("Kapdon se badbu kaise nikale bina dhoye?") for
  Indian queries. Blog is **58**; sitemap 72. Uses the collar-check photo (no
  generated thumbnail; not in apply-thumbnails).
- PDP meta/OG description leads with "refresh clothes between washes … instead
  of masking it".
- Owner-side lessons from the same research: Amazon.in/Flipkart listings
  (ReWear, TetraClean and Zerodor sell through marketplaces), real reviews on
  the PDP, and refills/bundles only if margins allow.

## Search Console round 2: indexing, duplicates, snippets (2026-10-11, GSC export dated 10-12)
Eight reports (performance 6 months, coverage x2, HTTPS, breadcrumbs, product
snippets, merchant listings, review snippets). What they showed and did:
- **Indexing collapsed in the Cloudflare move**, not from content: indexed
  pages 74 → 35 (sitemap-filtered: 3), 69 "Blocked (403)", product snippets /
  breadcrumbs / HTTPS-valid all to 0 between 26 Sep and 10 Oct — the error-1000
  window (a 403). A Googlebot-UA crawl of all 153 known URLs now gets 200
  everywhere. Recovery needs the owner in GSC (see below), not code.
- **Legacy www URLs took 2 hops** (www → apex → new post). `src/canonical.js`
  now resolves the static redirect table inside the same 301; a test fails on
  any chain.
- **Duplicate post:** `spray-to-remove-sweat-smell-from-clothes-instantly` and
  `-quickly` were the same article (81% shared 5-grams). `-instantly` 301s to
  `-quickly` (the hub six legacy redirects already used). Blog is **57** posts.
- **Restored** `remove-smell-from-hoodie-without-washing` and
  `remove-smell-from-blazer-without-dry-cleaning`: deleted by `dd86e68` (the
  commit that corrupted 20 posts) and 301'd to the trousers post; seven links
  labelled "blazer guide" pointed at trousers. Ported into the current
  template with config facts (15–30 s dry, "dries clear with no stiff
  residue"), no FAQ schema. History: `git show dd86e68^:blog/<slug>.html`.
- **Snippets:** titles ≤ 60 and descriptions 70–160 on every indexable page
  (test in `test/structured-data.test.mjs`); pages retitled in #460 kept their
  titles. The gym/dri-fit post got an answer-first quick answer, a dri-fit
  section and question-shaped H2s.
- **Merchant/product:** the live Product already had every flagged field
  (the errors were from the old duplicate blocks); added the MRP as an Offer
  `priceSpecification` (now StrikethroughPrice, round 3). The Merchant feed's
  `g:price` stays ₹229 — a `g:sale_price` against MRP is the owner's call.
- **Review snippets** need real verified-buyer reviews (`includeRating` in
  `buildProductJsonLd()`); never from beta quotes or the founder's review.
- **Owner, in GSC:** Pages → "Blocked due to access forbidden (403)" and
  "Crawled – currently not indexed" → Validate fix; Sitemaps → resubmit
  `sitemap.xml`; URL Inspection → Request indexing for `/`, `/odorstrike`,
  `/blog` and the top posts. Ahrefs' GSC tools need a higher plan.
- Fixed in round 3: the ~10 s dry claims. Still open: the blog end card anchor "View product details" is pinned copy (a more
  descriptive anchor would help `/odorstrike` rank for "fabric odor spray").

## Design system pass 2: previews, forms, text tiers, contact (2026-10-11, owner: "use max efforts")
Deep audit of every section, state and form (full-page renders, checkout,
cart, menu, modals, form errors) plus NN/g form/contact guidance, Baymard line
length, WCAG 1.4.8. chrome.css **§13** holds it.
- **Link previews:** `og-brand.jpg` (the WhatsApp/Facebook preview for `/` and
  `/odorstrike`) said "CLOTHES · SHOES · HELMETS · GEAR" in the retired serif —
  a clothing-only violation on the two most-shared links; `og-image.jpg` (19
  pages) was the retired condensed type. Both replaced by
  **`assets/og/smelloff-share.jpg`** (1200×630, 113KB — keep it under 300KB or
  WhatsApp may drop the preview; no price, so it can't go stale). Source:
  `scripts/og/share-template.html.txt` (instructions inside; it is .txt because
  the generators walk every .html). The old two files now hold the same pixels.
  Seven posts that pointed at the generic banner use their own thumbnails;
  `config/product.json` brand.image → the share image, product.images → the
  collar photo (no text banner in Merchant images).
- **One form style** (checkout's, Baymard): visible 14px sentence-case label
  above a 52px field, lime focus ring — track order, contact, review modal,
  blog comments, both newsletters (were 11px grey capitals, 45–48px fields).
  The blog newsletter had no visible label (placeholder only) — fixed.
- **Bare `form{}`/`label{}`/`input{}` in contact's and track-order's inline CSS
  leaked into the shared footer** (newsletter became a bordered card with an
  all-caps label). Scoped to `#contactForm` / `#trackForm`; a test forbids bare
  form-element selectors in any page `<style>`.
- **Text tiers:** prose 660px wide, 17px from 768 (was 64–82 characters per
  line at 700px/16px; target 50–75). Tracked capitals only for labels of ≤4
  words; meta lines, captions and trust lines are sentence case (PDP pay lines,
  closing-band trust line, size captions, share "Copy link", blog buttons).
  `text-wrap:pretty` on prose, `balance` on headings. All buttons 15px.
- **FAQ "How to pay" was wrong:** it said COD is the default and "already
  selected"; checkout defaults to Pay online (`payMethod = 'prepaid'`). Now Pay
  online first; a test ties the FAQ to the checkout default.
- **Contact** (NN/g): WhatsApp + Email first, each with its response time and a
  direct action → the 5-field form → socials as a compact row → grievance
  notice. **Policies** end with three related-policy links (Baymard: people
  confuse returns and refunds). **404** has a guide search (`/blog?q=`; the blog
  index now reads `?q=`). Track order's review prompt and the review modal use
  tokens and sentence case (`reviews-system.js?v=4`).
- Homepage `#buy` and closing band: the secondary action is the "View product
  details" text link (was a second outlined button). Closing band on `/` and
  `/odorstrike`: same H2 size and order (button, then trust line). Homepage FAQ
  got its section label.
- `build-sitemap.mjs` now skips `public/` — a second local build had added
  every page again as `smelloff.in/public/…` to the committed sitemap.
- **Pass 3 (same day, from a full audit of the live site):** labels are two
  tiers only — section label 11.5px/500/.16em (§12, with the rule), card label
  11px/600/.14em (§12 list; colour by role: lime, Ice White for contents
  headers, muted for Sources). Folded in: "At a glance", the policy "On this
  page", "Read next", the homepage beta tag + formula chips, every post's
  Sources label (four markup variants, chrome.css §14). `.bc-cta`/`.agg-cta`
  = the ghost button (52px, 15px); skip link 15px; policy contents 15px/400
  like the blog's. PDP cites use "·" like the homepage. Tests pin them.
- **Local workflow:** commit before `npm run build`, then `git checkout -- .`
  restores only the build's transforms. Running it with uncommitted edits
  throws them away (it happened twice in this pass).

## One design system for every page (2026-10-11, owner: "consistent design everywhere, branding is important")
Audited all 77 pages (production build, computed styles at 390 and 1280, axe
WCAG 2.2 AA): six H1 sizes (52–83px), nine H2 sizes, 13 section-label styles,
21 button styles, inner pages a bare text column with an empty right half on
desktop. Research: NN/g heuristic 4 (one source of truth), NN/g table-of-
contents guidelines, NN/g 404 guidance, Baymard on policy jargon. **chrome.css
§12 is now the one definition** — add a page's classes there, don't restyle
locally.
- **Inner-page shell** (about, contact, reviews, track-order, faq, 404, the
  seven policies): `<header class="p-head">` = `.p-eyebrow` + one H1
  (`--fs-page-h1`, 34→56px) + `p.p-lede`; `.p-head--media` adds a photo card
  (About, 404; FAQ and Reviews desktop-only via `.p-head__media--desk`). Every
  inner page shares the site container, so labels and H1s start at the logo's
  left edge; prose stays at `--measure-page` (700px).
- **Policies** get `.p-grid`: `.p-aside` (first in the DOM) holds `.p-glance`
  ("At a glance": the policy in five plain lines, quoted from the page — never
  new terms) and `details.p-toc` ("On this page", numbered like the blog TOC).
  ≥960 the aside is a right rail; only the TOC is sticky and chrome.js lights
  the current section. Phones: glance first, TOC folded. **Edit a policy H2 →
  update its TOC entry** (`test/design-system.test.mjs` fails otherwise).
  Returns/cancellation glances must not state the COD amount.
- **Closing product card** `.sf-endcap`: generated by apply-chrome in its own
  `SF-CHROME:ENDCAP` block above the footer on pages with `endcap: true` (all
  inner pages except track-order). Price/MRP/discount come
  from `config/product.json`. It replaced the FAQ's lime bar, Reviews'
  uppercase buy band and the /solutions "cta-box".
- **Buttons:** `.sf-btn` / `.sf-btn--ghost` (52px, 8px radius, sentence case).
  Blog end-of-post: "Buy now — ₹229" + "View product details" text link in all
  56 posts (was "BUY NOW →" / "BUY ODORSTRIKE →" / "VIEW PRODUCT →").
- **404:** the H1 is the message ("This page aired out and left."), not the
  tiny "Page not found" label; metro photo; popular guides as `.p-links` cards.
- **apply-chrome fix:** every run left two empty `<noscript></noscript>` behind
  (pages had up to 14); it now removes them.
- Result (re-audit): H1 styles 6 → 3 (one shared + the two money-page heroes,
  on purpose), label styles 13 → 2 tiers, 0 axe violations on 77 pages, no JS
  errors, no failed requests. `npm test`: 300 pass (with `node_modules`
  installed; without it, 6 suites fail on missing deps — not the site).
- Running apply-chrome locally adds its build-only critical CSS and optimized
  logo; strip both before committing (keep markup + `?v=` stamps).

## Homepage hero v4: photo first (2026-10-11, owner asked for a redesign)
Supersedes "Homepage hero v3" below. The hero is the owner's photo of the
bottle misting a black shirt collar (`assets/photos/hero-spray-collar*`,
AVIF + WebP at 480/720/960/1254, from the original upload), not the bottle
cutout on a glow. Grounded in NN/g eyetracking (people study real product /
real-use photos, skip decorative ones), NN/g "Image-focused design" (a big
image only works if the buy action keeps equal weight) and the carousel
studies (one static image).
- **Phones:** full-bleed photo (`aspect-ratio:390/350`, no gutters), the
  three chips ride on it as glass pills (`.hero-not`, "Fabric only" filled
  lime), and the kicker + H1 overlap its faded bottom edge
  (`.hero-body{margin-top:-58px}`). Then sub, price, one button, link, trust
  row, Rohit's quote. CTA bottom: 686px at 390x844 (v3 706), 655 at 360x740.
- **>=768:** `.hero-inner` grid, copy left, the photo as a square card right
  with a faint lime glow; chips sit on the photo's bottom edge. Whole hero
  incl. the quote fits 1280x800 (CTA bottom 582).
- **LCP:** the photo, eager + `fetchpriority="high"`, AVIF set preloaded in
  `<head>` with the **same `imagesizes`** as the `<picture>` (a test compares
  them; a mismatch downloads it twice), inline blurred preview, and a
  transform-only settle-in (opacity would delay LCP). Measured LCP 130-200ms
  locally. The network-aware `sizes` script leaves the hero alone on purpose.
- Copy and claims are unchanged (tests pin them). The cutout is still used in
  the `#buy` offer box. `test/ux-guardrails.test.mjs` pins the above.

## Photos in the image slots (2026-10-11)
Owner-supplied photos fill the homepage `#why` beats (4) and the PDP's
`#how` steps (4), `#why` lifestyle and `#size` (3). Files are in
`assets/photos/` (WebP + `@640`/`@500`); each is an `<img class="ph-photo">`
in the old `.ph-img` box (same ratio, `object-fit:cover`, lazy). Only the
three homepage combo slots are still briefs.
- **Not used, clothing-only rule:** two gym-bag shots (one with sneakers) and
  a backpack in a car. Don't put them on the site.
- The before/after collar shot has "DRIES IN ~10 SECONDS · NO MARKS. NO
  RESIDUE." burnt in (both contradict the locked copy). Only its right half,
  above that pill, is used (`home-04-dried-clear`, `pdp-step-03-dried-clear`).
- The PDP size caption is "Fits a trouser pocket" (the photo is trousers,
  not jeans); the third size slot shows a jacket lining, not a desk.
- `test/ux-guardrails.test.mjs` checks every slot photo exists and has alt text.
- **PDP gallery tiles 2 and 4 are recut** with the same photos: tile 2 is
  `pdp-04-in-hand` (bottle next to a phone, 10.5 × 3 cm), replacing
  `pdp-04-pocket-size` ("GYM BAG" burnt in); tile 4 is `pdp-05-dried-clear`
  (just sprayed → dried, cropped above the "~10 seconds / no marks" pills),
  replacing `pdp-05-proof` (its unsupported "10,000+ customers ★4.8/5"). The
  old files stay in `/assets` unreferenced; don't put them back.
- Homepage beat photos are square under 768px (4:5 above).
- **Photos load per network** (owner asked, same day). Every slot photo and
  gallery tiles 2–3 are `<picture class="ph-pic">` (`display:contents`):
  AVIF first, WebP fallback, widths 400/640/960/full, and a ~350-byte blurred
  preview inlined as the img's background (`data-no-skel`, so no shimmer). A
  `<head>` script reads `navigator.connection`: Data Saver or 2G rewrites
  every `.ph-pic` `sizes` to `1px` (the 400w file), 3G to a mid size. It
  works because the photos are lazy and pick a file only after layout; don't
  make one eager without moving it out of `.ph-pic`. Measured on a 3× phone:
  PDP photos ~371KB on 4G, ~100KB on 2G. Variants are built from the
  original uploads, not re-encoded from the site's WebPs.
- **PDP gallery is five tiles** (owner, 2026-10-11): removed
  `pdp-03-how-to-use` ("10 SEC"), `pdp-07-fabric-only` and
  `pdp-08-comparison`. Their messages live in markup (`#how`, the
  fabric-only chips, `#compare`). Tests pin the five.

## Order-confirmation screen rebuilt; Google Customer Reviews removed (2026-10-11)
- `#successScreen` in `odorstrike.html` is rebuilt as: check + headline with
  the buyer's first name → order number with Copy → item + Subtotal /
  Shipping / COD handling / total → "Delivering to" + estimated arrival
  (`calculateDeliveryEstimate`) → numbered "What happens next" (COD and
  prepaid variants) → "Confirmation sent to <email>. Not in your inbox? Check
  Spam or Promotions." → Track your order (primary) / Continue browsing.
  `renderSuccessDetails()` fills it, with textContent only. The Payment Failed
  link shows on prepaid only.
- **Google Customer Reviews is gone** (owner's call): the opt-in popup asked
  buyers whether Google could email them a survey, right on the confirmation.
  Removed `assets/js/google-customer-reviews.js`, its call in `showSuccess()`,
  its `apply-chrome.mjs` stamp, its CSP allowances (`apis.google.com`,
  `www.gstatic.com`, `frame-src www.google.com`) and both `/privacy` mentions.
- An owner test order (SMF-20261011-9420) was reported as "no email". Resend
  shows it was delivered to Gmail (brxinee@gmail.com), so it landed in
  Spam/Promotions. SPF/DKIM/DMARC pass (DKIM aligned; DMARC `p=none`). A new
  sending domain needs a few opens / "Not spam" marks to build reputation.

## Shiprocket sync: every 15 minutes, new orders only (2026-10-11)
**Orders now reach Shiprocket within seconds** (owner asked, same day):
`pushOrderToShiprocketNow()` (in `api/shiprocket-sync.js`) runs when a COD
order is saved (`create-order`) and when a prepaid order is confirmed
(`verify-payment`, the Razorpay `webhook`, `payment-status`). It runs after
the response via `runAfterResponse()` (`api/_background.js`: `waitUntil` from
`cloudflare:workers`; awaited where that module doesn't exist, i.e. tests).
The cron below stays as the retry. The fulfilment claim stops a double
booking when several paths fire for one order.
`api/shiprocket-sync.js` (cron `*/15 * * * *` in `wrangler.jsonc`, mapped in
`src/index.js`) creates a Shiprocket order for each new site order and pulls
courier / AWB / status back into `orders`. It was daily (`0 10 * * *`).
- **Creates only for `placed` / `confirmed` / `packed`** (`CREATE_STATUSES`).
  It used to create for dispatched and delivered orders too, and the five
  hand-fulfilled orders delivered before Shiprocket was connected would have
  been booked as new shipments on the first run. Delivered orders are no longer
  sync candidates at all.
- **Fulfilment emails go out only on a status change.** Before, every sync
  re-sent "Shipped" / "Out for delivery" / "Delivered" for any order in that
  state (Resend's idempotency key lasts only 24 h).
- **Review requests are sent once per order**: `dispatchDueReviewRequests`
  checks `email_events` for a non-failed `reviewRequest` first (it fails closed).
- Needs `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` (the API user
  `info@smelloff.in`, made under Settings → API Users; not the login) and
  `CRON_SECRET`. Defaults match the live account (company 11447397): pickup
  `sanathnagar` (Hyderabad 500018), channel CUSTOM `12051492`. The old defaults
  ("Opposite ANcorner bakery", `41464314146431`) were from another account and
  would have failed every create. Override with `SHIPROCKET_PICKUP_LOCATION` /
  `SHIPROCKET_CHANNEL_ID`. A wrong pickup name fails with the list of names the
  account has.
- Shiprocket's own tracking webhook (Settings → Webhooks) is not used: the site
  has no endpoint for it, and the 15-minute sync polls tracking instead.
- Cancel test orders before turning it on: the sync pushes every `placed` /
  `confirmed` order.
- **A failed login stops the run** (first `authentication failed` result breaks
  the loop). Before, every order logged in again, so one wrong password cost
  eight attempts per run and Shiprocket blocked the user ("User blocked due to
  too many failed login attempts"). That happened on 2026-10-11 with the main
  account login in Cloudflare. The API refuses the main login anyway (it also
  failed on 2026-09-25); only the API user works.
- On 2026-10-11 the live Worker kept running the pre-#470 sync code after the
  merge: it still scanned delivered orders. The likeliest cause is saving
  variables in the Cloudflare dashboard around the same time, which can
  redeploy the version the dashboard had loaded; that was not confirmed. If
  `/api/shiprocket-sync` results list delivered orders, the old code is live.
  Redeploy main.
- **COD orders reach Shiprocket with the ₹89 fee as `transaction_charges`**,
  so the courier collects ₹318. Before, it sent 0 and Shiprocket's order total
  (the COD amount the courier collects) was ₹229. Verified against the live
  API: fee in `transaction_charges` → total 318; fee in `sub_total` → 407
  (double-counted). Prepaid orders send 0 and `cod: 0`.
  `test/shiprocket-payload.test.mjs` pins it.
- **Cancelling in the Shiprocket panel closes the order on the site.** An
  order with no AWB yet is read via `/orders/show/{id}` (status `CANCELED`,
  code 5; it also carries the AWB once assigned). It was read via
  `/shipments/{id}`, which only returns a numeric status, so a cancellation
  never reached the site and the order stayed open and was re-synced forever.
  Only `placed` / `confirmed` / `packed` orders are closed
  (`CANCELLABLE_STATUSES`). No customer email is sent: the owner cancelled it,
  and a paid order's refund is a separate decision.
  `test/shiprocket-cancel-sync.test.mjs` pins it.
- **`/api/health` now reports `build.commit`** (stamped by
  `scripts/write-build-info.mjs` during `npm run build` from
  `WORKERS_CI_COMMIT_SHA`, else git). After every merge, check that it matches
  main's head before trusting the deploy. `src/build-info.js` is committed with
  `"dev"`; a local build rewrites it (restore with `git restore .`).

## Owner alert for every order, COD included (2026-10-11)
COD orders sent the owner nothing: `sendAdminNewOrderEmail` only ran from the
Razorpay webhook (prepaid). `api/create-order.js` now awaits it on the COD
branch right after the row is saved (server-side, so it goes out even if the
customer closes the tab; best-effort, capped at 4 s, idempotency key
`admin-new-order/<code>` absorbs retries). Prepaid is unchanged (webhook sends
adminNewOrder + adminPaymentConfirmed).
- `adminNewOrder` subject: `New order · ₹318 COD · Name, City · SMF-…`; body has
  one-tap **Call** (`tel:`) and **WhatsApp** (`wa.me`) buttons, next steps, and
  "Open in admin" (`/admin#orders`).
- Goes to `getSenderConfig().adminNotify` (`ADMIN_NOTIFY_EMAIL` →
  `ORDERS_NOTIFY_EMAIL` → info@smelloff.in, which Cloudflare forwards).
  This supersedes the "COD orders still send no admin email" line below.
- Test: `test/checkout.test.mjs` "a COD order emails the owner a new-order alert".

## Transactional email redesign (2026-10-11)
`api/_email-templates.js` (all 17 Resend templates) now uses the site's palette
and type. Light receipt canvas (Gmail's apps invert colours and ignore
`prefers-color-scheme`); Apple Mail gets the site's dark theme from the
`@media (prefers-color-scheme: dark)` block in `shell()`.
- Carbon Black header band with `assets/email/logo-on-ink.png`. The logo has
  its own black background baked in so it can't vanish when a client inverts
  the band. Product thumb: `assets/email/odorstrike-bottle-thumb.png`. Both are
  PNG (Outlook has no WebP).
- Components: lime kicker pill (`hero(text, label)`), order-journey `tracker(i)`
  (Confirmed → Shipped → Out for delivery → Delivered) on the lifecycle
  emails, bulletproof lime `button()` (full width on phones), `productRow`,
  totals via `kvRow(…, true)` (heavy rule; keep it the last row), `infoColumns`,
  numbered `nextSteps`, and a contact panel (`helpPanel`: reply / info@ /
  WhatsApp) on customer emails (`shell(…, { help: false })` for admin).
- Lime is only ever a fill under black text. Space Grotesk / Inter load from
  Google Fonts where allowed; Gmail/Outlook fall back to Helvetica/Arial.
- Admin links go to `https://smelloff.in/admin` (`admin.smelloff.in` returns
  403). Emails are 8–17KB, far under Gmail's 102KB clip.
- Not changed, needs the owner: the sender name is "ODORSTRIKE" (not
  "Smelloff"); the ETA copy says "Typically 3–7 days" while `/shipping` says
  dispatch within 48 h + 3–10 business days. COD orders still send no admin
  "new order" email: `dispatchCodPlacementEmails()` exists but nothing calls it.

## Type: Space Grotesk + Inter (2026-10-11, owner's call)
"Headings: Space Grotesk. Body text: Inter. Keep the hierarchy." Display =
**Space Grotesk** (variable 300–700; headings and prices at **700**, rules
that ask for 800 render at 700); body, labels and buttons = **Inter**
(variable 100–900; body 400, labels/sub-heads 500, emphasis 600, light 300).
Both SIL OFL 1.1, self-hosted from Fontsource (`assets/fonts/*-wght.woff2`,
licences in `assets/fonts/OFL-space-grotesk.txt`, `OFL-inter.txt`). Replaced
Bricolage Grotesque + Geist (same day; their files are deleted) and
supersedes Fraunces / Inter Tight / JetBrains Mono in the notes below.
- Declared in **two** places, same block: `assets/fonts.css` and the inline
  `<style>` in `index.html`. Tokens `--display` / `--body` / `--mono` (mono =
  Inter, tracked uppercase labels) in all three TOKENS copies; heading
  tracking `--ls-display -.025em`.
- ₹ is carved out of latin-ext and served from ~1KB `*-rupee-wght.woff2`
  subsets (pyftsubset `--unicodes=U+20B9`). Fallbacks `'Space Grotesk
  Fallback'` / `'Inter Fallback'` (local Arial, size-adjust 105.79% /
  105.86%, computed against Liberation Sans) keep the swap CLS-free.
- Preloads on `/` and `/odorstrike` and the service-worker precache (`sw.js`,
  VERSION v34) point at the two latin files. A page loads ~72KB of fonts.
- Pages use the tokens, not family names (`var(--display)` / `var(--body)`);
  `blog.css`'s `--font-*` fallbacks name the new families. The Fraunces files
  stay in `assets/fonts/` only for `scripts/thumbnails/`.

## Brand palette: Carbon Black · Ice White · Signal Lime (2026-10-11, owner's call)
"Use these and don't make it too pale." **`--ink #0A0A0A`** (Carbon Black),
**`--text #F2F5EF`** (Ice White), **`--acid #B8FF57`** (Signal Lime), in all
three TOKENS copies. Surfaces `#121212` / `#1A1A1A`; greys re-tinted cool
(`--muted #9DA398`, `--text-2 #CDD3C8`); hairlines are `rgba(242,245,239,…)`.
Supersedes the colour half of the quiet pass below (its type and layout stay):
- **`--cta` is Signal Lime** (hover `--acid-hi`) — every primary buy button.
- Lime is back on: heading accent words (`chrome.css` §11), section labels
  (soft.css §9, `.sf-eyebrow`), the ticker text, "54% OFF" (filled pill),
  the "Fabric only" chip, nav current underline, cart badge, FAQ +/−, list
  bullets, link underlines, PDP compare header, checkout's active payment
  option, blog category pills/active topic chip, photo-slot labels, and a
  lime glow behind the bottle.
- Still not lime: full-width bands (offer strip, ticker background, final
  band) and the consent bar's Accept (Ice White, so it doesn't out-weigh
  Reject). Emails (`emails/`, `api/_email-templates.js`) keep their own palette.
- `test/ux-guardrails.test.mjs` pins the tokens.

## Price back to ₹229; COD handling ₹89 (2026-10-11, owner's call)
- **₹229 prepaid** (was ₹299), MRP ₹499 → **54% off**. COD handling charge
  **₹89** (was ₹60) → **₹318** collected for one bottle. Supersedes the prices
  in "Price ₹299; COD amount only in checkout" below; its rule on *where* the
  COD amount may appear still holds.
- Source: `config/product.json` (price/paise, discountPercent, codFee/paise,
  priceCod/paise). Copies: `CFG.PRICES.solo` / `CFG.COD_FEE` in
  `odorstrike.html`, the chrome.js fallback, the PDP `product:price` meta.
  Schema, `products.json`, `merchant-feed.xml` regenerated (`npm run schema`).
- Derived blog maths: ~₹0.92 per spray, ~₹2.29 per refresh, ₹4.58 per ml,
  ₹1.83–2.86 per use, ~₹7.39 per day.
- **Checkout does not use the Supabase `create-order` edge function.** Both
  checkout paths (`odorstrike.html`, `chrome.js`) POST to the Worker's
  `/api/create-order`, which writes `rest/v1/orders` directly with prices from
  `config/product.json`, so a price change ships with the site. The deployed
  edge function (v5) is a stale standalone copy that hard-codes 299 / 60 and
  nothing calls it; redeploy or delete it before anything starts using it.

## Quiet premium pass + placeholders back (2026-10-11, owner's call)
"Too bold — conservative, premium, modern." Palette unchanged; the accent
became a detail instead of a surface. **Supersedes** the placeholder hiding
in "UX pass from a live render" below and the acid/mono/900 rules in older
sections.
- **Photo slots are visible again** (`.ph-img`, `#combos`, `#size` — no
  `display:none`, no `hidden`), restyled as quiet hairline cards with the brief
  in grey. Swap each div for an `<img>` of the stated ratio when shot.
- **Type:** Fraunces **500** everywhere (was 900; the face is variable 400–900).
  Smaller heading scale, `--lh-display 1.08`. `--mono` now resolves to Inter
  Tight — labels are tracked sans, not JetBrains Mono (its preload is gone).
  Accent words in headings render grey (`chrome.css` §11), not acid.
- **Buttons are paper white** (`--cta #F4F1EA`, `--on-cta`, `--cta-hi`, in all
  three TOKENS copies), sentence case, body face — soft.css §9. Copy is
  "Buy now — ₹299" (was "FIX MY SHIRT" / "GET ODORSTRIKE"); tests and the
  audit pin the new text. Chips read "Not perfume · Not body deodorant ·
  Fabric only".
- **No acid bands:** offer strip, ticker and the homepage final band are dark
  with hairlines; hero/offer acid discs and glows are faint warm light. Acid
  stays for the eyebrow rule, the "40% off" outline, focus rings and the PDP
  timer ring. `test/ux-guardrails.test.mjs` pins it.
- **Second pass (same day):** blog index + `blog.css` (category pill, links,
  drop cap, quick-answer card, TOC, end-of-post box, quiz), policy-page
  template, `/faq` (CTA, WhatsApp strip, grievance line), `/404`,
  `/solutions/*` (buy button, answer box — its label is now "Quick answer",
  not "AI Search & Answer Engine Summary"), checkout/cart (pay button reads
  "Pay ₹299 securely" / "Place COD order · ₹359", neutral delivery box and
  payment options), the review modal and the blog comments widget. Hard-coded
  `'JetBrains Mono'` became `var(--mono)`. The consent bar's buttons are
  sentence case in all four copies. Emails (`emails/`) still use acid —
  that's a separate template system.
- Fixed on the way: the blog index had the "Founder story" chip twice, and
  `.b-about` cards overflowed a 320px screen by 19px (grid items without
  `minmax(0,1fr)`).
- `apply-chrome.mjs` is a build transform (critical CSS + optimized logo):
  after running it locally, revert those two bits and keep only the `?v=`
  stamps — or let the cache-buster bot do it.

## UX pass from a live render (2026-10-11)
Rendered `/`, `/odorstrike`, checkout, `/blog`, a post and `/faq` at 390×844
and 1280×800 from a production build. Fixed:
- **Photo placeholders were live.** Every `.ph-img` slot showed customers a
  dashed box reading "IMAGE 01 · 4:5 · 1200×1500 · WebP", and the homepage
  combo cards read "Combo name / ₹ —". `.ph-img{display:none !important}` on
  both pages (a real `<img>` has no `.ph-img`, so a swapped-in photo shows);
  a beat or `.pd-fix` with a hidden slot goes single-column. `#combos` (home)
  and `#size` (PDP, three empty slots) carry `hidden` until they have content.
  Pages are ~2,600px (home) and ~1,150px (PDP) shorter on phones.
- **Prohibited claims on the money pages:** "no white marks" (home beat 4,
  home step 2, PDP hero bullet, PDP why-list) and "Anti-regrowth" (home
  layer chips) → the approved "dries clear with no stiff residue" and
  "Sustain". 23 posts' product boxes said "zero residue"/"residue-free" →
  "no stiff residue"/"dries clear". Left alone: first-person test results in
  the 30-day review and the founder's story; the ~10-second dry time (owner).
- **Consent bar 197px → 148px on a 390px phone** (73px desktop): shorter
  sentence, Accept and Reject side by side at equal weight (`flex:1 1 130px`)
  in all four copies + chrome.css.
- **Checkout delivery date ignored dispatch.** It promised arrival 3–5
  business days from the order; dispatch is "within 48 hours", so the late
  date now adds 2 (`DISPATCH_DAYS`): a Saturday order reads Wed 14 – Tue 20.
- `test/ux-guardrails.test.mjs` pins all four.

## Price ₹299; COD amount only in checkout (2026-10-11, owner's call)
- **₹299 prepaid** (was ₹229), MRP ₹499 → 40% off (was 54%). COD adds the same
  **₹60 handling charge → ₹359** for one bottle. `config/product.json` is the
  source (price, paise, priceCod, discountPercent); `CFG.PRICES.solo` in
  `odorstrike.html` must match. Schema, `products.json` and
  `merchant-feed.xml` are regenerated from it (`npm run schema`).
- **Outside checkout the site says only "Cash on Delivery available."** The ₹60
  and ₹359 appear on the COD payment option in the checkout modal (its own
  total, before "Place order"), in the checkout summary, and in the policies
  (`/shipping`, `/refund`, `/faq`, plus terms/privacy). `track-order` shows
  what an order was charged. This **supersedes** "It must be visible before the
  checkout modal opens" in "COD carries a ₹60 handling charge" below.
  The floor that still applies: the amount must be on the COD option before
  the order is placed — never first in the final summary or after placing.
  `test/cod-checkout-regression.test.mjs` pins both sides.
- **The Supabase `create-order` edge function bundles `config/product.json` at
  deploy time.** Until it is redeployed it still expects ₹229 and rejects every
  ₹299 order as "Order total mismatch". Deploy it together with the site.
- Blog cost maths moved with the price: ~₹1.20 per spray, ~₹2.99 per refresh,
  ₹2.40–3.75 per use. The `products` table seed in
  `supabase/migrations/20260711_products_catalog.sql` still says 22900; nothing
  reads it.

## Search Console fixes: one host, merchant data from one file (2026-10-10)
From the GSC export (Apr–Oct 2026: 687 clicks, 24.5k impressions; product
snippets 631 impressions, review snippet 17, merchant listings 2):
- **www.smelloff.in served every page with a 200**, so Google indexed 56 pages
  twice and split their signals (`/` 299 clicks + `www/` 201). The Worker now
  301s www and http to `https://smelloff.in` (`src/canonical.js`), and turns the
  asset server's **307** for `/page.html` and `/page/` into a 301 (14
  trailing-slash URLs were indexed). For that, pages reach the Worker first:
  `run_worker_first: ["/*", "!/assets/*"]`. `env.ASSETS.fetch()` still applies
  `_redirects`, `_headers` and `html_handling` (verified in wrangler dev).
  **`/api/*` is never redirected** — a 301 turns webhook POSTs into GETs.
- Eight slugs that look AI-mangled (`which-fabric-holds-odor-most`,
  `why-traffic-fumes-cling-to-cloth`…) 404'd; each now 301s to the real post.
- **Structured data is generated**: `scripts/seo/apply-structured-data.mjs`
  stamps `#org-jsonld`, `#website-jsonld` and `#product-jsonld` into `/` and
  `/odorstrike`, and writes `products.json` and **`merchant-feed.xml`** (Google
  Merchant Center RSS feed, taxonomy 6240 Fabric Refreshers) from
  `config/product.json`. `npm run build` fails if they're stale — edit the
  config and run `npm run schema`. The PDP had two different blocks sharing
  `#organization`; it is now one `OnlineStore` with the return policy on it.
- Shipping schema now says what `/shipping` says: handling 0–2 days (dispatch
  within 48 h, Mon–Sat), transit 3–10 business days. It said 0–1 / 2–7.
- **Only `/odorstrike` carries a Product.** `where-to-buy-odorstrike-india` had
  a second Product with the same @id and an offer URL on the homepage; the
  30-day review post marked the founder's own 9.6/10 as a `Review` of our
  product, and the four `/solutions/*` pages each nested a full Product +
  Offer (with the old 0–1 / 2–7 day shipping) as `mainEntity`. All removed (the Articles now point at the product via `about`).
  Review stars need real verified-buyer reviews — `buildProductJsonLd()` takes
  `includeRating` for when they exist; never fill it from beta quotes.
- `/refund` said "there is no COD handling fee". Corrected to ₹60 / ₹289.
- Not changed, needs the owner: `/returns` says the seal must be intact,
  `config/product.json` says "at least 80% full" — pick one. Whether the ₹60
  COD charge is refunded on a return isn't stated anywhere.
- Merchant Center: add `https://smelloff.in/merchant-feed.xml` as a scheduled
  file feed, and set shipping (free, India) and returns (7 days) in the account
  so they match the feed.
- `test/structured-data.test.mjs` pins all of the above.

## Conversion rebuild, modelled on dudewipes.com (2026-10-10)
The homepage was rebuilt from scratch (100KB → ~64KB). Palette, fonts and
tokens are unchanged. The idea taken from dudewipes: **few sections, one loud
claim each, and a buy CTA under every one.** Order: hero → ticker → `#how`
(Spray. Wait. Wear.) → `#why` (four claim + CTA blocks, "Your skin has a fix.
Your shirt didn't.") → `#reviews` (beta testers, verbatim) → `#buy` (offer
box: price, COD ₹289, shipping, returns) → founder strip → `#faq` → final band.
- **Removed:** "Your shirt remembers" (the scrubber — the signature-section
  notes below describe it historically), the zone cards, benefits strip,
  featured-product block and the science/INCI section. The full INCI list
  still lives on `/odorstrike`.
- Every CTA points at `/odorstrike?buy=1`. The sticky mobile bar shows only
  while neither the hero CTA nor `#offerBuyBtn` is on screen.
- Classes are `hm-` prefixed so `soft.css` (which restyles `.btn-ghost`,
  `.price-card`, `.tag`…) can't reach in. FAQ markup still uses the shared
  `details.faq-item` accordion.
- The one photo is `pdp-02-problem@640`, cropped `aspect-ratio:3/5` from the
  left so the creative's burnt-in "Kills odor" bullets never show. **Don't use
  the other gallery creatives on the homepage** — their pixels carry "10 SEC",
  "leather" and (`pdp-05-proof`) "TRUSTED BY 10,000+ CUSTOMERS ★4.8/5", none of
  which match this site's copy. The last one is on the PDP gallery today and
  needs a recut — it is an unsupported social-proof claim.
- `chrome.css` §7 ("mobile homepage hero visibility fix") is gone. It forced
  `padding-top:84px` on **every** `.hero` under 768px, including the PDP's,
  undoing the PDP fold work below.
- **PDP:** the buy button had drifted to y=1208 on 390×844. Now ~880 with the
  price at ~735 (meta row hidden on phones, tagline cut to three lines,
  badges on one row, compact price box; gallery untouched). Removed the
  `problem` tiles, the animated before/after "proof" dots (an illustration
  posing as evidence), the share widget under the CTA and the field-guides
  strip; reviews moved up to sit right after the showcase. Page is ~3100px
  shorter on phones.
- **Placeholders, pending photography and combos.** The four `#why` visuals
  and the `#combos` cards are `.ph-img` / `.ph-text` boxes whose labels are
  CSS-generated from `data-ph*` attributes (so nothing reads as a real offer
  to crawlers). Swap a `.ph-img` div for an `<img>` of the stated ratio.
  **Combos are planned but not built**: the "₹229 solo is the ONLY SKU" rule
  below still describes checkout. Before any combo goes live, `CFG.PRICES`
  in `odorstrike.html`, `products.json`, `shared/product-truth.js` and
  `supabase/functions/create-order` must all learn it — the edge function
  rejects any total it doesn't recognise. Never reuse the retired
  Duo ₹399 / Trio ₹549 prices; the audit fails on them.
- Homepage tests in `test/product-config.test.mjs` now pin guardrails (one H1,
  COD disclosed in hero, beta-tester labels, no ratings, clothing-only, no
  concentrations) instead of the old copy line by line.

## Header + sticky buy strip (2026-10-10)
- **Offer strip** above the header on every page (acid band, inside the
  `SF-CHROME:HEADER` block): "Free shipping on prepaid · Cash on Delivery ·
  7-day returns" — the cart-abandonment reasons we can answer up front. Not
  sticky; the tail hides under 380px.
- **Header (v2, owner's call: taller, no Buy button):** phones = burger ·
  centred logo (26px) · cart, 72px tall; ≥900 = logo (32px) · centred nav
  (Shop · Guides · Reviews · FAQ · Track order) · cart, 84px. Current page
  gets an acid underline (`aria-current`, set by chrome.js). Shadow appears
  once scrolled (`.is-scrolled`). The phone menu opens with a product card,
  then the pages, then WhatsApp. **Things sticky under the header use those
  heights:** blog topic bar `top:72/84px`, PDP gallery `top:100px`, blog TOC
  `top:104px` + `scroll-margin-top:104px`. Change them together.
- **Nav bar v3 (2026-10-10, NN/g hamburger research):** the burger reads
  "Menu" (icon-only menus are found and used less); the logo stays centred
  via `grid-template-columns:1fr auto 1fr`. Desktop cart reads "Cart" with
  the count inline. The phone menu is now a **full-height layer** under the
  bar (`position:absolute; top:100%` of the sticky header; chrome.js sets
  `--sf-menu-h` to the space left below it): product card, five rows with an
  icon + one-line hint, a WhatsApp card, perks. `html.sf-menu-open` hides the
  consent bar and the buy strip. **Don't lock scroll with
  `html{overflow:hidden}`** — with `body{overflow-x:hidden}` it makes body
  the scroll container and the sticky bar jumps off screen; the layer uses
  `overscroll-behavior:contain` instead.
- **Buy strip (`.mobile-bar`, homepage + PDP)** is styled once in
  `chrome.css` §1b: a floating card 10px off the edges (Baymard: space around
  a sticky buy button, not full width) with thumb, name + price, "Free
  shipping · COD +₹60", one button. Pages still decide when it shows. The PDP
  lifts it above the consent bar (`setBottomOffset`, +10px gap).
- **Generator fixes found on the way:** `apply-chrome.mjs` only looked 400
  chars back for the HEADER marker — with the strip in the block it stacked a
  new copy every run (one run put 5 strips on 77 pages). Now 3000, bounded by
  the previous close marker. The critical inline CSS in that script was
  updated for the new header. `apply-share-templates.mjs` inserted at "+2
  chars past" a tag and fell back to `</head>`, which fought apply-chrome for
  the same spot; it now inserts right after the tag and otherwise above the
  shared-layers block.

## Footer redesign (2026-10-10, NN/g "Footers 101")
- Order: **help band first** (WhatsApp / Email / Track order — contact is
  the top reason people scroll to a footer; three icon tiles on phones),
  then logo + one-line pitch + **newsletter signup**, the three link columns
  (Shop · Help · Company, still three-across on phones), socials + payment
  chips (UPI, Visa, Mastercard, RuPay, Net banking, COD), then the legal
  line and the trademark disclaimer in sentence case (they were tracked
  mono caps). Footer is ~1,050px on a 390px phone.
- The signup is handled in `chrome.js` (`[data-sf-news]`): same `waitlist`
  table + public anon key + `resolution=ignore-duplicates` as the blog index
  form, `source: 'footer'`. CSP connect-src already allows Supabase.
- **Keep the trademark disclaimer on every page** (Merchant Center
  misrepresentation policy — see the comment in the template).

## PDP simplified — less text, image slots (2026-10-10)
Following Baymard's product-page research (highlights over paragraphs, an
"in scale" image — 42% of shoppers try to judge size from photos — and
lifestyle shots). Page is ~1,000px shorter on phones.
- **Hero:** one-line tagline + three highlight bullets above the price; the
  long tagline and the four-item list below the CTA are gone. Phones hide
  `.pd-pack`, shrink the chips and show the gallery at 68% so **Buy still ends
  ~841px on 390×844** — re-measure if you add anything above it.
- **Sections now:** strip → `#how` (4 one-line steps, each with a square
  image slot; the ring still counts 30 s) → `#why` (lifestyle slot + 3
  reasons + the comparison table, `#compare` id kept) → `#size` (3 in-scale
  slots: jeans pocket, in hand next to a phone, on a desk) → reviews →
  science (one line per ingredient) → `#buy` → FAQ → final.
- **Removed:** "Moments you can't rewash for" (use cases), the stat cards,
  the email capture (and its `submitWaitlist()` JS), two buy-box lines
  (sprays/8 h — both still in the specs/hero).
- **Image slots are `.ph-img`** — same pattern as the homepage: the label is
  CSS from `data-ph-n/data-ph/data-ph-spec`; replace the div with an `<img>`
  of the stated ratio (1:1 for steps, 4:5 for lifestyle/size). Shoot to the
  clothing-only rule: shirt, never skin; pocket/hand/desk, never a gym bag.

## Blog redesign — index + all 56 posts (2026-10-10)
Grounded in NN/g reading research: people scan by headings (layer-cake), want
the answer first, and use a TOC on long pages.
- **`/blog` index** — inline CSS rewritten; hero with one search, a lead story
  beside a "New here? Start with these" rail, a **sticky topic filter with
  counts**, and a grid that shows **12, then "Show all 56 guides"** (search and
  topics always cover every post). Page went ~10,900px → ~4,300px on desktop.
  The product band's copy said "10-second dry", "0% stain" and "free express
  shipping" — replaced with the locked claims (15–30 s, free on prepaid, COD
  +₹60) and its second button now goes to `/odorstrike`, not `/#buy`. The
  search empty-state escapes the query before putting it in innerHTML.
  Category counts on the chips are computed at build time by the transform —
  **update them with the post count** (same rule as the hero pill note above).
- **Posts: `scripts/blog/apply-reader.mjs`** (idempotent, `--check` in
  `npm run build`) stamps, per post: a TOC from the post's own `<h2>`s between
  `<!-- TOC:START/END -->` (static — no JS needed, no layout shift), ids on
  those h2s, an author byline, the bottle + "View product" link in the
  `.end-cta`, a scroll wrapper around every `<table>` (13 bare tables pushed
  phones 4–50px wide), and `track.js` + `consent-analytics.js` on every post
  (**34 posts had no first-party beacon and 9 no consent bar**). It also
  deleted five copies of an inline progress-bar script. Run it after adding or
  editing a post.
- **`blog.css` rewritten**: 18px body, 720px measure, acid upright accent in
  H1 (was a grey italic), quick-answer card, callouts, unified tables. At
  ≥1160px the TOC is a **sticky float in the right gutter** — not an absolute
  rail with a sticky list, because Chrome wraps `<details>` content in its own
  box and the list can't stick outside it.
- **`blog-share.js`** now also runs the one progress bar, opens the TOC on
  wide screens, lights the current section, and wires the
  `odorstrike-vs-febreze-india` quiz (its buttons had no script at all).
- Not changed, flagged: several older posts still say "dries in under 10
  seconds" / "10-second dry" and one quotes "pH 5.5–6.0"; the product pages
  say 15–30 seconds. Decide which is true and align the posts.

## Checkout redesign, against Baymard (2026-10-10)
The `#checkoutOverlay` markup and its CSS block were rewritten; the checkout
JS (orderTotals, submitOrder, Razorpay in chrome.js, COD path) is unchanged
apart from what's listed. Rules it follows, from Baymard's checkout research:
- **Contact → delivery → payment, one column.** Payment moved below the
  address. A test pins the field order and the count: **7 fields** (Baymard's
  benchmark average is 11.3). Don't add one without removing one.
- **Pincode before city/state; they autofill from it and stay editable**
  (postalpincode.in lookup now fires `change`, so they show as valid).
- **Inline validation** (`CK_RULES`, `ckCheck`): on blur once a field has a
  value, cleared live as it's fixed, messages say what to do. `validateForm()`
  still gates submit; its errors no longer show the WhatsApp "help" link
  (that's for failed orders). Phone/pincode strip non-digits and a pasted
  `+91`/leading `0` — the old `maxlength` truncated pasted numbers.
- **Each payment option shows its own total**, recomputed from
  `orderTotals()` for the quantity (they were hard-coded to one bottle).
- **The pay bar is solid and sticky.** It used to be a transparent gradient
  that sat on top of the address field. The overlay has no bottom padding on
  purpose — sticky pins to the scrollport edge and padding showed form under it.
- Labels are sentence-case body text; phones get a full-height sheet.
- Note: earlier sections say COD is the default payment method. The code
  defaults to **prepaid** (`payMethod = 'prepaid'`) and was already that way
  before this change.

## PDP redesign + "View product" route + icons (2026-10-10)
- **Two routes from the homepage, on purpose.** Every buy CTA still goes to
  `/odorstrike?buy=1` (checkout opens). Beside the hero, offer-box and final
  CTAs there is now a ghost `.hm-btn--ghost` "View product" → plain
  `/odorstrike`, and the hero bottle links there too. Plain `/odorstrike`
  never opens checkout. A test pins both routes.
- **`odorstrike.html` body was rebuilt** (hero → icon strip → `#how` →
  `#why` → `#compare` → `#reviews` → `#science` → `#uses` → `#buy` → `#faq`
  → final). All new CSS is one `pd-`-prefixed block in the page's `<style>`;
  ~1,300 lines of old body CSS (and the dead fixed-`nav` rules) are gone.
  Checkout, cart drawer, viewer and consent CSS are untouched.
  - Kept IDs the JS drives: `gallery`, `galDots`, `galCur`, `pdpQty*`,
    `pdpBuyBtn/Text`, `pdpCartBtn`, `showcaseBuyBtn` (now the `#buy` box
    button), `finalBuyBtn`, `reset30` + `r30-*`, the proof mounts, `mobileBar`.
  - Gallery is one swipe row at every width; ≥768 it is one tile + an
    8-thumbnail strip (`.pd-thumb`, synced in the gallery indicator JS), and
    the gallery column is the sticky one. Phone hero: Buy ends ~837px on
    390×844 — crumbs and stock pill hide <768 to get it there.
  - The step-03 ring now counts the real 30 seconds (it ran 30→0 in 15 s).
  - `#compare` is the gallery's deo/perfume tile as real markup. Keep its
    competitor cells modest — no claims about what they *can't* do beyond
    "not made for it".
- **Icons are an inline SVG sprite** (`<symbol id="i-…">`, Lucide-style
  stroke, `currentColor`) at the top of each page's body, used as
  `<svg class="ic"><use href="#i-…"/></svg>`. No icon font, no request. Each
  page's sprite is trimmed to the ids it uses — **add the `<symbol>` when you
  add a `<use>`** (a test checks the PDP).
- **Fixed: `chrome.js` overwrote the PDP's `.pay-modes`** ("Cash on Delivery
  +₹60") with "UPI · Cards · Netbanking" on every load — it was meant for a
  checkout element that no longer exists, and it silently removed one of the
  required COD disclosures. Deleted.
- `.pd-btn` / `.pd-card` joined the soft.css §9 lists. Consent-bar privacy
  links are underlined in all three copies (axe link-in-text-block).

## Ponytail audit fixes (2026-10-10)
Ran the Ponytail (`DietrichGebert/ponytail`) repo audit; the plugin is
installed for Claude Code (`/ponytail-audit`, `/ponytail-review`). Fixed:
- **`welcomeEmail` is admin-only now.** Unauthenticated, `/api/send-email`
  sent our welcome email to any address a script supplied (the Origin check
  passes when there is no Origin, and the rate limits are per Worker
  instance). The footer waitlist still saves the address; it just no longer
  emails. Bring it back only with a double opt-in.
- **Order-number collisions.** The browser draws `SMF-<date>-NNNN` from 9,000
  per day; a second customer drawing a taken number got "checkout session is
  no longer valid". `create-order` now keeps the number if it is free or
  this customer's (a retry), else picks a fresh one with `crypto.randomInt`;
  the browser already uses the returned `order_code`. Test in
  `test/checkout.test.mjs` fails without the fix.
- Deleted the unused Razorpay Magic Checkout endpoints
  (`magic-checkout-finalize.js`, `magic-checkout-shipping-info.js`, ~360 lines).
- Known shortcut, not changed: `checkRateLimit` is an in-memory Map, so it
  counts per Worker instance. Fine at this load; needs a shared store (KV /
  Supabase) only if abuse shows up.

## Vercel / Netlify bots on PRs (2026-10-10)
The repo holds **no** Vercel or Netlify config (`audit-production.mjs` fails if
`vercel.json`, `middleware.js` or `netlify.toml` comes back). The "Vercel –
smelloff / smelloff-6v6v: Error" checks and the Netlify
`spontaneous-longma-4f03b5` rows come from those services' **GitHub Apps**,
still installed on the account. They can only be removed by the owner:
github.com/settings/installations → Vercel / Netlify → Uninstall (and delete
the projects in each dashboard). Nothing in the repo can stop them. Cloudflare
Workers Builds is the only deploy.

## One email address: info@smelloff.in (2026-10-10)
Owner's call: every address on the site and in the email system is
`info@smelloff.in` — it replaced `smelloffsupport@gmail.com` (contact links,
footer, schema, policies, llms files, email templates, Reply-To) and
`orders@smelloff.in` (the transactional From, `DEFAULT_FROM` in
`api/_email.js`, `send-email.js`, the payment follow-up script). Same domain,
so SPF/DKIM/DMARC alignment is unchanged. **Two things live outside the
repo:** Cloudflare Email Routing must forward `info@smelloff.in` to the
founder's inbox, and an `EMAIL_FROM` / `EMAIL_REPLY_TO` Worker variable, if
set, overrides the code defaults. Test fixtures (`buyer@…`) are unchanged.

## Phone menu: left drawer, icon-only burger (2026-10-10)
- **The menu did not open in production.** The build's inlined critical CSS
  (`criticalChrome` in `apply-chrome.mjs`) set `.sf-hdr__menu` to
  `max-height:0;overflow:hidden`; chrome.css never reset `max-height`, so the
  menu opened 0px tall — only on the live site, because that CSS is a
  build-time transform and local runs never had it. **Test UI changes with
  the build transforms applied** (`npm run optimize:critical && node
  scripts/apply-chrome.mjs`, then revert). A test now guards the rule.
- Owner's call: the burger is **three lines, no "Menu" word** (aria-label
  carries "Open/Close menu"), and the menu is a **drawer from the left**:
  fixed, full height, `min(86vw,380px)`, page dimmed by a box-shadow, own
  logo + ✕ row. A tap outside is swallowed (capture listener) and closes it;
  Escape and ✕ return focus to the burger.
- `.sf-hdr` lost its `backdrop-filter` (the bar is opaque anyway): a
  backdrop-filter makes the header the containing block for `position:fixed`
  children and would trap the drawer inside the 72px bar.
- Supersedes the "Nav bar v3" note above on the label and the layer.

## Bug sweep (2026-10-10)
Automated: all 77 pages at 390 and 1280 — JS errors, failed requests, broken
images, H1 count, duplicate ids, dead #anchors, horizontal overflow, axe WCAG
2.2 AA; static: every internal href resolves (file or routing rule), every
referenced asset exists, all 168 JSON-LD blocks parse; functional: checkout
COD ×1/×2 and prepaid (Razorpay opens with the right amount), cart
`?cart=open`, `?buy=1`, blog filters/search/show-all, header badge. Fixed:
- `/faq` carries a **fourth** inline copy of the consent bar; its Privacy
  link wasn't underlined (axe link-in-text-block). Underlined.
- Blog index: one post (`data-cat="founder"`) had no topic chip, so chips
  summed to 55 of 56. Added "Founder story".
- Sticky buy bar truncated to "ODORST…" at ≤379px; the thumb hides there.
- "Your shirt holds 70% of the smell" (unsourced statistic) in one post's
  meta, its blog-index card and `feed.xml` → "The smell often lives in your
  shirt."
- Open, needs the owner: 44 posts say the spray dries in ~10 seconds (some
  inside first-person test write-ups and titles); the product pages say
  15–30 seconds. Not changed — rewriting reported test results is not a
  copy edit. Two posts also state "pH 5.5–6.0".

## Homepage hero v3 — first impression (2026-10-10; superseded by v4 above)
Researched (Baymard mobile homepage/product-image findings, Stripe landing
guidance on one action + a quote by the buy button) and rebuilt `.hero`:
- **Bottle on a stage, never a thumbnail:** phones keep copy | bottle side
  by side with an acid glow behind it; ≥768 the bottle sits on the acid disc
  in a stage card with three spec tags (50ml / dry 15–30 s / up to 8 h —
  locked claims only, `aria-hidden`, the same facts are in the copy).
- **One primary action:** "View product" is now a text link
  (`.hm-link.hero-more`), not a second full button. A test pins the route.
- **Proof by the button:** one real beta-tester quote (Rohit, verbatim,
  labelled "Beta tester"). Never edit it, never add stars.
- Category label is its own full-width row (it wrapped in the narrow
  column); chips lost their ⊘ icons and fit one row at 390; trust is one
  line, not three cards; the size/sprays line shows from 768.
- Tablet now gets the two-column layout from **768** (was 960).
- Measured CTA bottom: 703px at 390×844, 670 at 768×1024, 702 at
  1024×768, 757 at 1280×800. Below 390 the CTA drops under the fold and the
  sticky buy bar takes over (it shows whenever the hero CTA is off screen).
- The bottle image is `data-no-skel` (transparent cutout; no shimmer).

## Speed, skeletons, fewer icons (2026-10-10)
- **Razorpay loads on checkout intent, not on page load.** The static
  `checkout.js` tag pulled ~1.3 MB of Razorpay JS/CSS on every `/odorstrike`
  visit. `getRazorpayReady()` in chrome.js now injects the one tag (reused if
  present, dropped on error so a retry refetches) and `openCheckout()` warms
  it via `window.smfWarmRazorpay()`. Test pinned in `test/checkout.test.mjs`
  (this reverses the old "static tag, no injection" test).
- **No `<link rel=prefetch>` for whole pages** (the homepage downloaded
  `/odorstrike` + `/blog`, ~330 KB, on every visit). The header block now
  carries one `speculationrules` script: prefetch on hover / tap-start,
  excluding `/api/*` and `/admin*`.
- **Blog thumbnails have a 640w step** (`WIDTHS = [1920, 1200, 640]`); card
  `sizes` say 200px on phones, where cards are rows with a small thumb.
  1.55 MB vs 6.25 MB for the set. `build-thumbnails.mjs` now emits 640 too.
- PDP: hero preload said `1200w` while the `<img>` said `1196w`, so the hero
  downloaded twice; aligned. Gallery tiles 2–8 are `fetchpriority="low"`.
  `/faq`'s `.sub` no longer pulls the 80 KB Fraunces italic.
- **`@` in asset paths cost a redirect.** Cloudflare's asset server 307s
  `x@640.webp` to `x%40640.webp`, so every `@640`/`@1200` image (the PDP's
  LCP image, all blog thumbnails) paid an extra round trip.
  `prepare-public.mjs` (last build step) rewrites them to `%40` in the
  shipped HTML/CSS/JS/XML and throws if one is left. Sources keep `@`.
- **Skeleton loading:** `soft.css` §10 shimmers every `<img>` in its reserved
  box until chrome.js adds `.is-loaded` (load or error; capture listener +
  a sweep for images that finished first). `data-no-skel` opts out. Still
  under reduced motion.
- **Icons only where they do a job:** controls (close, ±, zoom, search,
  menu chevrons), the padlock on pay buttons, the ✓/⊘ fabric-only chips,
  the compare-table checks and the **one** shipping/COD/returns row per page.
  Removed from feature lists, highlights, offer lists, step numbers, science
  cards, quotes, spec chips, ghost-button arrows, blog card "Read" arrows,
  blog hero chips and the phone-menu rows. Sprites trimmed to match.

## Cart drawer rebuilt (2026-10-10)
`/odorstrike` cart drawer (`#cartOverlay`), rebuilt on Baymard cart findings:
- **The button total now equals the summary total.** `renderCart()` added
  `CFG.COD_FEE` to the "Checkout · ₹X" button unconditionally, so the drawer
  read Subtotal ₹229 above a ₹289 button. COD depends on a choice made in
  checkout, so the drawer *names* it ("Paying cash on delivery? It's ₹289…")
  and the button shows the subtotal. Pinned in `test/product-config.test.mjs`.
- Layout: count in the title, a free-shipping + "3–7 business days" bar,
  88px product tile with line total, 44px stepper with Remove beside it,
  one honest "Add a second bottle +₹229" row at qty 1 (same price, no
  discount implied), perks (UPI/COD +₹60, 7-day returns, ships from
  Hyderabad), a Subtotal / Shipping Free / Total summary, and "Keep shopping".
- Empty state adds a bottle straight from the drawer (`cartAddFromEmpty()`).
- 0 axe violations at 390px; every control ≥44px.

## Cart drawer v2: no prices, real slide (2026-10-10)
Owner's call: **the cart drawer shows no prices** — no line total, unit
price, subtotal/total or amount on the button. It is for choosing how many;
checkout states every total. The ₹60 COD charge is a fee, not a price, and
stays named in the perks (no drip pricing). Test pins both.
- **It never slid.** The overlay went `display:none → block`, so the drawer
  had no start position and appeared in place. The overlay is now always
  rendered and toggles `visibility` (delayed .32s on close), the scrim is a
  `::before` fading on opacity, and the drawer animates `translate3d` both
  ways. `.cart-overlay` left the MOTION POLISH `@starting-style` list.
- The full-screen `backdrop-filter:blur` under it is gone (it made the slide
  stutter on phones). On phones the drawer leaves a 28px strip of page
  visible; tapping it closes the drawer. soft.css no longer gives
  `.cart-drawer` the bottom-sheet radius under 640px.
- The bottle image is fetched at idle / on cart hover, so it is decoded
  before the drawer opens. Focus moves into the drawer and back to the cart
  button on close.

## Leftovers removed (2026-10-10)
Deleted: the unreferenced `neo.css`/`neo-lite.css`/`main.css`, `neo.js`,
`scroll-effects.js`, `assets/icons/shoe.png`/`helmet.png`; Google AI Studio's
`metadata.json`; the generated `scan-results.json` (now gitignored);
`skills-lock.json`; the `.jules/` agent notes; the Vercel React skill in
`.claude/skills/react-best-practices` (the site has no React); the legacy
`scripts/standardize_blog.py`. **`api/_security.js` no longer trusts
`https://aistudio.google.com`** — it was allowed by default, and anyone can
publish on that host. The audit now also fails on `netlify.toml` or
`metadata.json`. Still connected outside the repo (GitHub apps, remove in
GitHub settings): Vercel, Netlify (`spontaneous-longma-4f03b5`) and the
ChatGPT Codex reviewer.

## Full-site audit: WCAG 2.2 AA clean, structure clean (2026-10-10)
Audited all 77 HTML pages at 390px with axe-core (WCAG 2.2 AA) plus a style
and structure pass. Result after fixes: **0 axe violations, 0 tap targets
under 24px, 0 horizontal overflow, 1 H1 per page, balanced markup on every
page, one header/footer everywhere.** What it found and what changed:
- **35 more posts had torn markup** (a second corruption pattern): the
  product box content orphaned after the FAQ with an empty labelled
  `end-cta` shell further down, orphaned "Next Read" links, and in 10 posts a
  doubled `<main>/<article>` with an early `</article></main>` that pushed the
  share block outside the article. All rebuilt; Next Read now uses the
  shared `.read-next` card.
- **30 posts were never in `apply-chrome.mjs` PAGES**, so they carried an old
  header (cart button calling `openCartDrawer()`, which only exists on the
  PDP — a dead button — "How it works / Proof / Track" nav, "Buy ODORSTRIKE"
  to `/#buy`). Added to PAGES; every page now has the same chrome. If you
  add a post, add it to PAGES.
- WCAG: pinch-zoom unblocked on 10 posts (`user-scalable=no` removed);
  scrollable tables and the swipe rows are keyboard-focusable regions;
  PDP gallery dots are real 24×24 buttons; breadcrumbs ≥24px; contrast fixed
  on `.end-cta .strike-price`, the PDP `.fix-cta-note s` and `/reviews`
  "Write a review" (it had a browser-grey background).
- The PDP still carried its pre-2026-07 `footer{…}` CSS, which faded the
  shared footer's headings to 2.4:1 on that page only. Removed.
- Barlow Condensed (left over in restored inline styles) → JetBrains Mono.
- Blog end-of-post `.buy-btn`s on 11 posts pointed at `/#buy` → `?buy=1`.

## One design system across pages (2026-10-10)
A computed-style audit of every page type found five primary-button shapes,
card radii from 6px to 24px, grey labels on some pages and acid on others,
DM Sans on blog posts and system fonts + a slate palette on `/solutions/*`.
The fix is **`soft.css` §9 "Consistency layer"** — the single definition of:
- **Section label** = `.sf-eyebrow` look (acid, mono, 34px rule) for
  `.hm-eyebrow,.section-tag,.p-eyebrow,.b-eyebrow`.
- **Primary button** = 8px (`--sq-sm`), mono 700, uppercase, ≥52px, 14px.
- **Cards** 16px (`--sq-lg`); large panels/media 20px (`--sq-xl`).
Add a new page's classes to those lists; don't restyle locally.
Also: headings are Fraunces 900 sentence case everywhere (homepage caps and
the PDP's italic/tilted-highlight H2s are gone; accent words are acid text);
section H2s use `--fs-h2`, listing-page H1s `--fs-h1`; `blog.css` maps
`--font-body/--font-display` onto the tokens (it was never defined, so posts
used DM Sans); `/solutions/*` no longer override `:root` with slate colours.

## UI/UX pass: blog repair, PDP, policy copy (2026-10-10)
- **20 blog posts had corrupted markup** since `dd86e68a` (5 Sep): every
  opening tag that carried an inline `style` was stripped to a bare `<>`, so
  the quick-answer block rendered as literal "<> <>Quick answer" text, and 21
  posts had the "Meet the Fix" product box torn in two (contents orphaned
  before Read Next, an empty shell after). Restored line by line from
  `dd86e68a^`; quick answers now use the same class markup as the healthy
  posts (`.quick-answer > .qa-label + h2.qa-q + p`). Grep for `^\s*<>` if it
  ever recurs. `.read-next` had no styles at all — added to `blog.css`.
- **46 posts' "BUY NOW" pointed at `/?buy=1`** — the homepage, which ignores
  `?buy`. They now point at `/odorstrike?buy=1`.
- Blog index on phones: cards are compact rows (thumb + category + title)
  below 680px; the page went from ~27,700px to ~10,300px.
- PDP: reviews are a swipe row on phones; the `#buy` card's `.cod-line` and
  `.pay-modes` state the ₹60 COD charge again (both had lost it); the ribbon
  no longer says "ONE SKU. NO BUNDLES." (combos are planned).
- `/shipping` said COD had **no handling fee** — corrected to ₹60 / ₹289.
  `/reviews` promised a "money-back guarantee" — now "7-day returns", which
  is what `/returns` actually offers. `/faq` lost a duplicate stain question
  that also carried an unverified "30+ wash cycles" claim.
- Open, not changed: the `/reviews` page renders beta-tester quotes from
  `assets/js/reviews-system.js` (Rohit S./Aarav M./Priya K., with stars) that
  differ from the three on `/` and `/odorstrike`; and its "verified buyer"
  list (from Supabase) includes a review by the founder.

## Vercel removed — Cloudflare only (2026-10-10)
- `vercel.json` → **`config/routing.json`** (redirects, rewrites, headers only;
  same rule shapes). Its `crons` already existed as Worker cron triggers in
  `wrangler.jsonc`, and `cleanUrls`/`trailingSlash` are `html_handling`.
  `middleware.js` (Vercel Routing Middleware) is deleted; the GSC verification
  file is a static asset. `audit-production.mjs` fails if either file returns.
- **`APP_ENV=production`** is a `vars` entry in `wrangler.jsonc`. The email
  code used `VERCEL_ENV`, which never exists on Cloudflare, so two production
  guards had been silently off since the move: the "no resend.dev sender in
  production" block, and `send-email`'s origin check, which accepted **any
  `*.vercel.app` / `*.run.app` origin**. Those origins are gone entirely now;
  only localhost is allowed, and only outside production.
- Secrets go in Cloudflare → Workers & Pages → smelloff → Settings → Variables
  and Secrets (or `npx wrangler secret put NAME`). The setup docs say so.
- Not done from the repo: the Vercel GitHub app and the two Vercel projects
  (`smelloff`, `smelloff-6v6v`) still build every PR until they're
  disconnected/deleted in Vercel and GitHub settings. Old dated audits under
  `docs/audits/` and `docs/plans/` still mention Vercel — they're history.

## Owner dashboard at /admin (2026-10-10)
Replaces the separate `Brxinee/Admin` repo (a 470KB SPA + 323KB API + a
half-built `mission-control/` app, on a Vercel deploy that no longer served).
The new one is deliberately small and ships with the storefront Worker:
- `admin/index.html` — one self-contained page (no libraries): Overview,
  Orders (search, status filter, detail drawer, one-tap "Mark as …", courier
  + tracking, CSV), Customers (grouped by phone, CSV), Messages.
- `api/admin.js` — one POST endpoint. `ADMIN_PASSWORD` → signed HttpOnly
  SameSite=Strict cookie (12 h); same-origin check; writes limited to
  `status/courier/tracking_id/tracking_url` on orders and `status` on
  `contact_messages`. Money is **paise** in the DB; the UI divides by 100.
- `/api/health` reports which secrets are present (`configured.database`,
  `email`, `razorpay`, `admin`) — booleans only, never values.
- **Supabase free tier pauses after ~7 days without traffic.** It was paused on
  2026-10-10, so orders weren't being saved. The 03:00 cron now does one tiny
  read (`keepDatabaseAwake`) before the Meta drain.

## Signature sections (2026-08-02)
Two owned experiences replaced four generic ones. Both are built the same way
and that way is the point: **an attribute or a custom property drives CSS, and
the JS is one listener.** There is no animation library on this site — no GSAP,
no Lenis — because the pages are self-contained single files whose whole
advantage is that the LCP path carries no extra request. Don't add one.

**`index.html` — "Your shirt remembers"** (`#remembers`). Replaced `territory`
("Smell is bigger than skin") and `problem` ("Why your deodorant doesn't fix
this"), which argued the same point twice and ended in the four-column
competitor grid every DTC site has. It walks the visitor through one day of
their own shirt until they recognise 16:00, then resets it.
- **The scrubber is a native `<input type="range">`.** Keyboard, touch and
  screen-reader support come free and correct; `aria-valuetext` is rewritten
  per step so AT announces the moment, not "4 of 6". Don't replace this with a
  custom drag handler.
- The seven states live in the `DAY` array in the page's inline script, not in
  markup, so they can't drift from the slider's `max`.
- Visuals key off `[data-step]` on the section — scrubbing is a class recalc,
  no layout, no per-frame JS.
- **Nothing in it is a measurement and it must never start implying one.** No
  numbers, no percentages, no meter readings — it is a story about a Tuesday,
  and it says so. The only claim is the locked one in the closing line.

**`odorstrike.html` — "The 30-second reset"** (`#reset30`, was `.how-to-use`).
Same three instructions, but the middle beat **runs the actual ten seconds**
once when scrolled into view — a demonstration of the site's existing locked
"10-second dry" claim, not a new assertion. One `conic-gradient` swept by one
custom property via rAF, `IntersectionObserver` with `obs.disconnect()` so it
fires once. Still a real `<ol>`: the steps must read as a list with JS off.
- `.use-cases` kept its (genuinely specific) body copy but lost the header that
  was literally commented "content block for SEO word count". It is now
  "Moments you can't rewash for".

**Both honour `prefers-reduced-motion`** by showing the finished state — the
ring full, the transitions off — never by hiding the content.

## Conversion path (2026-08-02)
The money path on `/odorstrike` had a click in it that nobody chose to put
there. **`buyNow()` added a unit and opened the cart drawer** — so every CTA
labelled "Buy now" (hero, `#buy`, final, sticky mobile bar) landed on a drawer,
and checkout took a second click. It now goes **straight to `openCheckout()`**.
- **Two buttons, two intents.** `buyNow()` = express, straight to the form.
  `addToCart()` = browse, opens the drawer. The drawer is still reachable from
  the header cart; it is just no longer in the way of a decided buyer.
- **`pdpQty` is the page's quantity and is deliberately NOT the cart.** Stepping
  it must not light the header badge before anything has been added. Single SKU,
  so both CTAs **set** the cart to `pdpQty` rather than adding — pressing "Add to
  cart" twice on a one-product store must not silently mean four bottles. The
  drawer's own +/− mirrors back via `syncPdpQtyFromCart()`; the two controls can
  never disagree.
- **Superseded (checked 2026-10-10): the code defaults to prepaid**
  (`payMethod = 'prepaid'`, prepaid option first and active). The original
  note read: "COD is the checkout default (`payMethod = 'cod'`, and the markup
  order and visible panel match)." The UPI path is manual — copy the VPA, switch app, pay,
  screenshot, WhatsApp the screenshot and UTR — and each step sheds orders. COD
  is ₹0 advance and one tap. `/faq`'s "How to pay" now leads with COD too; keep
  the two in step. **Flip both back together** if RTO cost ever outweighs it.

## COD carries a ₹60 handling charge (2026-08-04)
₹229 prepaid by UPI, **₹289 collected on delivery**. The product price is still
₹229 — the ₹60 is a surcharge on the *payment method*, which is why `Product`
schema, `products.json` and every "Buy ₹229" pill still say 229 and should stay
that way. Two rules govern it:
- **It must be visible before the checkout modal opens.** Quoting ₹229 all the
  way down the page and revealing ₹289 in the final summary is drip pricing,
  named explicitly in the CCPA's 2023 dark-pattern guidelines. It is disclosed on
  the PDP hero (`.price-note`), the `#buy` card (`.cod-line`), `.pay-modes`, the
  `.fix-cta` note, the cart drawer's ship note, the homepage hero meta, both COD
  FAQ answers **and their FAQPage schema twins**, and `llms*.txt`. The checkout
  summary restates it; it never introduces it.
- **The number lives in two places and they must agree**: `CFG.COD_FEE` in
  `odorstrike.html` and `COD_FEE_RUPEES` in
  `supabase/functions/create-order/index.ts`. The edge function decides the
  surcharge itself from `payment_method` and rejects the order if the client's
  total disagrees, so a one-sided change makes **every COD order fail to mirror
  into the database** with "Order total mismatch" — silently, since the checkout
  itself still succeeds.
- All checkout arithmetic goes through **one** function, `orderTotals()`. The
  summary, the UPI panel, the COD panel, the submit button, `collectOrder()` and
  the success screen all read from it; none of them recompute. `codFee` is its
  own column in the Sheets payload and in `orders.cod_fee` (migration
  `20260804_order_cod_fee.sql`) so product revenue stays separable from
  payment-method revenue — `amount - cod_fee` is the product subtotal on every
  row. `/track-order` shows the charge on its own line for the same reason.
- Fixed alongside it: the edge function read `items[0].price` as though it were
  the line total, so it compared a two-bottle order's ₹458 against ₹229 and
  rejected it. **Every order of more than one bottle had been failing to reach
  Supabase.** It now verifies `price × quantity`.
- **`?buy=1` opens checkout on load**, the sibling of `?cart=open`. Terminal CTAs
  elsewhere (homepage hero, blog end-of-post `.buy-btn`, `/faq` and `/reviews`
  closers) point at it. **Header "Buy ₹229" pills and in-prose `.inline-cta`
  links were left on `#buy` on purpose** — those are navigation and citation, not
  a decision, and dropping a modal on someone who wanted to read is worse.
- **The sticky mobile bar tracks the real CTA, not a scroll number.** It waited
  for 400px; the hero's buy buttons start at ~830px on a 390×844 phone, so
  scroll 0–400 had no purchase control anywhere on screen. An IntersectionObserver
  on `.buy-actions` now drives it alongside the `#buy` one, so there is always
  exactly one route to checkout and never two competing.
- **Phone spacing above the fold is measured, not eyeballed.** The CTA was at
  y=904 on a 390×844 screen; it is ~846 now, and the price is at 762. The space
  came out of 84px of decorative hero padding (the header is `position:sticky`,
  so that padding bought no clearance) — **not** out of the gallery, which is
  what sells. Re-measure rather than nudging by eye.
- **Preload only what paints above the fold.** The PDP was preloading five font
  files. `fraunces-italic-400` (80KB) serves one below-fold heading, and
  `barlow-condensed-900` **is not used on that page at all** — it was fetched at
  top priority to render nothing. Grep `font-family:var(--…)` before adding a
  preload back; this page renders in exactly three families.
- **Fixed (2026-08-03): ₹ no longer drags in the latin-ext faces.** A scan of the
  rendered text of every page found **U+20B9 is the only latin-ext codepoint on
  the whole site** — nothing else in that range appears anywhere. It was costing
  Inter Tight 87KB, Fraunces 57KB, Fraunces italic 69KB and DM Sans 17KB, plus
  Barlow Condensed (14KB) and JetBrains Mono (7KB) whose latin-ext files **don't
  even contain ₹** — they downloaded, found no glyph and fell back.
  U+20B9 is now carved out of every latin-ext `unicode-range` (`U+20AD-20C0`
  split around it) and served from `*-rupee-*.woff2` single-glyph subsets built
  with `fontTools`: **87KB → 1.1KB**. Per page load: `/blog` fonts 225→131KB,
  `/odorstrike` 275→211KB, `/` 195→132KB.
  - The latin-ext faces are still declared and intact — nothing requests them
    today, and they're there when a name with an ā or ł needs setting.
  - **Rebuild the subsets if a font file is ever replaced**, and remember the
    declarations exist in **two** places: `assets/fonts.css` and the inline
    block in `index.html`.
- `fraunces-italic` (80KB on the PDP) is used by **eight** heading rules
  (`.problem h2`, `.final h2`, `.use-cases h2`, `.pricing .sub`, …), not the one
  below-fold heading an earlier note claimed. It is `font-display:swap` and
  unpreloaded, so it doesn't block render. Removing it is a redesign, not a
  perf fix.

## Positioning: clothing only (2026-08-02)
ODORSTRIKE is a **pocket-sized fabric odor neutralizer for clothes**. That is the
whole category. The site used to sell "odor control for clothes, shoes, helmets
and gear" — that line was in the shared footer on all 24 pages, the homepage
meta/OG/Twitter descriptions, the Organization and FAQPage schema, the hero
sub-headline, two of the three hero zone cards, the ticker, `llms.txt`,
`llms-full.txt` and a `/faq` answer that actively told buyers to spray shoes and
helmet liners. All of it is gone.
- **In scope:** shirts, t-shirts, hoodies, jackets, blazers, jeans, trousers,
  uniforms, everyday clothing. Fabrics: cotton, polyester, denim, nylon, wool
  blends.
- **Never reintroduce:** shoes, sneakers, helmets, gym gear, sports equipment,
  bags, luggage, gloves, bike gear, car seats, sofas, curtains, room/air
  freshening. Competitor comparisons may name those as what *the competitor* is
  for — that sharpens the contrast — but must not claim them for ODORSTRIKE.
- **State the limits, don't bury them.** "Fabric only, never skin/hair/body",
  "does not replace washing", "does not remove stains" now appear in the
  homepage FAQ + schema, the `/faq` "What is it not for?" answer (which replaced
  and merged the old shoes/helmets and sofas/curtains questions), and both
  `llms*.txt`. Honest limits are a trust asset here, not a disclaimer.
- **Two things were deliberately left alone.** (1) The beta-tester quote "Lives
  in my gym bag now…" on `/` and `/odorstrike` — it is a real first-hand account
  and the brand rule against inventing or editing reviews outranks the phrasing.
  Replace it only with another real quote. (2) `assets/pdp-04-pocket-size.webp`
  has "GYM BAG" and "LAPTOP BAG" burnt into two of its four panels. Its `alt`
  still describes them because alt must match the image; there is an
  ASSET RECUT NEEDED comment above the tile in `odorstrike.html`. Recut those two
  cells to clothing-carry contexts, then update the alt.
- The homepage hero zone cards are now Shirt collar / Hoodie / Blazer & jacket,
  drawn as **inline SVG** (`.z-ico`) instead of masked PNGs — crisper, and two
  fewer image requests above the fold. `assets/icons/shoe.png` and `helmet.png`
  were unreferenced and are deleted (2026-10-10). Sizing lives on `.zone svg`; `.z-ico` is stroke only.
  Do not put a `flex-basis` back on it — `.zone` is a row on phones and a
  **column** at ≥768, where a basis resolves against the cross axis and rendered
  the icons 72×64 instead of square.

## Design restoration (2026-07-10)
The homepage was restored to the original iconic design (dark #080808, Fraunces
serif display, acid-green #B8FF57 highlights, JetBrains Mono labels) from the
April 2026 codebase, paired with current-correct data:
- **₹229 solo (50ml) is the ONLY SKU. No duo/trio/bundles anywhere.**
- Claim: "up to 8 hours odor protection on fabric". Glycerine-free, zero residue.
- 4-layer mechanism: TRAP HPβCD · NEUTRALIZE Zinc PCA · PREVENT Triethyl Citrate · ANTI-REGROWTH Zinc Gluconate (Formula v3.1).
- NEVER list Zinc Ricinoleate, Sodium Bicarbonate, or Glycerine as ingredients.
- **NEVER publish formula percentages/concentrations anywhere** (site, schema, llms.txt, blog). Exact amounts are a trade secret. Say "exact concentrations are proprietary" if asked.
- **Owner's call (2026-10-11): name only three key actives — HPβCD, Zinc PCA, Triethyl Citrate — and count the rest ("+ 8 more").** The full INCI lives in `config/product.json` and is not published: the PDP ingredient box, `/blog/odorstrike-ingredients` (now "The Key Actives, Explained") and the posts that called the base "water and isopropyl alcohol" (now "a fast-drying water base") were changed. The four-layer story still names Zinc Gluconate. Customers who need the full list for an allergy check are pointed to info@smelloff.in. Pinned in `test/ux-guardrails.test.mjs`. The post's thumbnail still has "Full ingredient list" burnt into its pixels — the config kicker now says "Key ingredients"; re-render it with `npm run thumbnails` when the source photo is available.
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
  padding *and the type*.** Both padding sets applied at once is what made
  every row twice as tall as its text; and the homepage set Fraunces/25px on
  a nested `<h3>`, so its questions ran larger than every other page's. The
  `<summary>` now carries the family, weight and size (Fraunces 900,
  16px→19px) and any heading inside it inherits — the heading is there for
  document outline only. Canonical spec is `soft.css` §3, covering
  `.faq details`, `.faq-item`, `.faq-q` and `.faq-list details`; it uses
  `!important` on padding/radius specifically to beat `blog.css`. The list
  container is one column on phones and two at ≥900px, everywhere.
- **Flush grids keep their hairlines; they do not become cards.** When cells
  sit edge to edge and share dividers, the radius belongs to the band, not
  the cell — `.benefits-strip`, `.ingredients` and the `/odorstrike`
  `.use-card` grid all work this way. `.use-card` was briefly added to
  `soft.css`'s card list and it turned four columns of an editorial table
  into four floating boxes. Don't put it back.
- **Shared-layer URLs carry a content hash, and `apply-chrome.mjs` stamps it.
  Re-run the script after every edit to `soft.css`, `chrome.css`,
  `chrome.js`, `tokens.css`, `fonts.css`, `consent-analytics.js`,
  `blog-share.js` or `track.js`, or the change ships without reaching anyone.**
  (Only `tokens.css` was being stamped until 2026-08-03; the other four shipped
  unversioned under the same `immutable` header. `consent-analytics.js` was the
  expensive one — it carries the consent gate, the analytics loaders and the
  injected consent bar for the 30 pages without an inline copy, so it is the
  file most likely to need to reach everyone and was the least likely to.)
  `config/routing.json` serves `/assets/(.*)` with
  `Cache-Control: public, max-age=31536000, immutable`. `immutable` means the
  browser never revalidates, so an unversioned `/assets/css/soft.css` froze
  every returning visitor on whatever copy they fetched first — for a year.
  Three rounds of design fixes appeared not to work because of this: the
  deploy was green, production served the new CSS (verified with `curl`), and
  phones kept rendering the old one. The HTML itself is `no-cache`, so a new
  hash in the query string is picked up on the next page load.
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
- `neo.css`, `neo-lite.css`, `main.css`, `neo.js` and `scroll-effects.js` were
  loaded by no page and are deleted (2026-10-10). Blog posts use `blog.css`.
- Text selection is enabled site-wide. It used to be blocked on `body` in
  `odorstrike.html` and `blog.css`, which stopped customers copying their own
  order ID and readers quoting a guide. Only interactive chrome opts out now.

## Responsive rules (2026-07-30)
Canonical breakpoints — **520 · 768 · 960 · 1160**, documented in `chrome.css`
§5. Eighteen distinct values had drifted in (440/460/520/560/640/680/720/721/
760/767/768/800/820/880/900/960/980/1000/1040/1200); neighbouring values a
pixel or two apart are drift, not design, and they leave bands where one
component has switched layout and its neighbour has not. Media queries can't
read custom properties, so this is a convention — it can only be written down.
- **Overlapping `min-`/`max-width` pairs that disagree in the overlap are the
  bug to watch for.** The PDP had `min-width:960px{two columns}` and, further
  down the file, `max-width:900px{one column}`. Equal specificity, so the later
  one won and forced a single column across 768–900 — the phone layout at
  tablet width, with `grid-auto-columns:84%` carousel tiles rendering ~655px
  wide and the buy panel a full screen below the fold, on the page that carries
  the checkout. When you move one edge of a layout switch, move its pair.
- **The PDP's three hero rules are one layout and switch together at 768**:
  `.product-hero` columns, `.gallery-stack` carousel→vertical stack, and
  `.product-info` sticky. So does the `.mobile-bar` handoff — the sticky mobile
  CTA hides at exactly the width the sticky buy panel appears, so there is
  always one persistent route to checkout. It used to hide at 721 while the
  panel arrived at 960, leaving a band with neither, and `body{padding-bottom}`
  reserved space for it up to 960 — 240px of dead space under the footer at
  tablet sizes.
- **`body{overflow-x:hidden}` on `index.html` and `odorstrike.html` clamps
  `documentElement.scrollWidth`, so any overflow check that trusts it reports
  a clean page.** Neutralise it (`html,body{overflow-x:visible}`) before
  measuring, or you are auditing the clamp rather than the layout.
- Conversely, the marquee strips (`.ticker` / `.band-marquee` on the homepage,
  `.marquee` on the PDP) hold tracks measuring 2095–6546px and
  `getBoundingClientRect` reports that full width. They are **not** overflow
  bugs — all three wrappers already carry `overflow:hidden`. An audit that
  treats only `auto|scroll` as clipping will flag all three. Count `hidden`
  and `clip` as clipping.
- **The consent bar exists in THREE copies** — inline in `index.html`, inline
  in `odorstrike.html`, and as a CSS string in `assets/js/consent-analytics.js`
  (which appends its `<style>` to `<head>` at runtime, so it lands *after*
  `chrome.css` and wins at equal specificity). All three had
  `.cb-actions{flex-shrink:0}` with no wrap, so at 320px the row measured 315px
  in a 300px box and "Reject non-essential" hung off-screen on all 24 pages.
  Fixed in all three plus `chrome.css` §5.2 — **change all four together.**
- **The consent bar must never be over the checkout, and it was (2026-08-03).**
  It is `position:fixed;bottom:0;z-index:9999` — deliberately the highest thing
  on the page so it clears the sticky header and the sticky buy bar. The PDP's
  `.overlay` was `z-index:200`, so `elementFromPoint` at the centre of "Place
  COD order · ₹229" returned `.cb-accept` at 320×568, 360×640, 390×844 and
  414×896. Desktop was fine, which is why it survived. **A first-time visitor
  has by definition not answered the bar yet, so this was every new mobile
  buyer tapping "Accept all" instead of ordering.** Two guards now:
  `.overlay`/`.gal-viewer` outrank 9999, and `syncModalState()` puts
  `.sf-modal-open` on `<html>`, which `chrome.css` §5.3 uses to remove the bar
  while a modal is open. **Anything new that is `position:fixed` must stay
  below 9999 or explicitly join that ladder.**
- `viewport-fit=cover` is set site-wide, so safe-area insets are real. `.sf-wrap`
  carries `max(var(--gutter), env(safe-area-inset-*))`, which covers the header,
  the footer and every page body at once. Fixed bottom bars (`.mobile-bar`, the
  consent bar) need `env(safe-area-inset-bottom)` of their own — the PDP's buy
  CTA sat under the iPhone home indicator without it.
- Verified by rendering all 18 pages in headless Chromium at 320/360/375/393/
  430/520/600/720/767/768/820/900/960/1024/1280/1440/1920 plus landscape
  (851×393, 932×430) and ultra-wide (2560, 3840). Form controls are already
  ≥16px (below that, iOS zooms the page on focus — it carries the checkout),
  and no layout uses `vh`, so there is no mobile address-bar jump.
- The footer's 34px link rows are **deliberate** and clear the WCAG 2.2 AA
  24×24 minimum — see the footer note above before "fixing" them to 44px; that
  reintroduces the ~1200px mobile footer.

## Launch readiness (2026-08-03)
Analytics coverage, the skip link and the motion layer — the three things that
were declared somewhere but not actually wired to every page.

- **Analytics is on all 38 pages now.** The five `/solutions/*` pages loaded
  `chrome.js` and nothing else: no GA4, no Pixel, no first-party beacon, and
  **no consent bar at all** (it's injected by `consent-analytics.js`). They're
  SEO/paid landing pages, so traffic was converting against no measurement.
  Ten pages were missing `track.js`. Both fixed — if you add a page, it needs
  `track.js` **and** `consent-analytics.js` (or an inline consent block).
- **Microsoft Clarity is wired but off.** `CLARITY_ID` is empty in all four
  copies of the loader (`index.html`, `faq.html`, `odorstrike.html`,
  `consent-analytics.js`) — paste the project ID into **all four**, same rule as
  `GA4_ID` and `META_PIXEL_ID`. Empty means the tag is never requested. It is
  consent-gated and bot-guarded with the others because it sets a cookie.
- **The skip link is generated, not hand-written.** `apply-chrome.mjs` emits
  `.sf-skip` into the header block and stamps `id="sf-main" tabindex="-1"` onto
  each page's `<main>`, else first `<article>`, else first `<section>`. The
  `tabindex` is load-bearing: without it the page scrolls but focus stays on the
  link, the next Tab goes back into the nav, and the link has done nothing.
  - The search is **bounded to the region between the chrome markers** — the
    PDP has a `<main class="po-main">` inside its payment-failed policy
    overlay, below the footer in source order, and an unbounded search picked it.
  - Pages where the first landmark is the wrong place take an explicit `skip:`
    selector in `PAGES` (`odorstrike.html` → `product-hero`, otherwise it lands
    3600px down on `.showcase`; `blog/index.html` → `b-hero`).
- **Motion is CSS-only and additive.** Scrims (`.overlay`, `.cart-overlay`,
  `.gal-viewer`) fade in from `display:none` using
  `transition-behavior:allow-discrete` + `@starting-style` — no JS, and browsers
  without support snap exactly as before, so the fallback is today's behaviour.
  Press feedback (`:active{transform:scale(.97)}`) lives in `soft.css` §1 so all
  24 pages share it; the cart badge bump fires only on a real quantity increase.
  **Everything is inside `prefers-reduced-motion:no-preference`** — reduce keeps
  the finished state, never a hidden or half-drawn overlay. Still no animation
  library, and only compositor properties (opacity/transform).

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
- **PDP gallery = eight tiles, one objection each (2026-07-30; five since 2026-10-11, see "Photos in the image slots")**, in the order
  a first-time buyer raises them: `pdp-01-hero` (what is it — the only pure
  product shot, bottle on white), `pdp-02-problem` ("You don't smell. Your
  shirt does."), `pdp-03-how-to-use` (spray → 10 sec → wear),
  `pdp-04-pocket-size` (jeans / shirt / gym bag / laptop bag),
  `pdp-05-proof` (sprayed on a black shirt, no white marks),
  `pdp-06-science` (HPβCD traps → Zinc PCA neutralises → fresh),
  `pdp-07-fabric-only` (FABRIC ONLY — not skin, hair or body),
  `pdp-08-comparison` (vs deodorant vs perfume). Each has an `@640` variant.
  - **All eight assets are cut to 1196×1315 (~9:10) and no tile declares an
    `aspect-ratio`** — the tile takes the image's own height, so the carousel
    steps through uniform cards and no headline is ever cropped. The product
    shot was natively 1:1 and is extended on its own white sweep to match.
    Cut new gallery assets to that ratio.
  - Tile 1 is the LCP image and is preloaded in `<head>`. **If the running
    order changes, move that preload with it** — it once pointed at the third
    image in the stack, below the fold, so the tile that actually painted
    first was never preloaded.
  - An earlier pass stripped creatives out of this gallery because the claims
    burnt into their pixels were unselectable and invisible to search. That
    constraint still holds and is met differently now: the same claims exist
    as real markup further down the page (`.fix-carry`, `.specs`, the
    ingredient rows), and **every tile's `alt` states its message in words** —
    keep it that way when swapping an asset. The pixels sell; the markup
    indexes.
  - Because the creatives carry body copy inside the artwork (unreadable in a
    294px carousel cell), **every tile opens full-screen on tap** —
    `.gal-zoom-btn` → `#galViewer`, dismissed by tap, ✕ or Escape. It clones
    the tile's `<img>`, so opening costs no extra request. Don't remove the
    zoom without also solving legibility on phones.
  - Superseded: `odorstrike-hero-disc.webp` (+`@900`) and `shot-studio.webp`
    are no longer referenced by any page. `shot-pocket`, `shot-gymbag` and
    `shot-flatlay` were never restored — those three are older creatives with
    a different type system and **do not go in the gallery**. All are still in
    `/assets` for paid social. `odorstrike-bottle-cutout.webp` is still the
    homepage hero — don't delete that one.
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
- `/blog` — blog index (29 posts)
- `/blog/[slug]` — individual blog posts
- `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms` — policy pages
- `/llms.txt`, `/llms-full.txt` — AI/LLM context files
- `/sitemap.xml`, `/robots.txt`, `/manifest.json`
- `/admin` — private admin dashboard ("Mission Control"), served at `admin.smelloff.in` (noindex, password-gated). Single self-contained SPA `admin/index.html` + one serverless function `api/admin.js` (session login, Supabase service-role CRUD over orders/reviews/messages/waitlist/blog_comments, computed business stats, first-party analytics reports, optional GA4 Data API proxy). Order status pipeline: placed→confirmed→packed→dispatched→out_for_delivery→delivered (+upi_pending, cancelled); admin has one-tap "advance" buttons and the customer `track-order.html` timeline mirrors it. Every status change is timestamped into `orders.status_history` (jsonb `[{status,at}]`) + `orders.updated_at` by the `orders_track_status` DB trigger (migration `20260711_order_status_history.sql`), so the customer timeline shows *when* each stage happened plus an estimated-delivery window — no admin wiring needed, the trigger fires on any status update. Setup + env vars in `docs/ADMIN-SETUP.md`. Secrets (`ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GA4_*`) live only in Cloudflare Worker secrets — never in the client. Reuses brand fonts/colors; charts follow the validated dark-mode dataviz palette.
- **First-party analytics** — cookieless, no-Google web analytics. `api/track.js` receives a beacon from every page (added inline to index/faq/odorstrike, via `assets/js/consent-analytics.js` everywhere else) and stores an anonymised row in `page_views` (daily-rotating visitor hash from IP+UA+salt; no cookie, no PII). Aggregated by the `site_analytics()`/`site_realtime()` RPCs (service-role only) and shown in the admin Analytics tab. Runs regardless of the GA/Pixel consent choice because it stores nothing on the device and no personal data. Migration: `supabase/migrations/20260711_first_party_analytics.sql`.

## Blog thumbnails (2026-08-03)
All 17 posts carry a **1920×1080 (16:9)** featured image — licensed Adobe Stock
photography under a brand type layer, generated from one config. Full manual in
`docs/BLOG-THUMBNAILS.md`; run `npm run thumbnails`.
- **`scripts/thumbnails/thumbnails.config.mjs` is the source of truth** and drives
  *both* renderers (the local compositor and the Canva Autofill script), so copy
  and photography can't drift between them. `validateConfig()` throws on an
  overlay over **six words** — that cap is measured, not taste (past ten words
  costs ~16% CTR), as is the preference for a question over a statement (~20%)
  and for a human face over an object (9.2% vs 6.1%).
- **This reverses two earlier rules.** The old `docs/BLOG-THUMBNAILS.md` banned
  text baked into the image and specified 1200×630; the 2026-08 research measures
  the opposite on both counts (Discover letterboxes 630-tall assets). It also
  described an AI-photographic set as shipped — it never was; the live assets were
  still the mascot tweet cards.
- **The old generator is deleted, not just unwired.** `build-blog-thumbnails.js`
  re-wrapped `<img>`s that were already inside a `<picture>`, so `<source>` rows
  accumulated on every run — the blog index was carrying six for two formats. The
  previous doc warned people not to run that step; a warning in prose is not a
  fix. `apply-thumbnails.mjs` replaces whole blocks, is idempotent, and has
  `--check` (wired into `npm run build`).
- **Source photos are gitignored** (`.thumbnail-sources/`, 5–15MB each); only the
  composites are versioned. The Adobe Stock asset ids are in the config, and
  re-licensing an id you already own doesn't charge again.
- **Photo choice is bound by the clothing-only rule.** Never spray on skin/hair/
  body, never shoes/helmets/bags/gym gear — a thumbnail has no copy to qualify
  itself. The "clothes, not skin" post first drew an underarm frame that argued
  the opposite of the post under it.
- **Bump `V` in `apply-thumbnails.mjs` when the pixels change** — `/assets/*` is
  `immutable` for a year, the same trap as the shared CSS/JS layers.
- **The Canva Connect route needs a paid plan and has never been run.** Brand
  Templates + Autofill are Pro/Teams/Enterprise; the connected account is Free.
  `scripts/canva_thumbnail_automation.js` is written and guarded but unexercised —
  and it deviates from the research PDF's reference code on purpose (raw-binary
  asset upload, because the PDF's `file_base64` JSON body 400s against the live
  endpoint).

## Blog expansion from the SEO strategy brief (2026-08-04)
Six posts added from an external SEO/content strategy report, taking the blog to
**29**. The report is a useful keyword and information-gain document and its
scope was wrong for this brand — **four of its six proposed topics were banned
by "Positioning: clothing only" above**, and were replaced rather than published:
- **Rejected:** leather jackets *and biker gear* (helmets, riding gear),
  gym bags / backpacks / duffels, canvas shoes and sneakers, car seat upholstery.
  The leather-jacket brief was the near miss — a jacket *is* clothing and the
  "spray the polyester lining, never the hide" angle is genuinely strong — but it
  was dropped along with the rest rather than published half-in-scope.
- **Published instead:** `remove-cooking-smell-from-clothes`,
  `remove-smell-from-hoodie-without-washing`,
  `keep-clothes-fresh-without-washing-machine` (hostel/PG),
  `remove-cigarette-smoke-smell-from-clothes`, plus the report's two in-scope
  topics — `remove-mothball-almirah-smell-from-clothes` and
  `keep-office-trousers-fresh-without-washing`.
- **The report also invented product facts.** It specified an "isopropyl solvent
  base" as the formulation and a "10 minute" dry time. Neither is ours. Every
  post uses only the locked claims: the v3.1 actives by name, no percentages,
  "dry in about 10 seconds", "up to 8 hours of odor protection on fabric".
  Treat any external brief as keyword research, never as a source of formula copy.
- Each post carries Article + HowTo + FAQPage + Speakable + BreadcrumbList
  JSON-LD, a `.quick-answer` block, six question-shaped H2s, an on-page FAQ
  mirrored 1:1 into the schema, and a real primary-source citation with a
  concrete number (Tang 2024 *Indoor Air* on frying VOCs, Sleiman 2010 *PNAS* on
  thirdhand smoke, ATSDR on naphthalene subliming, Callewaert 2014 *AEM* on
  polyester vs cotton).
- **Fixed alongside:** the blog index `ItemList` schema listed only 17 of 23
  posts — the whole 2026-08 series had been added to the grid and never to the
  schema. It now lists all 29. Four section headings in `llms-full.txt`
  ("Why clothes smell", "How to remove smell", "Use cases", "India climate")
  had been left empty by the 2026-07-28 prune and are populated again.
- Three counts on the blog index are hand-written and drift silently: the hero
  `.b-pill` ("29 Science Guides"), the `data-cat="all"` chip and `#latestCount`.
  **Update all three when the post count changes.**

## Blog prune (2026-07-28)
The blog was cut from 48 posts to **8** — brand, founder and ODORSTRIKE product
content only. Kept: `why-i-built-odorstrike`, `odorstrike-review-30-day-india-test`,
`odorstrike-vs-febreze-india`, `ambi-pur-vs-odorstrike`, `what-is-fabric-odor-eliminator`,
`hpbcd-cyclodextrin-fabric-odor`, `zinc-pca-fabric-odor-ingredient-guide`,
`beta-cyclodextrin-odor-removal-science`.
- All 40 deleted slugs **301 to `/odorstrike`** in the routing config (now `config/routing.json`), so existing
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
