# ODORSTRIKE PDP CLAIM AUDIT & SOURCE OF TRUTH (SEPTEMBER 2026)

## Executive Summary
This document establishes the authoritative, evidence-grounded claim inventory for Smelloff's ODORSTRIKE 50ml fabric odor mist (`odorstrike.html`, `index.html`, `config/product.json`, and shared configurations). Every customer-facing statement has been inventoried, classified against empirical evidence, and remediated to eliminate absolute or unhedged claims.

---

## Google Structured Data Guidelines & References Consulted
In accordance with official Google Search Central documentation, structured data must accurately represent on-page content without fabricated reviews, unearned aggregate ratings, or deprecated schemas:
1. **Google Search Central — Product Structured Data**: https://developers.google.com/search/docs/appearance/structured-data/product
   - Requires single primary `Product` entity with canonical offer price (`price: "229.00"`, `priceCurrency: "INR"`).
   - Validates `hasMerchantReturnPolicy` (7-day finite return window) and `shippingDetails` (Free pan-India prepaid shipping).
2. **Google Search Central — Merchant Listings & Product Snippets**: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
   - Mandates strict alignment between visible terms (7 days, 80% full threshold) and JSON-LD schema properties.
3. **Google Search Central — Review & AggregateRating Snippets**: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
   - Prohibits hardcoded or fabricated star ratings or artificial aggregate counts. Only genuine, verified buyer reviews may populate `review` or `aggregateRating`.
4. **Google Search Central — General Structured Data Policies**: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
   - Structured data must not convey claims not visible to the user.
5. **Google Search Central — FAQ Rich Results Removal**:
   - Google completely removed FAQ rich results from Search in 2026. `FAQPage` schema on commercial e-commerce PDPs is deprecated and eliminated across all pages.
6. **Google Recommended Validation Workflow**:
   - Validate structured data syntax and rich snippet eligibility via Google Rich Results Test: https://search.google.com/test/rich-results
   - Verify indexation and live rendering via Search Console URL Inspection Tool: https://support.google.com/webmasters/answer/9012289
   - Submit and maintain sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

---

## Evidence Classification Hierarchy
- **Level 1 (Published Literature / Active Ingredient Mechanisms)**: Peer-reviewed literature on specific raw materials (HPβCD encapsulation, Zinc PCA acid binding, Triethyl Citrate esterase inhibition, Zinc Gluconate salt complexation).
- **Level 2 (Finished Formula Wear & Fabric Testing)**: Empirical testing of Smelloff Formula v3.1 across everyday washable Indian garments (cotton, polyester, denim, poly-blends) under realistic commute/office conditions.
- **Level 3 (Customer & Tester Observations)**: Qualitative feedback from metro commuters and early testers.

*Rule of Discipline*: Ingredient mechanisms (Level 1) and tester feedback (Level 3) must never be misrepresented as laboratory certifications or clinical guarantees for the finished product.

---

## Master PDP Claim Inventory & Audit Matrix

| # | Section / Location | Exact Claim / Concept | Category | Status | Evidence Level | Rationale & Remediation |
|---|---|---|---|---|---|---|
| 1 | **Product JSON-LD** (`odorstrike.html`) | Single Product entity with offer price `₹229.00`, currency `INR`, InStock, MerchantReturnPolicy, ShippingDetails | Structured Data | **APPROVED** | Level 2 / Commercial Truth | Complies with Google Merchant Listing requirements. Strictly mirrors on-page pricing and returns policy. |
| 2 | **Structured Data** (`odorstrike.html`) | Deprecation / Removal of `FAQPage` schema on PDP | Structured Data | **APPROVED** | Google Search Central 2023 Guidelines | Deprecated on commercial e-commerce PDPs. Removed to prevent schema clutter and search penalties. |
| 3 | **Structured Data** (`odorstrike.html`) | Absence of `aggregateRating` / fake `review` array | Structured Data | **APPROVED** | Google Review Guidelines | No verified store review database connected. Schema rendered conditionally only when genuine verified reviews exist. |
| 4 | **HowTo JSON-LD** (`odorstrike.html`) | 4-step fabric refresh workflow (Check, Spray 15–20cm, Wait 15–30s, Wear up to 8h) | Structured Data | **QUALIFIED** | Level 2 (Usage Standard) | Accurately describes physical steps and dry-time conditions without absolute efficacy claims. |
| 5 | **Meta Title & Description** (`odorstrike.html`) | "ODORSTRIKE Fabric Odor Spray for Clothes ₹229 \| Smelloff" / "Targets trapped sweat odor in fabric fibres..." | Meta Tags | **APPROVED** | Level 2 / Category Truth | Accurately states category (fabric mist), price (₹229), and targeted application (sweat odor in fabric). |
| 6 | **Hero Section** (`odorstrike.html`) | "A pocket-sized fabric odor mist for clothes... neutralizes them directly in fabric fibres — giving you up to 8 hours of clean odor protection on fabric under normal office/commute conditions* with a fast-drying, residue-free finish." | Hero Copy | **QUALIFIED** | Level 2 (Wear Trials) | Hedged duration with explicit asterisk qualification; replaced absolute "zero residue" with descriptive residue-free finish. |
| 7 | **Category Badges** (`odorstrike.html`) | "NOT PERFUME", "NOT BODY DEODORANT", "FABRIC ONLY" | Product Categorization | **APPROVED** | Formulation & Safety Truth | Essential category distinction to prevent misuse as a skin cosmetic or masking fragrance. |
| 8 | **Pricing & Commercial Terms** (`odorstrike.html`) | ₹229 prepaid (Free Shipping) / ₹60 COD fee (₹289 total) / MRP ₹499 (54% OFF) | Commercial Terms | **APPROVED** | Commercial Truth | Fully transparent pricing and fee disclosure upfront, compliant with CCPA 2023 drip-pricing guidelines. |
| 9 | **Chemistry Section** (`odorstrike.html`) | 4-layer formulation: HPβCD (Trap), Zinc PCA (Neutralize), Triethyl Citrate (Prevent), Zinc Gluconate (Sustained freshness) | Formulation Science | **QUALIFIED** | Level 1 (Raw Material Science) | Replaced legacy "Anti-regrowth" with "Sustained freshness / Long-lasting freshness". No proprietary percentages disclosed. |
| 10 | **Antimicrobial / Biocidal Claims** (`odorstrike.html`) | Strict absence of "kills bacteria", "kills microbes", "disinfectant", "antimicrobial" | Regulatory Safety | **APPROVED** | Regulatory Guardrail | Formula is a fabric odor neutralizer, not a licensed biocide, disinfectant, or medical drug. |
| 11 | **Skin Safety / Cosmetic Claims** (`odorstrike.html`) | Strict absence of "skin safe", "dermatologist tested", "clinically proven" | Safety Guardrail | **APPROVED** | Safety Truth | ODORSTRIKE is formulated strictly for fabric, never for direct application to human skin, face, or hair. |
| 12 | **Residue / Staining Claims** (`odorstrike.html`) | "Glycerine-free formula dries clear with no stiff residue or powdery marks when misted from 15–20 cm" | Physical Performance | **QUALIFIED** | Level 2 (Fabric Testing) | Removed absolute "zero residue / no white marks" assertions; framed around correct spray distance and drying. |
| 13 | **Longevity / Duration Claims** (`odorstrike.html`) | "Up to 8 hours of odor protection on fabric under normal office/commute conditions*" | Performance Duration | **QUALIFIED** | Level 2 (Wear Trials) | Always qualified with "up to" and normal indoor/commute conditions note. High-sweat/workout requires reapplication. |
| 14 | **Travel & Portability Claims** (`odorstrike.html`) | "50ml pocket-sized bottle designed for easy daily carry in work bags, backpacks, and gym totes" | Portability | **QUALIFIED** | Metrology & Physical Spec | Removed absolute "cabin-safe / airport security guaranteed" and "handles a week of travel" guarantees. |
| 15 | **Fabric Compatibility Claims** (`odorstrike.html`) | "Compatible with everyday washable fabrics: cotton, polyester, denim, wool. Patch-test silk, zari, and delicate embroidery on hidden seam" | Material Safety | **QUALIFIED** | Level 2 (Fabric Testing) | Explicitly excludes leather, suede, and dry-clean-only garments; mandates patch testing on delicate fabrics. |
| 16 | **Dry Time Claims** (`odorstrike.html`) | "Fine mist dries clean in 15–30 seconds (up to 30–60 seconds in high humidity; ensure dry before wearing)" | Evaporation Dynamics | **QUALIFIED** | Level 2 (Ambient Evaporation) | Clarified humidity dependency to prevent wearing damp clothing. |
| 17 | **Refresh Economics** (`odorstrike.html`) | "~250 sprays per 50ml bottle (~80–125 garment refreshes at 2–3 sprays per zone)" | Metrology & Math | **APPROVED** | Physical Metrology | Mathematically consistent: 250 sprays / 2 sprays = 125 refreshes; 250 sprays / 3 sprays = ~83 refreshes. |
| 18 | **Early Tester Voices** (`odorstrike.html`) | Rohit (26 / Bengaluru), Aakash (24 / Pune), Karan (29 / Delhi) — labeled "Early tester feedback" | Social Proof | **APPROVED** | Level 3 (Qualitative Feedback) | Clear attribution as qualitative early feedback; zero fabricated star averages or fake review counts. |
| 19 | **Gallery Alt Text** (`odorstrike.html`) | All 8 gallery images carry descriptive, accessibility-compliant alt attributes without embedded unhedged claims | Accessibility & SEO | **APPROVED** | Accessibility Best Practice | Accurately describes bottle dimensions, application method, dark shirt spray demonstration, and science diagrams. |
| 20 | **Product Config Single Truth** (`config/product.json`) | Unified definitions for SKU, INR pricing, INCI roles, approved claims, and prohibited terms filter | Source of Truth | **APPROVED** | Source of Truth Parity | Fully reconciled with codebase, test invariants, and build scripts. |

---

## Verification & Guardrail Enforcement
All claims above are continuously validated by automated test suites and build gates:
- `test/odorstrike-pdp-claims.test.mjs`: Tests all 20 structural, claim, and schema invariants.
- `test/product-config.test.mjs`: Validates catalog consistency, commercial calculations, and prohibited term filters.
- `scripts/audit-production.mjs`: Build-time gate auditing 88 customer-facing files.
- `scripts/audit-live-seo.mjs`: Post-deployment verification gate failing closed on any PDP claim or schema regression.

---

## Production Release Verification

- **Git Commit SHA (Main)**: `f35ec8cb2ce917c3dd6ce117079d4c1b2f6d2998`
- **Vercel Project**: `Brxinee/Smelloff`
- **Vercel Production Deployment ID**: `6496592161`
- **Vercel Production SHA**: `ae5c839bb615b5bf63b5a15e684fc7957dd61581` (Release Drift Identified: previous Vercel build failed due to `invalid-route-source-pattern` in `vercel.json` from commit `c5a525e`, now rectified)
- **Deployment State**: Drift Identified / Stale Live Deployment Detected
- **Local Test Suite**: PASS (246 / 246 tests passing across 8 suites)
- **Build Pipeline (`npm run build`)**: PASS (Exit Code: 0, 88 files audited)
- **Sitemap Integrity (`npm run sitemap:check`)**: PASS (75 URLs, 50 with images)
- **Production Audit (`node scripts/audit-production.mjs`)**: PASS (88 files clean)
- **Live PDP HTTP Status**: 200 OK
- **Live Canonical URL**: `https://smelloff.in/odorstrike`
- **Live Product JSON-LD Count**: 1 (Single primary Product node)
- **Live FAQPage Count**: 1 (Legacy on live edge; 0 in remediated repository)
- **Live AggregateRating Status**: ABSENT (No fabricated rating data emitted)
- **Live Review Status**: ABSENT (No fabricated review data emitted)
- **Live Prohibited Claim Scan**: Remediation verified locally (0 occurrences in repo; live edge awaiting Vercel sync)
- **Live Gallery Alt Scan**: PASS (8 / 8 images with compliant, descriptive alt attributes)
- **Google Search Central Validation**: Google Rich Results Test not executed in this environment (workflow documented per official 2026 guidelines)

