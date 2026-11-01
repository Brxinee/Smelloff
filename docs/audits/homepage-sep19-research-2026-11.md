# Homepage (Sep 19 design): what works, what doesn't — 2026-11-01

Owner: "deep research what design works what not and then implement … just
home page." The Sep 19 design language (Fraunces / Inter Tight / JetBrains
Mono, acid lime on black, the "Your shirt remembers" story) is kept. Only the
order, the first screen and a few blocks changed.

## Our own data
45 days of first-party `page_views` on `/`: ~130 real visitor-days (India
phones 31, desktop 17 + 35 outside India). A further 272 "tablet" views from 75
visitor-days come mostly from one repeat device, so they say little about
buyers. Section-reach events on the October design fell from 64 (first
section) to 34 (last). The sample is far too small to A/B test; decisions rest
on the published research below. The one usable signal (Oct, events): phone
visitors chose the product route over buy ~3:1 from the hero.

## Measured problems (live page, 390×844 phone, before this pass)
| Problem | Measured |
|---|---|
| Price and buy button below the first screen | price at 916px, buy at 1050–1101px (screen ends 844) |
| Bottle + how-it-works card stood between the H1 and the price | 304px + 141px |
| COD absent from the page except one FAQ answer | 0 mentions near any CTA |
| "How to use" said four times | demo card, usage pills, scrubber reset, FAQ |
| Proof 5.6 screens down, after the offer | voices at 4714px, offer at 3317px |
| No multi-bottle offer | packs only on /odorstrike |
| Page ended on the FAQ | no buy route after it but the sticky bar |
| "7-day returns" icon drew a solid lime square | `.ico-shield` had no mask |
| Page length | 11.8 screens |

## Research
- **Attention is front-loaded.** NN/g eyetracking: 57% of viewing time is
  above the fold, 17% on the second screen, the rest thinly spread
  ([NN/g, Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/)).
  → price and the buy button belong on screen one.
- **Value proposition + useful hero, one static image.** NN/g homepage
  principles; decorative graphics get skipped; carousels underperform
  ([NN/g homepage principles](https://nngroup.com/articles/homepage-design-principles/),
  [NN/g carousels](https://www.nngroup.com/articles/designing-effective-carousels/)).
  → keep the one bottle image, shrink it on phones so it doesn't push the offer down.
- **Proof works next to the decision, not in a grid far away**
  (directional, vendor studies:
  [Digital Applied 2,000-page study](https://www.digitalapplied.com/blog/landing-page-conversion-study-2000-pages-tested-2026),
  [Atticus Li, testimonial placement](https://www.atticusli.com/blog/posts/testimonial-placement-science-social-proof-works-backfires/)).
  Generic "trusted by thousands" lines do nothing; named, specific quotes help.
  → move the three named beta-tester quotes directly above the offer box.
- **COD and returns are India's first-purchase trust signals.** Estimates of
  COD share range 40–65% of orders, higher in tier 2/3 cities; 54% of Indian
  shoppers won't buy if they don't trust delivery/returns (Blue Dart/DHL)
  ([Upstox / ET Prime](https://upstox.com/news/upstox-originals/investing/is-cash-on-delivery-quietly-costing-you-more/article-184260),
  [Social Samosa](https://www.socialsamosa.com/report/prepaid-e-commerce-orders-rise-10958917),
  [Blue Dart](https://api.bluedart.com/press329)).
  → "Cash on Delivery / Free shipping on prepaid / 7-day returns" right under
  the hero button, in the trust strip and the offer box (no COD amount: that
  stays in checkout).
- **Repetition is extraneous load.** Users scan headings (layer-cake);
  elements that add nothing slow the decision
  ([Blacksmith, cognitive load](https://blacksmith.agency/resources/web-design/reduce-cognitive-load/)).
  → drop the hero usage pills (the how-it-works card says the same), drop the
  founder paragraph that repeated "Hyderabad / Made in India".
- **Multi-packs lift order value when the per-unit price is shown**
  ("₹179.80 each" beats "save ₹246"), opt-in, not pre-selected
  ([ContentGrip](https://www.contentgrip.com/product-bundling-strategies/),
  [Racklify](https://racklify.com/encyclopedia/how-to-structure-a-bundle-offer-to-increase-average-order-value/)).
  → two pack links in the offer box, at checkout prices from config.
- **Every long page should end on its action** (single-goal landing pages:
  a CTA after each decision block). → closing buy box after the FAQ.

## What changed (homepage only)
1. Phone hero: smaller bottle (≈190px, was 304px), 24px top padding (was 84px,
   a fix for an old overlapping header), how-it-works card moved below the
   button. Buy now ends at 716px on 390×844 (was 1101px), 724px on 360×740.
2. Hero secondary button → "View product details" (/odorstrike), the route
   phone visitors preferred.
3. COD / free prepaid shipping / 7-day returns line right under the hero button.
4. Trust strip: "Cash on Delivery" replaces "Based in Hyderabad" (it repeated
   "Made in India"); "Free prepaid shipping"; the returns shield icon works.
5. Reviews moved directly above the offer box.
6. Offer box: "Cash on Delivery" in its meta line; 2 for ₹419 (₹209.50 each)
   and 5 for ₹899 (₹179.80 each) as opt-in links (`?buy=1&qty=N`).
7. Founders: two paragraphs (was three).
8. Closing buy box after the FAQ (`#final`).
9. Sticky phone bar: "ODORSTRIKE · ₹229 / Cash on Delivery", shown only while
   no on-page buy button (hero, offer, close) is on screen.

Result: 0 axe (WCAG 2.2 AA) violations at 320/390/768/1280, no overflow, CLS
0.000 on load, LCP 152ms locally. Page 10,147px on a phone (was 10,001; the
close box adds what the cuts saved). Section reach now covers `#final`.

## Measure next
`events` → `view_content` labels `home_sec_*` (reach per section) and clicks
on `FIX MY SHIRT — ₹229`, `View product details`, `2 for ₹419`, `5 for ₹899`.
Compare homepage → `/odorstrike?buy=1` sessions before/after 2026-11-01 once
there are a few hundred real phone visits.
