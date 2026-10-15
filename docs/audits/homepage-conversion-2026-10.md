# Homepage redesign for orders (2026-10-15)

Owner: "I want my website to be the best D2C website that actually sells, not
just look nice … a redesign of the homepage, and for that you need deep
research." Builds on `competitor-conversion-2026-10.md` (same day).

## What the site's own data says (first-party `page_views` / `events`, 90 days)
- **Real buyers are on phones.** Homepage visitors from India: 239 mobile,
  44 tablet, 141 desktop. The 527 non-India desktop "visitors" are mostly
  crawlers (8 of them reached `/odorstrike`).
- **The homepage already sends phones onward**: 32% of Indian mobile homepage
  visitors open `/odorstrike` the same day; 8.5% on Indian desktop.
- **People engaged with pack options** when an older homepage showed them
  (Duo/Trio cards were clicked by 4–5 visitors each, as often as the main buy
  button). The current homepage didn't mention the new 2 for ₹419 at all.
- The most-clicked thing on phones is "Open menu" (29 visitors): people look
  for more than the page shows.
- Reviews: one review is tied to a real order (Adilabad, 5★, Aug 2026); the
  other is the founder's own and is not shown.

## What the research says works (and what it doesn't)
| Finding | Source | Used for |
|---|---|---|
| 57% of viewing time is above the fold; keep the main CTA there | NN/g, *Scrolling and Attention* (2018) | Hero unchanged; the pair offer goes *below* the button so the CTA stays clear of the first-visit consent bar |
| Static hero beats auto-rotating carousels on mobile | Baymard guideline #957 | Kept one static photo |
| ≥5 reviews make a purchase ~270% more likely; a "Verified buyer" label adds ~15% | Spiegel Research Center (via Lipscore) | Real verified review shown first, labelled; no stars or counts until there are five |
| Price + MRP + saving, COD badge, returns near the button, sticky mobile buy bar are the strongest tests for Indian D2C | Impulse Digital CRO tests; eChai "trust signals for a new Indian brand" | Already present; kept. The pack picker restates them by the button |
| Indian D2C traffic is mostly mobile; Indian Shopify stores convert ~1.2–1.5% | AimNLaunch / eChai | Mobile-first layout, phones checked at 390×844 |
| Quantity offers lift a low AOV | GoKwik / competitor research | Pack picker: 1 bottle ₹229 or 2 for ₹419 |
| Visitors must recognise their problem fast | Problem → solution page structure (dudewipes-style, already the model) | New "It's not you. It's the shirt." moments grid |

Not used, on purpose: countdown timers, "X bought today", spin wheels,
pre-selecting the 2-pack (CCPA dark-pattern guidelines 2023: basket sneaking,
false urgency). Autoplay video: the reels in project files were made for
Instagram and the owner moved to a vector version; a short muted loop is a
good next test once the owner picks a cut.

## What changed on `/`
1. **Hero:** unchanged above the button; a line under it, "One for home, one
   for the office? 2 for ₹419 · save ₹39", opens checkout on two bottles.
2. **New "Where it happens":** six moments (commute, bike ride, food, smoke,
   monsoon musty, day-two jeans) so a visitor sees their own situation first.
3. How it works and the "Your skin has a fix" beats stay; the fourth beat
   (dries clear) moved into the comparison note — its photo is the lowest
   resolution on the page.
4. **New comparison:** ODORSTRIKE vs deodorant (≥520px) vs clothes perfume
   spray vs washing again. It says plainly that ODORSTRIKE doesn't remove
   dirt or stains.
5. **Reviews:** the verified buyer first, then the three beta testers.
6. **Offer box → "Pick your pack."** 1 bottle (selected) or 2 bottles ₹419;
   the button and link follow the choice (`/odorstrike?buy=1&qty=2`).
7. The hidden placeholder combos section is deleted.

`/odorstrike` reads `?qty=N` (1–10) with `?buy=1`. Tests:
`test/product-config.test.mjs` (pack picker, qty deep link, moments,
comparison, verified review).

## What to measure
`events` labels `home_pack_1` / `home_pack_2`, `home_hero_pair`, and
`checkout_start` with `home_pack`. Compare homepage → checkout rate and
bottles per order for 30 days.

## Re-audit, same day

- **Bug found:** on desktop the three `#why` photos each sat a row below their
  copy (an empty half-screen beside every block). The `<picture>` wrappers
  are `display:contents`, so their `<source>` became the first grid cell.
  Fixed with `.ph-pic>source{display:none}` on `/` and `/odorstrike`. Desktop
  page: 10,028px → 9,183px.
- **Data:** in 120 days of first-party events on `/` from India phones,
  "SEE ODORSTRIKE" was tapped by 38 visitors and the buy buttons by ~14. People
  want to look before they buy. The hero now has "See the product" as a real
  button beside "Buy now — ₹229" instead of a text link under it (one row, so the
  hero got 52px shorter; Buy still ends at y≈689 on 390×844).
- **Offer box on phones:** the in-hand photo panel went from 4:5 (~410px) to
  3:2 (~220px), whole photo on black, so the pack choice starts ~190px sooner.
- Review byline wraps under the name on narrow cards.
- **Measurement added:** `view_content` events `home_sec_<id>` per section.
  After two weeks of traffic, compare reach for `#moments`, `#compare` and
  `#buy` to decide what to cut. There was no scroll data before.
- Phone page: 10,970px → 10,651px.
