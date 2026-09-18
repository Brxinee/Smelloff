# Smelloff Complete URL Inventory & Indexing Architecture Audit (September 2026)

**Audited Domain:** `https://smelloff.in`  
**Host Architecture:** Apex canonical domain (`https://smelloff.in`), single SKU (ODORSTRIKE 50ml, ₹229), static HTML + vanilla JS on Vercel Edge Network.  
**Sitemap File:** `https://smelloff.in/sitemap.xml` (75 URLs, capped `lastmod` <= current date, single XML escaping).  
**Canonical Rule:** Clean URLs (no `.html`, no trailing slash except root `/`, no `www`).

---

## 1. Executive Summary

| Category | URL Count | Canonical Status | Sitemap Status | Indexing Directive |
| :--- | :--- | :--- | :--- | :--- |
| **Homepage** | 1 | `https://smelloff.in/` | Included (Priority 1.0) | `index, follow` |
| **Product Core** | 1 | `https://smelloff.in/odorstrike` | Included (Priority 0.9) | `index, follow` |
| **Solutions Hub & Use Cases** | 5 | `https://smelloff.in/solutions/*` | Included (Priority 0.8) | `index, follow` |
| **Blog & Knowledge Base** | 57 | `https://smelloff.in/blog/*` | Included (Priority 0.6–0.7) | `index, follow` |
| **Trust, Reviews & Utilities** | 5 | `https://smelloff.in/*` | Included (Priority 0.5–0.7) | `index, follow` |
| **Legal & Policies** | 6 | `https://smelloff.in/*` | Included (Priority 0.3) | `index, follow` |
| **Total Indexable Pages** | **75** | **100% Valid & Self-Referential** | **100% In Sitemap (75/75)** | **index, follow** |
| **Utility / Non-Indexable** | 3+ | Excluded / noindex | Excluded (0 in sitemap) | `noindex, nofollow` / 404 |

---

## 2. Complete Inventory of Indexable URLs (75 Pages)

### 2.1 Core Conversion Pages (2 URLs)
| URL Path | Canonical URL | Sitemap Priority | Hreflang (`en-IN` & `x-default`) | Primary Search Intent |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `https://smelloff.in/` | 1.0 | `https://smelloff.in/` | Brand, Direct Fabric Odor Eliminator, Overview |
| `/odorstrike` | `https://smelloff.in/odorstrike` | 0.9 | `https://smelloff.in/odorstrike` | Product Landing & Checkout (ODORSTRIKE 50ml ₹229) |

### 2.2 Solutions Hub & Use-Case Landing Pages (5 URLs)
| URL Path | Canonical URL | Sitemap Priority | Hreflang (`en-IN` & `x-default`) | Primary Search Intent |
| :--- | :--- | :--- | :--- | :--- |
| `/solutions` | `https://smelloff.in/solutions` | 0.8 | `https://smelloff.in/solutions` | Category / Use Case Hub Directory |
| `/solutions/denim-outerwear-dry-care` | `https://smelloff.in/solutions/denim-outerwear-dry-care` | 0.8 | `https://smelloff.in/solutions/denim-outerwear-dry-care` | Denim & Heavy Jacket Dry Care / Anti-Odor |
| `/solutions/monsoon-damp-fabric-care` | `https://smelloff.in/solutions/monsoon-damp-fabric-care` | 0.8 | `https://smelloff.in/solutions/monsoon-damp-fabric-care` | Monsoon Dampness & Musty Wardrobe Fabric Care |
| `/solutions/office-commute-fabric-refresher` | `https://smelloff.in/solutions/office-commute-fabric-refresher` | 0.8 | `https://smelloff.in/solutions/office-commute-fabric-refresher` | Daily Office Commute, Pollution & Metro Sweat Spray |
| `/solutions/post-gym-workout-sweat-spray` | `https://smelloff.in/solutions/post-gym-workout-sweat-spray` | 0.8 | `https://smelloff.in/solutions/post-gym-workout-sweat-spray` | Post-Workout Gym Wear & Activewear Odor Eliminator |

### 2.3 Educational Articles & Knowledge Base (57 URLs)
| URL Path | Canonical URL | Sitemap Priority | Hreflang (`en-IN` & `x-default`) | Primary Search Intent |
| :--- | :--- | :--- | :--- | :--- |
| `/blog` | `https://smelloff.in/blog` | 0.7 | `https://smelloff.in/blog` | Blog Index & Article Directory |
| `/blog/ac-room-clothes-smell` | `https://smelloff.in/blog/ac-room-clothes-smell` | 0.6 | `https://smelloff.in/blog/ac-room-clothes-smell` | AC Room Trapped Moisture Fabric Odor |
| `/blog/almirah-wardrobe-smell-clothes` | `https://smelloff.in/blog/almirah-wardrobe-smell-clothes` | 0.6 | `https://smelloff.in/blog/almirah-wardrobe-smell-clothes` | Wardrobe & Cupboard Musty Smell Remedies |
| `/blog/armpit-sweat-smell-wont-wash-out` | `https://smelloff.in/blog/armpit-sweat-smell-wont-wash-out` | 0.6 | `https://smelloff.in/blog/armpit-sweat-smell-wont-wash-out` | Persistent Underarm Sweat Smell in Shirts |
| `/blog/auto-bus-commute-sweat-smell` | `https://smelloff.in/blog/auto-bus-commute-sweat-smell` | 0.6 | `https://smelloff.in/blog/auto-bus-commute-sweat-smell` | Public Transit Commuter Fabric Odor Guide |
| `/blog/baking-soda-vs-odorstrike` | `https://smelloff.in/blog/baking-soda-vs-odorstrike` | 0.6 | `https://smelloff.in/blog/baking-soda-vs-odorstrike` | DIY Baking Soda vs Molecular Odor Elimination |
| `/blog/best-deodorant-spray-for-clothes-not-skin` | `https://smelloff.in/blog/best-deodorant-spray-for-clothes-not-skin` | 0.6 | `https://smelloff.in/blog/best-deodorant-spray-for-clothes-not-skin` | Clothing Deodorant Spray vs Body Deodorants |
| `/blog/best-fabric-freshener-odor-spray-india-2026` | `https://smelloff.in/blog/best-fabric-freshener-odor-spray-india-2026` | 0.7 | `https://smelloff.in/blog/best-fabric-freshener-odor-spray-india-2026` | Top Fabric Fresheners & Spray Guide in India 2026 |
| `/blog/blazer-coat-smell-after-dry-clean` | `https://smelloff.in/blog/blazer-coat-smell-after-dry-clean` | 0.6 | `https://smelloff.in/blog/blazer-coat-smell-after-dry-clean` | Chemical & Trapped Odor in Dry-Cleaned Blazers |
| `/blog/body-odor-vs-fabric-odor` | `https://smelloff.in/blog/body-odor-vs-fabric-odor` | 0.6 | `https://smelloff.in/blog/body-odor-vs-fabric-odor` | Biology of Skin BO vs Textile Microbial Odor |
| `/blog/can-you-spray-perfume-on-sweaty-clothes` | `https://smelloff.in/blog/can-you-spray-perfume-on-sweaty-clothes` | 0.6 | `https://smelloff.in/blog/can-you-spray-perfume-on-sweaty-clothes` | Why Masking Sweat with Perfume Fails |
| `/blog/cheap-vs-premium-fabric-sprays` | `https://smelloff.in/blog/cheap-vs-premium-fabric-sprays` | 0.6 | `https://smelloff.in/blog/cheap-vs-premium-fabric-sprays` | Chemical Comparison: Fragrance Water vs Active Zinc |
| `/blog/chemical-breakdown-sweat-odor` | `https://smelloff.in/blog/chemical-breakdown-sweat-odor` | 0.6 | `https://smelloff.in/blog/chemical-breakdown-sweat-odor` | Chemistry of Isovaleric Acid & Thioalcohols |
| `/blog/cigarette-smoke-smell-on-clothes-fix` | `https://smelloff.in/blog/cigarette-smoke-smell-on-clothes-fix` | 0.6 | `https://smelloff.in/blog/cigarette-smoke-smell-on-clothes-fix` | Removing Thirdhand Smoke & Nicotine from Fabrics |
| `/blog/college-hostel-laundry-smell-hacks` | `https://smelloff.in/blog/college-hostel-laundry-smell-hacks` | 0.6 | `https://smelloff.in/blog/college-hostel-laundry-smell-hacks` | Hostel & Dorm Room Laundry Care Hacks |
| `/blog/curry-cooking-smell-clothes-remedy` | `https://smelloff.in/blog/curry-cooking-smell-clothes-remedy` | 0.6 | `https://smelloff.in/blog/curry-cooking-smell-clothes-remedy` | Removing Cooking Oil & Spices from Clothes |
| `/blog/detergent-leaves-sour-smell-clothes` | `https://smelloff.in/blog/detergent-leaves-sour-smell-clothes` | 0.6 | `https://smelloff.in/blog/detergent-leaves-sour-smell-clothes` | Over-Detergent Residue & Sour Laundry Odor |
| `/blog/does-sun-drying-kill-sweat-smell` | `https://smelloff.in/blog/does-sun-drying-kill-sweat-smell` | 0.6 | `https://smelloff.in/blog/does-sun-drying-kill-sweat-smell` | UV Light Limitations on Polymer Fabric Odors |
| `/blog/dry-cleaning-cost-vs-odorstrike` | `https://smelloff.in/blog/dry-cleaning-cost-vs-odorstrike` | 0.6 | `https://smelloff.in/blog/dry-cleaning-cost-vs-odorstrike` | Cost Analysis: Dry Cleaning Bills vs Point Care |
| `/blog/dry-cleaning-vs-fabric-spray` | `https://smelloff.in/blog/dry-cleaning-vs-fabric-spray` | 0.6 | `https://smelloff.in/blog/dry-cleaning-vs-fabric-spray` | Comparing Perc Solvents vs Zinc Chelation |
| `/blog/fabric-odor-science-zinc-ricinoleate` | `https://smelloff.in/blog/fabric-odor-science-zinc-ricinoleate` | 0.6 | `https://smelloff.in/blog/fabric-odor-science-zinc-ricinoleate` | Scientific Mechanisms of Zinc PCA & Chelation |
| `/blog/fabric-refresher-vs-perfume` | `https://smelloff.in/blog/fabric-refresher-vs-perfume` | 0.6 | `https://smelloff.in/blog/fabric-refresher-vs-perfume` | Functional Odor Eliminator vs Fragrance Formulation |
| `/blog/fast-fashion-smells-bad-faster` | `https://smelloff.in/blog/fast-fashion-smells-bad-faster` | 0.6 | `https://smelloff.in/blog/fast-fashion-smells-bad-faster` | Synthetic Microfibers in Fast Fashion & BO Binding |
| `/blog/gym-bag-smell-prevent-clothes` | `https://smelloff.in/blog/gym-bag-smell-prevent-clothes` | 0.6 | `https://smelloff.in/blog/gym-bag-smell-prevent-clothes` | Preventing Cross-Contamination in Gym Bags |
| `/blog/gym-clothes-smell-after-washing` | `https://smelloff.in/blog/gym-clothes-smell-after-washing` | 0.7 | `https://smelloff.in/blog/gym-clothes-smell-after-washing` | Why Washed Gym Wear Smells Bad When Reworn |
| `/blog/helmet-strap-jacket-collar-sweat-smell` | `https://smelloff.in/blog/helmet-strap-jacket-collar-sweat-smell` | 0.6 | `https://smelloff.in/blog/helmet-strap-jacket-collar-sweat-smell` | Helmet Straps & Biker Jacket Collar Odor |
| `/blog/how-to-fix-smelly-jeans-without-washing` | `https://smelloff.in/blog/how-to-fix-smelly-jeans-without-washing` | 0.6 | `https://smelloff.in/blog/how-to-fix-smelly-jeans-without-washing` | Raw Denim & Jeans Care Without Water Wash |
| `/blog/how-to-freshen-blazer-without-dry-cleaning` | `https://smelloff.in/blog/how-to-freshen-blazer-without-dry-cleaning` | 0.6 | `https://smelloff.in/blog/how-to-freshen-blazer-without-dry-cleaning` | Freshening Suits & Formal Wear Overnight |
| `/blog/how-to-get-rid-of-body-odor-on-polyester` | `https://smelloff.in/blog/how-to-get-rid-of-body-odor-on-polyester` | 0.6 | `https://smelloff.in/blog/how-to-get-rid-of-body-odor-on-polyester` | Hydrophobic Polyester & Oleophilic Odor Traps |
| `/blog/how-to-get-rid-of-sweat-smell-from-clothes-india` | `https://smelloff.in/blog/how-to-get-rid-of-sweat-smell-from-clothes-india` | 0.7 | `https://smelloff.in/blog/how-to-get-rid-of-sweat-smell-from-clothes-india` | Comprehensive Guide to Clothing Odors in India |
| `/blog/how-to-remove-curry-cooking-smell-from-clothes` | `https://smelloff.in/blog/how-to-remove-curry-cooking-smell-from-clothes` | 0.6 | `https://smelloff.in/blog/how-to-remove-curry-cooking-smell-from-clothes` | Kitchen Cooking & Tadka Odor Removal |
| `/blog/how-to-remove-mildew-smell-from-clothes` | `https://smelloff.in/blog/how-to-remove-mildew-smell-from-clothes` | 0.6 | `https://smelloff.in/blog/how-to-remove-mildew-smell-from-clothes` | Mildew & Mold Spore Odor in Wet Fabrics |
| `/blog/how-to-remove-musty-smell-from-clothes` | `https://smelloff.in/blog/how-to-remove-musty-smell-from-clothes` | 0.7 | `https://smelloff.in/blog/how-to-remove-musty-smell-from-clothes` | Musty Clothes Diagnosis & Permanent Elimination |
| `/blog/how-to-remove-smoke-smell-from-clothes` | `https://smelloff.in/blog/how-to-remove-smoke-smell-from-clothes` | 0.6 | `https://smelloff.in/blog/how-to-remove-smoke-smell-from-clothes` | Bonfire, Tobacco & Pollution Smoke Removal |
| `/blog/how-to-remove-sweat-smell-from-clothes-without-washing` | `https://smelloff.in/blog/how-to-remove-sweat-smell-from-clothes-without-washing` | 0.7 | `https://smelloff.in/blog/how-to-remove-sweat-smell-from-clothes-without-washing` | Instant Dry Fabric Refreshing Techniques |
| `/blog/how-to-stop-armpit-odor-on-shirts` | `https://smelloff.in/blog/how-to-stop-armpit-odor-on-shirts` | 0.6 | `https://smelloff.in/blog/how-to-stop-armpit-odor-on-shirts` | Armpit Seam Odor Treatment |
| `/blog/how-to-use-fabric-spray-properly` | `https://smelloff.in/blog/how-to-use-fabric-spray-properly` | 0.6 | `https://smelloff.in/blog/how-to-use-fabric-spray-properly` | Spray Distance, Misting Technique & Contact Time |
| `/blog/inside-drying-makes-clothes-stink` | `https://smelloff.in/blog/inside-drying-makes-clothes-stink` | 0.6 | `https://smelloff.in/blog/inside-drying-makes-clothes-stink` | Indoor Clothes Drying Odor & Bacterial Growth |
| `/blog/ironing-makes-sweat-smell-worse` | `https://smelloff.in/blog/ironing-makes-sweat-smell-worse` | 0.6 | `https://smelloff.in/blog/ironing-makes-sweat-smell-worse` | Heat Pressing Baking Odor Compounds into Fibers |
| `/blog/is-fabric-spray-safe-for-skin` | `https://smelloff.in/blog/is-fabric-spray-safe-for-skin` | 0.6 | `https://smelloff.in/blog/is-fabric-spray-safe-for-skin` | Dermatological Safety & Hypoallergenic Profile |
| `/blog/metro-commute-sweat-smell-hacks` | `https://smelloff.in/blog/metro-commute-sweat-smell-hacks` | 0.6 | `https://smelloff.in/blog/metro-commute-sweat-smell-hacks` | Peak Hour Metro Commute Odor Hacks |
| `/blog/monsoon-laundry-mistakes-india` | `https://smelloff.in/blog/monsoon-laundry-mistakes-india` | 0.6 | `https://smelloff.in/blog/monsoon-laundry-mistakes-india` | Common Rainy Season Laundry Mistakes |
| `/blog/mothballs-smell-removal-clothes` | `https://smelloff.in/blog/mothballs-smell-removal-clothes` | 0.6 | `https://smelloff.in/blog/mothballs-smell-removal-clothes` | Naphthalene & Mothball Odor Removal |
| `/blog/odorstrike-vs-febreze` | `https://smelloff.in/blog/odorstrike-vs-febreze` | 0.6 | `https://smelloff.in/blog/odorstrike-vs-febreze` | ODORSTRIKE vs International Brand Comparison |
| `/blog/odorstrike-vs-perfume-deodorant` | `https://smelloff.in/blog/odorstrike-vs-perfume-deodorant` | 0.6 | `https://smelloff.in/blog/odorstrike-vs-perfume-deodorant` | Deodorant / Cologne Comparison vs Molecular Spray |
| `/blog/office-sweat-smell-afternoon` | `https://smelloff.in/blog/office-sweat-smell-afternoon` | 0.6 | `https://smelloff.in/blog/office-sweat-smell-afternoon` | 3 PM Workday Slump & Fabric Odor Fixes |
| `/blog/old-sweat-stains-and-smell` | `https://smelloff.in/blog/old-sweat-stains-and-smell` | 0.6 | `https://smelloff.in/blog/old-sweat-stains-and-smell` | Deodorant Wax Buildup & Embedded BO |
| `/blog/polyester-vs-cotton-sweat-smell` | `https://smelloff.in/blog/polyester-vs-cotton-sweat-smell` | 0.6 | `https://smelloff.in/blog/polyester-vs-cotton-sweat-smell` | Textile Science: Oleophilic Polyester vs Cotton |
| `/blog/rain-soaked-clothes-smell-fix` | `https://smelloff.in/blog/rain-soaked-clothes-smell-fix` | 0.6 | `https://smelloff.in/blog/rain-soaked-clothes-smell-fix` | Emergency Fixes for Rain-Drenched Clothes |
| `/blog/rewear-clothes-without-washing-guide` | `https://smelloff.in/blog/rewear-clothes-without-washing-guide` | 0.6 | `https://smelloff.in/blog/rewear-clothes-without-washing-guide` | Sustainable Garment Rewearing Guide |
| `/blog/scented-detergent-doesnt-fix-odor` | `https://smelloff.in/blog/scented-detergent-doesnt-fix-odor` | 0.6 | `https://smelloff.in/blog/scented-detergent-doesnt-fix-odor` | Why Fragranced Detergents Fail Against Biofilm |
| `/blog/street-food-smell-on-clothes` | `https://smelloff.in/blog/street-food-smell-on-clothes` | 0.6 | `https://smelloff.in/blog/street-food-smell-on-clothes` | Fried Street Food & Grease Odor on Clothing |
| `/blog/sweat-smell-in-car-seats-clothes` | `https://smelloff.in/blog/sweat-smell-in-car-seats-clothes` | 0.6 | `https://smelloff.in/blog/sweat-smell-in-car-seats-clothes` | Car Seat Upholstery & Commute Odor Transfer |
| `/blog/travel-laundry-hacks-light-packing` | `https://smelloff.in/blog/travel-laundry-hacks-light-packing` | 0.6 | `https://smelloff.in/blog/travel-laundry-hacks-light-packing` | 50ml Pocket Spray for One-Bag Travel |
| `/blog/vinegar-for-clothes-smell-pros-cons` | `https://smelloff.in/blog/vinegar-for-clothes-smell-pros-cons` | 0.6 | `https://smelloff.in/blog/vinegar-for-clothes-smell-pros-cons` | DIY Vinegar Rinse Acid Breakdown vs Zinc Chelation |
| `/blog/what-causes-musty-clothes-smell` | `https://smelloff.in/blog/what-causes-musty-clothes-smell` | 0.6 | `https://smelloff.in/blog/what-causes-musty-clothes-smell` | Microbiology of Moraxella & Damp Fungi |
| `/blog/why-i-built-odorstrike` | `https://smelloff.in/blog/why-i-built-odorstrike` | 0.7 | `https://smelloff.in/blog/why-i-built-odorstrike` | Founder Story: The Science of Odor Elimination |
| `/blog/why-sweat-smells-stronger-on-some-shirts` | `https://smelloff.in/blog/why-sweat-smells-stronger-on-some-shirts` | 0.6 | `https://smelloff.in/blog/why-sweat-smells-stronger-on-some-shirts` | Fabric Microstructure & Bacterial Trapping |
| `/blog/why-traffic-fumes-cling-to-clothes` | `https://smelloff.in/blog/why-traffic-fumes-cling-to-clothes` | 0.6 | `https://smelloff.in/blog/why-traffic-fumes-cling-to-clothes` | Exhaust Fumes & Hydrocarbon Absorption |
| `/blog/why-washing-machine-makes-clothes-smell` | `https://smelloff.in/blog/why-washing-machine-makes-clothes-smell` | 0.6 | `https://smelloff.in/blog/why-washing-machine-makes-clothes-smell` | Washing Machine Tub Biofilm Contamination |
| `/blog/why-water-makes-clothing-odor-louder` | `https://smelloff.in/blog/why-water-makes-clothing-odor-louder` | 0.6 | `https://smelloff.in/blog/why-water-makes-clothing-odor-louder` | Humidity & Volatilization of Odor Molecules |
| `/blog/zinc-pca-fabric-odor-ingredient-guide` | `https://smelloff.in/blog/zinc-pca-fabric-odor-ingredient-guide` | 0.6 | `https://smelloff.in/blog/zinc-pca-fabric-odor-ingredient-guide` | Complete Guide to Zinc PCA Molecule & Efficacy |

### 2.4 Trust, Reviews & Order Tracking Pages (5 URLs)
| URL Path | Canonical URL | Sitemap Priority | Hreflang (`en-IN` & `x-default`) | Primary Search Intent |
| :--- | :--- | :--- | :--- | :--- |
| `/about` | `https://smelloff.in/about` | 0.5 | `https://smelloff.in/about` | Brand Heritage, Formulation Philosophy & Team |
| `/contact` | `https://smelloff.in/contact` | 0.5 | `https://smelloff.in/contact` | Customer Support & Business Contacts |
| `/faq` | `https://smelloff.in/faq` | 0.6 | `https://smelloff.in/faq` | Product Usage, Safety & Shipping FAQ |
| `/reviews` | `https://smelloff.in/reviews` | 0.7 | `https://smelloff.in/reviews` | Verified Customer Feedback & Order Reviews |
| `/track-order` | `https://smelloff.in/track-order` | 0.5 | `https://smelloff.in/track-order` | Shiprocket Live AWB Package Tracking |

### 2.5 Legal & Compliance Policies (6 URLs)
| URL Path | Canonical URL | Sitemap Priority | Hreflang (`en-IN` & `x-default`) | Primary Search Intent |
| :--- | :--- | :--- | :--- | :--- |
| `/privacy` | `https://smelloff.in/privacy` | 0.3 | `https://smelloff.in/privacy` | Privacy Policy & Data Protection Terms |
| `/terms` | `https://smelloff.in/terms` | 0.3 | `https://smelloff.in/terms` | Terms of Service & Commercial Usage |
| `/shipping` | `https://smelloff.in/shipping` | 0.3 | `https://smelloff.in/shipping` | Delivery Timelines & Pan-India Shipping Terms |
| `/refund` | `https://smelloff.in/refund` | 0.3 | `https://smelloff.in/refund` | Money-Back Guarantee & Refund Policy |
| `/returns` | `https://smelloff.in/returns` | 0.3 | `https://smelloff.in/returns` | Return Eligibility & Processing Rules |
| `/cancellation` | `https://smelloff.in/cancellation` | 0.3 | `https://smelloff.in/cancellation` | Order Cancellation Policy |

---

## 3. Non-Indexable & Utility Pages (Excluded From Sitemap)
| File Path | Robots Directive | Header / Response | Purpose |
| :--- | :--- | :--- | :--- |
| `404.html` | Status 404 / `noindex` | `X-Robots-Tag: noindex` | Catch-all Error Handling |
| `payment-failed.html` | `<meta name="robots" content="noindex, nofollow">` | Status 200 (Transaction Fallback) | Payment Gateway Drop-off Guidance |
| `google395b0ff72bc7b0a8.html` | Excluded from sitemap | Status 200 | Google Search Console Ownership Verification |
| `emails/*.html` | Excluded from web routing | Not public web pages | Transactional email layouts |
| `admin/*` | Excluded from sitemap | Internal tooling | Admin dashboards & diagnostics |
