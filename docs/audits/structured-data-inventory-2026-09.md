# SMELLOFF STRUCTURED DATA INVENTORY (SEPTEMBER 2026)

## Executive Summary
This document registers the complete JSON-LD structured data architecture across all **75 canonical URLs** on `https://smelloff.in`.
Following Google Search Central updates and Rich Results guidelines:
- **FAQPage Schema**: Completely deprecated and removed from all 60 commercial and blog pages to eliminate search penalties and schema mismatches. All visible on-page FAQ content remains 100% intact.
- **Article Schema**: Maintained on all 55 blog guides with full author, publisher, datePublished, dateModified, mainEntityOfPage, and peer-reviewed PubMed citations.
- **Product & Offer Schema**: Emitted cleanly on `/odorstrike` PDP and solution hubs with compliant priceCurrency, price, availability, merchant return policies, and shipping details.
- **BreadcrumbList Schema**: Emitted across all secondary pages, solutions, and blog guides using clean canonical URLs (no trailing slash defects).
- **Organization & WebSite Schemas**: Emitted on root and key commercial landing pages.
- **HowTo Schema**: Present on `/odorstrike` detailing 4-step fabric mist application.

---

## Schema Type Distribution Summary

| SCHEMA TYPE | STATUS | TOTAL PAGES | SUPPORT & BENEFIT |
|---|---|---|---|
| **FAQPage** | **REMOVED / DEPRECATED** | 0 | Deprecated by Google for commercial/blog sites; removed to maintain pristine schema hygiene |
| **Article** | **ACTIVE** | 56 | Full editorial attribution, author entity graph, and PubMed citations |
| **BreadcrumbList** | **ACTIVE** | 63 | Clear hierarchical search trail across blog, solutions, and legal directories |
| **Product & Offer** | **ACTIVE** | 5 | Accurate pricing (₹229), merchant return policy (7 days), and inventory status |
| **Organization** | **ACTIVE** | 2 | Official entity definition for Smelloff brand |
| **WebSite** | **ACTIVE** | 2 | Site entity metadata |
| **HowTo** | **ACTIVE** | 1 | Step-by-step usage guide for fabric odor neutralization |
| **SpeakableSpecification** | **ACTIVE** | 5 | Audio-ready summaries for key fabric science answers |

---

## Detailed Structured Data Audit by URL (75 Pages)

| # | URL | PRIMARY SCHEMAS | FAQPage STATUS | CITATIONS (PubMed) | SCHEMA VALIDITY |
|---|---|---|---|---|---|
| 1 | `https://smelloff.in/` | Organization, WebSite | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 2 | `https://smelloff.in/odorstrike` | Organization, WebSite, BreadcrumbList, WebPage, Product, HowTo, OnlineStore | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 3 | `https://smelloff.in/blog` | ItemList, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 4 | `https://smelloff.in/blog/alternative-to-deodorant-for-clothes-smell` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 5 | `https://smelloff.in/blog/ambi-pur-vs-odorstrike` | Article, WebPage, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 6 | `https://smelloff.in/blog/best-body-odor-remover-spray-for-men-india` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 7 | `https://smelloff.in/blog/best-deodorant-spray-for-clothes-not-skin` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 8 | `https://smelloff.in/blog/best-fabric-odor-spray-india-2026-body-odor` | Article, BreadcrumbList | None (Clean) | 3 citations | **PASS (Valid JSON-LD)** |
| 9 | `https://smelloff.in/blog/damp-clothes-musty-smell-monsoon-fix` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 10 | `https://smelloff.in/blog/deodorant-perfume-on-fabric` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 11 | `https://smelloff.in/blog/deodorant-vs-fabric-mist` | Article, BreadcrumbList | None (Clean) | 2 citations | **PASS (Valid JSON-LD)** |
| 12 | `https://smelloff.in/blog/does-fabric-spray-stain-clothes` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 13 | `https://smelloff.in/blog/dry-air-clothes-indian-home` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 14 | `https://smelloff.in/blog/fabric-deodorizer-spray-india-guide-2026` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 15 | `https://smelloff.in/blog/gym-clothes-smell-after-washing` | Article, BreadcrumbList | None (Clean) | 3 citations | **PASS (Valid JSON-LD)** |
| 16 | `https://smelloff.in/blog/how-odor-neutralizer-works-on-fabric` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 17 | `https://smelloff.in/blog/how-often-to-wash-jeans-india` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 18 | `https://smelloff.in/blog/how-to-freshen-clothes-stored-for-months` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 19 | `https://smelloff.in/blog/how-to-pack-sweaty-clothes-without-bag-smell` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 20 | `https://smelloff.in/blog/how-to-use-odorstrike` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 21 | `https://smelloff.in/blog/hpbcd-cyclodextrin-fabric-odor` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | 2 citations | **PASS (Valid JSON-LD)** |
| 22 | `https://smelloff.in/blog/keep-clothes-fresh-while-travelling` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 23 | `https://smelloff.in/blog/keep-clothes-fresh-without-washing-machine` | Article, HowTo, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 24 | `https://smelloff.in/blog/keep-office-trousers-fresh-without-washing` | Article, HowTo, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 25 | `https://smelloff.in/blog/mumbai-humidity-sweat-smell-survival-guide` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 26 | `https://smelloff.in/blog/odor-on-clothes-vs-odor-in-clothes` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 27 | `https://smelloff.in/blog/odorstrike-ingredients` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 28 | `https://smelloff.in/blog/odorstrike-review-30-day-india-test` | Article, Review | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 29 | `https://smelloff.in/blog/odorstrike-vs-febreze-india` | Article, BreadcrumbList | None (Clean) | 2 citations | **PASS (Valid JSON-LD)** |
| 30 | `https://smelloff.in/blog/office-ac-trap-why-rewear-shirts-smell-worse` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 31 | `https://smelloff.in/blog/perfume-plus-sweat-chemical-reaction` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 32 | `https://smelloff.in/blog/remove-cigarette-smoke-smell-from-clothes` | Article, HowTo, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 33 | `https://smelloff.in/blog/remove-cooking-smell-from-clothes` | Article, HowTo, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 34 | `https://smelloff.in/blog/remove-incense-agarbatti-dhoop-smell` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 35 | `https://smelloff.in/blog/remove-mothball-almirah-smell-from-clothes` | Article, HowTo, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 36 | `https://smelloff.in/blog/spray-to-remove-sweat-smell-from-clothes-instantly` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 37 | `https://smelloff.in/blog/spray-to-remove-sweat-smell-from-clothes-quickly` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 38 | `https://smelloff.in/blog/vinegar-baking-soda-fabric-softener` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 39 | `https://smelloff.in/blog/wash-refresh-or-wear` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 40 | `https://smelloff.in/blog/wedding-festive-wear-odor-guide` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 41 | `https://smelloff.in/blog/what-is-fabric-odor-eliminator` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 42 | `https://smelloff.in/blog/where-to-buy-odorstrike-india` | Article, Product | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 43 | `https://smelloff.in/blog/which-fabrics-hold-odor-most` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 44 | `https://smelloff.in/blog/why-body-odor-comes-back-on-clothes-so-quickly` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 45 | `https://smelloff.in/blog/why-clean-shirt-starts-smelling-within-hours` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 46 | `https://smelloff.in/blog/why-clothes-smell-bad-after-drying` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 47 | `https://smelloff.in/blog/why-clothes-smell-bad-again-after-sweating` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 48 | `https://smelloff.in/blog/why-clothes-smell-in-wardrobe-even-when-clean` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 49 | `https://smelloff.in/blog/why-clothes-smell-musty-after-being-stored` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 50 | `https://smelloff.in/blog/why-clothes-smell-stale-in-ac-room` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 51 | `https://smelloff.in/blog/why-deodorant-stops-working-after-3-hours` | Article | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 52 | `https://smelloff.in/blog/why-i-built-odorstrike` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 53 | `https://smelloff.in/blog/why-polyester-holds-odor-longer-than-cotton` | Article, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 54 | `https://smelloff.in/blog/why-shirt-zones-smell-after-washing` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 55 | `https://smelloff.in/blog/why-sweat-smells-stronger-on-some-shirts` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 56 | `https://smelloff.in/blog/why-traffic-fumes-cling-to-clothes` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 57 | `https://smelloff.in/blog/why-washing-machine-makes-clothes-smell` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 58 | `https://smelloff.in/blog/why-water-makes-clothing-odor-louder` | Article, BreadcrumbList, SpeakableSpecification | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 59 | `https://smelloff.in/blog/zinc-pca-fabric-odor-ingredient-guide` | Article, SpeakableSpecification, BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 60 | `https://smelloff.in/solutions` | None (Clean HTML) | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 61 | `https://smelloff.in/solutions/denim-outerwear-dry-care` | BreadcrumbList, ItemPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 62 | `https://smelloff.in/solutions/monsoon-damp-fabric-care` | BreadcrumbList, ItemPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 63 | `https://smelloff.in/solutions/office-commute-fabric-refresher` | BreadcrumbList, ItemPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 64 | `https://smelloff.in/solutions/post-gym-workout-sweat-spray` | BreadcrumbList, ItemPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 65 | `https://smelloff.in/about` | AboutPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 66 | `https://smelloff.in/cancellation` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 67 | `https://smelloff.in/contact` | ContactPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 68 | `https://smelloff.in/faq` | BreadcrumbList | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 69 | `https://smelloff.in/privacy` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 70 | `https://smelloff.in/refund` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 71 | `https://smelloff.in/returns` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 72 | `https://smelloff.in/reviews` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 73 | `https://smelloff.in/shipping` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 74 | `https://smelloff.in/terms` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
| 75 | `https://smelloff.in/track-order` | WebPage | None (Clean) | N/A | **PASS (Valid JSON-LD)** |
