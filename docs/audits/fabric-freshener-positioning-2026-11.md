# Fabric freshener positioning (2026-11-09)

Owner: "market it as a fabric freshener, not a clothing deodorant … many competitors,
whatever makes me better do that … deep research is more important for ranking,
traffic and sales."

## What the research says

### Search demand (India)

Keyword tools had no data (Ahrefs: no plan; Semrush: 0 API units). Google Trends
(India, web search, 5 years, queried 9 Nov 2026) and Google autocomplete (`gl=in`)
were used instead. Trends gives relative interest, not volumes.

| Term (same comparison, anchored on "fabric freshener") | 5-yr avg | Last 12 months |
|---|---|---|
| fabric freshener | 0.4 | 1.2 |
| clothing deodorant | 0.1 | 0.3 |
| clothes deodorant | 1.9 | 1.9 (vs freshener 4.7 in that comparison) |
| cloth deodorant / deodorant for clothes / fabric deodorizer | 0.2–0.6 | 0.0 |
| fabric refresher, fabric odor eliminator | ~0.1 | 0.0 |

- "Fabric freshener" gets about **4×** the searches of "clothing deodorant" over the last
  year and roughly **tripled** against its own 5-year average. Its top related queries are
  "fabric freshener spray" and "fabric freshener for clothes".
- The much bigger generic terms are "clothes spray" (its top related query is
  "clothes spray freshener"), "clothes perfume" / "cloth perfume", "fabric perfume"
  (13.5 → 30, rising fast, related to fabric conditioner) and "smell remover".
- Autocomplete for "clothing deodorant" returns six suggestions, mostly about deodorant
  stains; "fabric freshener" returns a full list including "for clothes", "spray for
  clothes", "travel size", "how to use", "is fabric freshener safe", "does fabric freshener
  kill germs", "fabric freshener vs fabric conditioner".
- Our own Search Console (12 months to 1 Nov, `seo-aeo-geo-2026-11.md`): the biggest
  non-brand cluster is **"fabric freshener / refresher / spray for clothes": 1,320
  impressions, position 9.8, 0.2% CTR**. "Clothing deodorant" barely registers.

Conclusion: the owner's call matches the data. "Fabric freshener" is the category India
searches; "clothing deodorant" was a name almost nobody types.

### Competitors (Amazon.in "Fabric Deodorizer" bestsellers and search, 9 Nov 2026)

| Product | Size | Sold as / for |
|---|---|---|
| Softouch Fabric perfume Spray (#1 bestseller, 627 ratings, 1K+/month) | 350 ml | "Instant fragrance", "French perfume", 36-hour fragrance; couch, curtains, bedding, clothes |
| Febreze Fabric Refresher, UK import (Amazon's Choice) | 385–500 ml | "Eliminates odours, not just masks"; sofa, curtains, bedsheets |
| Savlon Clothes Disinfectant & Refreshing Spray (11.7K ratings, 2K+/month) | 230 ml | Germ-kill claim, fresh fragrance |
| TetraClean, Astonish, VOLT, Aroma Mist, BlueOxy | 200–750 ml | Home fabrics, carpets, shoes, car seats |
| ACO fabric perfume sprays | 40 ml | Perfume for clothes and wardrobe, "travel friendly" |
| Comfort / Softouch / Savlon fabric conditioners | 0.9–2 L | In-wash softener with fragrance (60K+/month for Comfort) |

What they share: big bottles made for the home, sold on fragrance; the one pocket size
(ACO) is a perfume. Febreze already claims "eliminates, not masks", so that alone is not a
difference. What nobody owns: **a pocket fabric freshener made only for the clothes you are
wearing, that works on the smell and leaves a light scent, and dries in 15–30 seconds.**
Search demand for "travel size" fabric fresheners confirms the use.

## What changed on the site

- **One name: "fabric freshener (spray)"** replaces "clothing deodorant" everywhere a
  customer reads it: `/` and `/odorstrike` titles, descriptions, hero eyebrow, PDP H1
  ("Pocket fabric freshener for clothes"), offer labels, cart, checkout, success screen,
  footer pitch, menu card, inner-page closing card, the guides' product card and end card,
  105 guides, llms files, share copy, the AEO skill. `product.definition` leads with
  "a pocket fabric freshener for clothes" and keeps "not a body deodorant".
  Product schema `name` is unchanged (Merchant listing stability); `alternateName` gains
  "ODORSTRIKE Fabric Freshener" and "Fabric Freshener Spray for Clothes".
- **PDP `#why` compares against the real competitors**: "Most fabric fresheners stay home.
  This one goes with you." Table: ODORSTRIKE · Home fabric freshener · Clothes perfume
  spray · Deodorant (made for / odor in the shirt / scent / size). Competitor cells stay
  modest ("Varies by brand", "Usually strong").
- **New FAQ** on `/`, `/odorstrike` and `/faq`: "How is it different from other fabric
  fresheners?"
- **New guide** `/blog/how-to-use-fabric-freshener-spray-on-clothes` for the question
  queries ("can fabric freshener be used on clothes", "how to use", "does it kill germs",
  "vs fabric conditioner", "travel size"). Sources: US EPA (antimicrobial products; more
  than 4,000 registered), American Cleaning Institute (fabric softeners), Steinemann 2016
  (n = 1,136; 23.6% report health problems near someone wearing a fragranced product).
- `what-is-fabric-odor-eliminator` retitled "What Is a Fabric Freshener? How It Works on
  Clothes" ("fabric odor eliminator" has next to no searches in India); three H2s in
  `best-fabric-odor-spray-india-2026-body-odor` now say "fabric freshener".
- llms answers: "What is the best fabric freshener for clothes in India?" and "Can you use
  a fabric freshener on clothes?"

Kept on purpose: posts that target "cloth deodorant" / "deodorant for clothes" queries
keep their titles (retitled 2 Nov; judge around 1 Dec). The GA4/Meta `item_name` stays
"ODORSTRIKE Fabric Odor Mist" for reporting continuity; `item_category` is now
"Fabric freshener".

## Owner actions (outside the repo)

1. Rename the product to the new category wherever it is listed: Google Merchant Center,
   Instagram/X/LinkedIn bios, Product Hunt, Crunchbase ("pocket fabric freshener for
   clothes").
2. An Amazon.in listing in "Fabric Deodorizer" titled for "fabric freshener spray for
   clothes, pocket / travel size": the category's bestsellers have only 30–630 ratings.
3. Search Console: request indexing for `/`, `/odorstrike`, the new guide and the retitled
   one; judge the new titles on a 28-day export in December.
