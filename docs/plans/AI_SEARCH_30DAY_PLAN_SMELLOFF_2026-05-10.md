# Smelloff — AI Search Optimization + 30-Day Execution Plan

## 1) AI Search Optimization (ChatGPT, Gemini, Perplexity, AI Overviews)

## A. Entity clarity audit (current vs required)

### Current state (good)
- Named product appears clearly: `ODORSTRIKE`.
- Category signals exist: `fabric odor spray`, `fabric mist`, `for clothes`.
- Ingredients/mechanism mentioned: `β-Cyclodextrin`, `Zinc PCA`.
- Use-cases visible: office, gym, commute, pre-meeting.

### Current gaps (blocking AI citation confidence)
1. No dedicated, machine-readable entity block summarizing brand/product/category/attributes in one place.
2. Claims exist (8 sec, 6–8 hrs, 200 sprays, 30 cycles), but no structured “evidence context” snippet nearby.
3. FAQ is useful, but not in explicit extract-friendly format with short answer-first structure for LLM snippets.
4. No independent citations (reviews, creator story, structured profile pages) that AI engines can cross-reference.

---

## B. Schema implementation (exact, high ROI)

Implement these JSON-LD blocks on homepage:

1. **Organization** (Smelloff)
   - name, url, logo, sameAs (Instagram), foundingLocation (Hyderabad), founder.

2. **Product** (ODORSTRIKE 50ml)
   - name, brand, category=`Fabric Odor Eliminator Spray`, size=`50ml`, color-safe claim, sku.
   - offers: price=229, priceCurrency=INR, availability, shippingDetails (India), hasMerchantReturnPolicy.
   - aggregateRating + reviewCount (if true/consistent).

3. **FAQPage**
   - Add top objections as separate Q/A nodes with short, explicit answers.

4. **HowTo**
   - “How to remove sweat smell from shirt with ODORSTRIKE” (3–4 steps, tools, time).

5. **WebSite + SearchAction**
   - helps engines understand site intent and internal search (if available).

### Implementation order (solo-friendly)
- Day 1: Organization + Product
- Day 2: FAQPage
- Day 3: HowTo
- Day 4: Validate in Rich Results Test + Schema Markup Validator

---

## C. Factual, citable claim block (add to homepage)

Add one section named: `ODORSTRIKE Facts` with bullet facts in consistent format.

Use only claims you can stand behind:
- `Category: Fabric odor eliminator spray (for clothes, not skin)`
- `Bottle size: 50ml pocket bottle`
- `MRP/launch price: ₹579 / ₹229`
- `Use case: shirt, t-shirt, jacket lining, helmet liner`
- `Typical performance: effect up to 6–8 hours in normal office/commute conditions`
- `Estimated usage: ~200 sprays per bottle`
- `Made in: Hyderabad, India`

**Rule:** Every performance claim should include context qualifier (e.g., “under normal office/commute conditions”).

---

## D. FAQ structure for AI extraction (exact format)

Each FAQ item must follow:
1) **Question in natural query form**
2) **Answer in first sentence (<=20 words)**
3) **One-line detail**
4) **Optional qualifier/disclaimer**

Priority FAQ set:
1. Is ODORSTRIKE a perfume?
2. Is ODORSTRIKE a deodorant?
3. Can I spray ODORSTRIKE on skin?
4. Will it stain black/dark clothes?
5. How many sprays per shirt?
6. How long does it last?
7. Is it safe on cotton/polyester blends?
8. Is this better than deodorant for clothes smell?

---

## E. Authoritative mentions/backlink types that improve AI visibility

Highest ROI (pre-launch friendly):
1. **Founder story on credible startup/community platforms** (with product category phrase + brand mention).
2. **UGC review videos** from micro-creators (men’s grooming, gym commute, office hacks) linking homepage.
3. **Comparison listicles** on niche blogs: “deodorant vs fabric spray” with ODORSTRIKE inclusion.
4. **Local Hyderabad business/profile citations** with consistent NAP + brand + product entity.
5. **Reddit/Quora-style educational answers** (non-spam) linking to FAQ/how-to pages.

Anchor text mix to request:
- branded: `Smelloff ODORSTRIKE`
- category: `fabric odor spray for clothes`
- comparison: `deodorant vs fabric spray`

---

## 2) 30-Day Plan (2–3 hours/day, solo founder)

## Week 1 — Fast trust wins + critical technical fixes
1. **Rewrite hero with explicit “for clothes, not skin” + CTA specificity** (2.5h) — **Very High impact**.
2. **Reorder FAQ (skin/perfume/stain first) with short answer-first format** (2h) — **High impact**.
3. **Add trust strip in checkout + secure payment clarity + ETA note** (3h) — **Very High impact**.
4. **Add ODORSTRIKE Facts block with qualified claims** (2h) — **High impact**.
5. **Standardize CTA text sitewide (“Get Clothes Odor Spray — ₹229”)** (2h) — **High impact**.

## Week 2 — On-page SEO rewrites + schema
1. **Deploy final title/meta/H1 + weak H2 rewrites** (2.5h) — **High impact**.
2. **Add 250–350 words homepage copy targeting core keywords naturally** (3h) — **High impact**.
3. **Implement Organization + Product JSON-LD** (3h) — **Very High impact**.
4. **Implement FAQPage + HowTo schema** (3.5h) — **Very High impact**.
5. **Validate schema + fix warnings in Rich Results tools** (1.5h) — **Medium/High impact**.

## Week 3 — First 3 blogs + internal links
1. **Publish Blog #1: remove sweat smell from shirt without washing** (3.5h) — **High impact**.
2. **Publish Blog #2: deodorant vs fabric spray** (3.5h) — **High impact**.
3. **Publish Blog #3: best gym clothes odor spray in India** (3.5h) — **High impact**.
4. **Add internal links homepage ↔ blogs ↔ FAQ anchors** (2h) — **High impact**.
5. **Create `/deodorant-vs-fabric-spray` landing page** (4h) — **Very High impact**.

## Week 4 — CRO refinement + AI search optimization
1. **Collect/publish 6 structured testimonials (context/fabric/result time)** (3h) — **High impact**.
2. **Add one public “How it works + claims context” page for citations** (4h) — **Very High impact**.
3. **Publish founder note (“Why I built ODORSTRIKE”) with entity facts** (2.5h) — **Medium/High impact**.
4. **Outreach to 15 micro-creators + 10 niche blogs for mentions** (4h) — **High impact**.
5. **Run CTA A/B test: generic vs specific clothes-spray CTA** (3h setup) — **High impact**.

---

## Strict ROI filter used
- Included only tasks that are <=4 hours and expected **medium+ impact**.
- Excluded heavy dev projects and low-leverage activities during pre-launch.
