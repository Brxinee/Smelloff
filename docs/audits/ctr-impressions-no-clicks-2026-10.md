# Impressions but no clicks: why, and what changed (2026-10-15)

## What the data says
- GSC Apr–Oct 2026: 687 clicks on 24.5k impressions (2.8%). About 500 of those
  clicks are the homepage (`/` + `www/`), i.e. people searching the brand. The
  guides collect impressions and almost no clicks.
- Indexing fell 74 → 22 pages between 22 Sep and 5 Oct (the Cloudflare error-1000
  window, fixed 10 Oct). Pages Google dropped come back only as it recrawls them.
- Round 3 found GSC queries at positions #5–12 with no clicks.
- Live per-query data was not reachable this round (Ahrefs GSC, Semrush and
  Windsor GA4 all refused on plan/licence). Export Search results → Queries and
  Pages for the last 3 months to rank the next round.

## Why competitors get the click
The how-to results for these queries ("remove smell from clothes without
washing", "clothes smell after drying", "can deodorant be used on clothes") are
DhobiLite, Rinse, Neakasa, MoralFibres, The Eco Hub, Real Homes and Amazon/
Flipkart listings. What their results have that ours didn't:
1. **A concrete promise in the title.** "6 Clever Ways to…", "(5-Min Fixes)",
   "8+ Reasons … (Fixes!)". Ours were bare statements or questions, sometimes
   with a slogan for an H1.
2. **Title = H1.** Google rewrites ~61% of titles (Zyppy, 81k titles) and takes
   the H1 first when it does (Ahrefs: 50.8%). A number in both title and H1
   survives 97% of the time. Seven of our posts had H1s like "Three additives.
   Three jobs. Zero killers." or "Cage, not cover." — a candidate result title
   that says nothing about the query.
3. **Authority.** They are older domains with many links; our Product Hunt page
   has 0 upvotes. Rankings at #8–40 get almost no clicks whatever the snippet.
4. **Stars.** Marketplace listings show review stars; our Product has none
   (needs real verified-buyer reviews).

## What no snippet fixes
- **AI Overviews.** Organic CTR on informational queries with an AI Overview fell
  ~61% (Seer Interactive, 25M impressions, 2024→2025); Ahrefs measured −34.5% for
  the #1 result. Nearly every "why do clothes smell…" query is that type. Being
  the cited source is the remaining route (answer-first blocks, llms files —
  already in place).
- **Positions.** Page-2 impressions don't turn into clicks.

## Implemented
- `scripts/seo/apply-serp-titles.mjs`: new title + matching H1 + description for
  32 posts (og/twitter, Article headline and breadcrumb kept in step). Every
  number comes from the post ("6 spots" = the washing-machine table's six rows,
  "5 reasons" = the gym table's five causes, "10 minutes" = the cooking post's
  reset section). No " | Smelloff" suffix, all 40–60 characters.
- Test: every post's H1 shares at least half its title's words; the script's
  `--check` runs in `npm run build`.

## Owner, outside the repo
1. GSC → URL Inspection → Request indexing for the retitled posts (≈10 a day),
   hub first. Compare CTR for those pages 28 days before/after.
2. Send the 3-month Queries + Pages export: the next round ranks pages by
   impressions at positions 4–15 (the ones a better snippet moves).
3. Reviews: ask delivered customers; stars need real verified buyers.
4. Links: Amazon.in / Flipkart listing, a few Indian lifestyle/men's-grooming
   features, Reddit/Quora answers that link a guide. Authority is the ceiling.

Sources: zyppy.com/seo/google-title-rewrites, ahrefs.com/blog/title-tags-study,
backlinko.com/google-ctr-stats, seerinteractive.com/insights/aio-impact-on-google-ctr-september-2025-update,
ppc.land (Ahrefs AIO study write-up).
