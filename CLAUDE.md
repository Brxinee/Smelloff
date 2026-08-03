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
- **COD is the checkout default** (`payMethod = 'cod'`, and the markup order and
  visible panel match). The UPI path is manual — copy the VPA, switch app, pay,
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
  are now unreferenced. Sizing lives on `.zone svg`; `.z-ico` is stroke only.
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
  `vercel.json` serves `/assets/(.*)` with
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
- Unreferenced stylesheets: `assets/css/neo.css`, `neo-lite.css` and `main.css`
  are no longer loaded by any page (blog posts use `blog.css`). Left in place,
  but they are dead weight and safe to delete.
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
- **PDP gallery = eight tiles, one objection each (2026-07-30)**, in the order
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
- `/blog` — blog index (8 posts)
- `/blog/[slug]` — individual blog posts
- `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms` — policy pages
- `/llms.txt`, `/llms-full.txt` — AI/LLM context files
- `/sitemap.xml`, `/robots.txt`, `/manifest.json`
- `/admin` — private admin dashboard ("Mission Control"), served at `admin.smelloff.in` (noindex, password-gated). Single self-contained SPA `admin/index.html` + one serverless function `api/admin.js` (session login, Supabase service-role CRUD over orders/reviews/messages/waitlist/blog_comments, computed business stats, first-party analytics reports, optional GA4 Data API proxy). Order status pipeline: placed→confirmed→packed→dispatched→out_for_delivery→delivered (+upi_pending, cancelled); admin has one-tap "advance" buttons and the customer `track-order.html` timeline mirrors it. Every status change is timestamped into `orders.status_history` (jsonb `[{status,at}]`) + `orders.updated_at` by the `orders_track_status` DB trigger (migration `20260711_order_status_history.sql`), so the customer timeline shows *when* each stage happened plus an estimated-delivery window — no admin wiring needed, the trigger fires on any status update. Setup + env vars in `docs/ADMIN-SETUP.md`. Secrets (`ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GA4_*`) live only in Vercel env — never in the client. Reuses brand fonts/colors; charts follow the validated dark-mode dataviz palette.
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
