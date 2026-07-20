# SEO Backlog — things that need YOU (ranked by impact)

Everything code-fixable from the 2026-06-12 audit is already shipped (see `seo-audit.md`). This file is only what requires your action — content, accounts, or judgment calls.

---

## P0 — High impact, do this week

### 1. Get real customer reviews (the single biggest gap)
The Product schema shows `ratingCount: 3`. Rich-result stars and AI-Overview citations both weight review volume heavily. Target: 10+ marked-up reviews.
- WhatsApp every COD customer 3 days post-delivery with a one-line review ask
- How-to-add instructions already live in an HTML comment above the Product schema in `index.html`
- Do **not** add ratings without real reviews behind them

### 2. Resubmit sitemap + request indexing in GSC
The sitemap changed (payment-failed removed). In Search Console:
- Resubmit `https://www.smelloff.in/sitemap.xml`
- Request indexing for the 4 posts that got new FAQPage schema: `/blog/remove-sweat-smell-shirts-without-washing`, `/blog/clothes-smell-after-washing`, `/blog/deodorant-vs-fabric-mist`, `/blog/gym-clothes-smell-after-washing`
- Use URL Removal tool for `https://www.smelloff.in/payment-failed` if it's already indexed

### 3. Run the four FAQ pages through Google's Rich Results Test
https://search.google.com/test/rich-results — after the next deploy. The JSON-LD validates locally, but confirm Google's parser agrees and watch GSC → Enhancements → FAQ over the next 2 weeks.

## P1 — Medium impact, this month

### 4. Lighthouse on production
No headless Chrome in this build environment, so CWV numbers are unverified. Run on https://www.smelloff.in/ and `/blog/gym-clothes-smell-after-washing` (mobile, throttled). Static analysis says LCP/CLS should be healthy (preloaded fonts, sized images, deferred JS) — confirm INP on the buy-section interactions and the blog-index filter, the two heaviest JS surfaces.

### 5. Semrush position checks (manual — MCP access not on current plan)
The Semrush MCP integration returned a plan-restriction error, so these are manual:
- Position tracking: confirm the 4 FAQ-target queries are in the ~220 tracked keywords; add if missing: *how to remove smell from clothes without washing*, *fabric odor spray vs deodorant*, *why do clothes smell after washing*, *best odor remover for gym clothes india*
- Watch the 4 upgraded posts for movement over 4–6 weeks (FAQ schema typically shows in 2–3)
- Site Audit re-crawl after deploy — the 2 redirect-chain warnings should clear

### 6. Title/description trims — individual content decisions, not bulk edits
These display-truncate in SERPs. Worth fixing one at a time while watching rankings (all rank-bearing pages; don't bulk-edit):
- `remove-sweat-smell-shirts-without-washing` — title is 83 chars; suggest dropping "(2026 India Guide)" → 64 chars
- `what-is-fabric-odor-eliminator` (78), `best-fabric-odor-spray-india-2026-body-odor` (77), `best-deodorant-spray-for-clothes-not-skin` (76) — trim parentheticals
- ~18 meta descriptions run 165–194 chars (worst: `sherwani-bandhgala` at 194) — front-load the answer in the first 155 chars when you next touch each post

### 7. Decide fate of two orphaned files
`blog/best-fabric-odor-spray-india-2026.html` and `blog/where-to-buy-odorstrike-india.html` are unreachable (vercel.json 301s their URLs away) but still in the repo. Recommend deleting both. Alternative worth considering: *un-redirect* `/blog/where-to-buy-odorstrike-india` — "where to buy X" is a classic LLM/AI-Overview query and the page answers it better than the homepage the redirect dumps users on. Your call; if you revive it, re-add it to sitemap + blog index.

## P2 — Lower impact / ongoing

### 8. Content to write (cluster gaps)
From `../plans/cluster-plan.md` and query patterns the blog doesn't yet cover:
- "fabric odor spray safe for baby clothes / kids uniforms" (school-uniform post gets the traffic; safety query is unanswered)
- "odorstrike ingredients" as a dedicated indexable page (currently split across two zinc posts + llms.txt)
- Hindi-market note: brief says English-only on site — fine, but consider an FAQ answering "is ODORSTRIKE available on Amazon/Flipkart" since that's the #1 *where to buy* follow-up LLMs ask

### 9. AEO polish on narrative posts
Three story-style posts open with scene-setting instead of a direct answer: `bike-rider-sweat-smell-india`, `office-ac-trap-why-rewear-shirts-smell-worse`, `why-i-built-odorstrike` (the last is intentionally a founder story — leave it). If the first two ever stall in rankings, add a 40–60-word answer box above the narrative.

### 10. Cosmetic heading hierarchy
~48 posts jump h2→h4 (the h4 is the product-name element in comparison cards). Zero ranking impact, minor a11y. Fix opportunistically when editing posts.

### 11. Monitor AI citations monthly
Ask ChatGPT/Perplexity/Gemini: "best fabric odor spray India", "how to remove sweat smell from clothes without washing", "what is ODORSTRIKE". Log whether smelloff.in is cited and whether the fabric-only/not-deodorant framing survives. llms.txt is strong; this is the feedback loop that tells you if it's working.
