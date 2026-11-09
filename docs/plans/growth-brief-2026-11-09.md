# Working brief: India traffic, AI citations and sales (2026-11-09)

Owner's ask: "more traffic from India and clicks … cited everywhere like AI, browsers …
sales as well … research deeper, then improve visibility, traffic and sales."

This is the brief I hold myself to for this pass. Every step names its evidence and its
check, so nothing is done on a hunch.

## Goal, in order of money

1. **Sales:** more Indian visitors reach `/odorstrike` and buy.
2. **Clicks from India:** more non-brand clicks from Google India (now 31 clicks on 6,141
   non-brand impressions in 3 months; India CTR 2.96% overall, mostly brand).
3. **Citations:** ODORSTRIKE is named and linked when people ask ChatGPT, Perplexity,
   Gemini, Copilot or Google's AI Overviews about clothes that smell, fabric sprays or
   "deodorant for clothes" in India.

## Hard rules (from CLAUDE.md; break none)

- Facts only from `config/product.json`. No invented numbers, tests, reviews, ratings,
  volumes or awards. Every outside claim has a source I fetched.
- Prices only on `/` and `/odorstrike` (plus the listed price-question posts). No COD amount
  outside checkout. Never "not a deodorant"; say "not a body deodorant".
- Clothing only: no shoes, bags, helmets, gym gear, car seats, rooms. Never on skin.
- Never write, seed or edit a review. Never add stars from beta quotes.
- Sales-first wording on money pages: answer a doubt, never plant one; no cheaper
  substitutes in FAQs.
- Don't retitle the 8 guides changed on 2 Nov before a 28-day export (about 1 Dec).
- Don't base design decisions on first-party behaviour data (mostly the owner's visits).
- No duplicate content or intent duplicates.
- Outward actions (posting on Reddit/Quora, Merchant Center, Bing Webmaster, marketplace
  listings) are the owner's: I prepare them, I don't do them.

## Research first (each answer must change what I build)

1. **How AI assistants pick sources in 2025–26:** what published studies (not vendor
   blogs alone) say gets a page cited by ChatGPT search, Perplexity, Gemini/AI Overviews and
   Copilot: index source (Bing for ChatGPT/Copilot), crawler access, answer-first passages,
   freshness, entity consistency, off-site mentions.
2. **Who is cited today** for our core Indian questions ("deodorant for clothes", "how to
   remove sweat smell from clothes without washing", "best fabric freshener for clothes in
   India", "clothes smell after washing"). Find which domains win, and why.
3. **Crawler access on the live site:** robots.txt, response codes and blocking for
   GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended,
   Bingbot, Applebot. A blocked AI search crawler means zero citations, whatever the content.
4. **Indian demand not yet covered:** Hindi/Hinglish phrasings, seasonal peaks (summer,
   monsoon, wedding season, festivals), city-specific needs, re-checked against all 117
   posts for duplicates.
5. **The click gap:** pages with impressions but almost no clicks that were *not* retitled on
   2 Nov; diagnose the snippet (title, description, intent match) from the GSC export.
6. **The sales path:** from a guide to `/odorstrike` to checkout; what Baymard/NN/g-grade
   research says stops Indian D2C buyers (COD, trust, delivery date, returns) and what is
   still missing on the page, without redesigning what the owner has decided.

## Build (only what the research supports)

- Fix any crawler or indexing blocker first.
- Make every key page quotable: one self-contained answer passage per question, the
  entity name used the same way everywhere, dates visible, sources linked.
- Fill real Indian demand gaps with new or extended content, only where no live post
  answers the intent.
- Rewrite snippets only for pages not retitled on 2 Nov, and only where the query data
  shows a mismatch.
- Strengthen the guide → product path where it is weak, with no new prices or claims.
- Prepare the off-site work (citations come mostly from other sites): ready-to-post
  answers and profile texts for the owner, each factual and disclosed as the founder's.

## Checks before anything ships

`npm test` green; `npm run build` passes its production audit; a live-style render of
every changed template at 390px; a duplicate check for any new post; a draft PR with what
changed, the evidence for it, and the owner's list. Report what was not done and why.
