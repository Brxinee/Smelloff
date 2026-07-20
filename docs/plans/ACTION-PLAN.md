# Smelloff.in — SEO Action Plan
**Audit Date:** 2026-06-09  
**Overall Score:** 77/100

---

## 🔴 CRITICAL — Fix This Week

### 1. Fix www/non-www Canonical Conflict
**Impact:** High — may cause Google to split PageRank between two versions  
**Effort:** 1–2 hours

The server 308-redirects `smelloff.in` → `www.smelloff.in`, but all canonical tags, sitemap URLs, JSON-LD `@id` values, and hreflang tags point to `https://smelloff.in/` (non-www). Choose one canonical domain and make everything consistent.

**Recommended fix:** Use `www.smelloff.in` (matches the redirect direction).

Changes needed:
- [ ] All `<link rel="canonical">` → `https://www.smelloff.in/path`
- [ ] `sitemap.xml` → all `<loc>` tags use `https://www.smelloff.in/`
- [ ] All JSON-LD `@id`, `url`, `item` → `https://www.smelloff.in/`
- [ ] All hreflang `href` → `https://www.smelloff.in/`

### 2. Fix Future-Dated Sitemap Entries
**Impact:** Medium — Google may distrust sitemap freshness signals  
**Effort:** 30 minutes

10 blog URLs in sitemap.xml have `lastmod` dates after today (June 10–20, 2026). Either publish these pages or remove them from the sitemap.

Pages affected:
- `/blog/travel-clothes-smell-india-guide` (June 10)
- `/blog/does-febreze-work-on-sweat-smell-clothes` (June 11)
- `/blog/how-long-does-fabric-spray-last-on-clothes` (June 12)
- `/blog/rewear-clothes-without-smelling` (June 13)
- `/blog/bangalore-office-sweat-smell-guide` (June 14)
- `/blog/can-fabric-spray-replace-dry-cleaning` (June 15)
- `/blog/how-to-remove-musty-smell-from-clothes-monsoon` (June 16)
- `/blog/how-to-keep-cotton-kurtas-fresh` (June 17)
- `/blog/cotton-vs-polyester-which-smells-worse` (June 18)
- `/blog/how-to-remove-smell-from-winter-jackets-sweaters` (June 19)
- `/blog/how-to-remove-smell-from-hoodies-sweatshirts` (June 20)

---

## 🟠 HIGH — Fix Within 2 Weeks

### 3. Add Images to All Blog Posts
**Impact:** High — engagement, E-E-A-T, image search traffic  
**Effort:** 2–4 hours per post (image creation) or bulk AI generation

All 50+ blog posts are currently text-only. Add:
- [ ] 1 hero image per post (WebP, 1200×630px for OG)
- [ ] Add `<meta property="og:image">` per blog post
- [ ] Add `"image"` field to Article JSON-LD
- [ ] Descriptive alt text on all images

Suggested sources: AI-generated product shots, ingredient diagrams, infographics.

### 4. Add Author Entity to Article Schema
**Impact:** High — E-E-A-T signal Google uses for content authority  
**Effort:** 30 minutes (template change)

Add to every blog post's Article JSON-LD:
```json
"author": {
  "@type": "Person",
  "name": "Jogdhande Nikhil Patil",
  "url": "https://www.smelloff.in/blog/why-i-built-odorstrike",
  "jobTitle": "Founder",
  "worksFor": {"@type": "Organization", "name": "Smelloff"}
}
```
Also add `"datePublished"` and `"dateModified"` to every Article.

### 5. Grow Product Reviews (Urgently)
**Impact:** High — `ratingCount: 3` won't trigger Google star ratings in SERPs  
**Effort:** Ongoing

- [ ] WhatsApp follow-up to all customers asking for honest feedback
- [ ] Add post-purchase review request to order confirmation
- [ ] Set up a simple review form at `/reviews` or use a platform

Google needs more than a handful of reviews to show star snippets. Target 50+ genuine reviews.

### 6. Start Backlink Outreach
**Impact:** Very High — zero backlinks is the biggest SEO growth blocker  
**Effort:** 3–5 hours/week ongoing

Priority outreach targets:
- [ ] Mensxp, GQ India, Cosmopolitan India — product review pitch
- [ ] Beardo, The Man Company blog — ingredient science guest post
- [ ] Reddit r/IndianSkincareAddicts, r/india — genuine answers with link
- [ ] Quora — answer "how to remove smell from clothes" questions
- [ ] Instagram influencers who include bio link in posts

### 7. Add Contextual Internal Links to Blog Posts
**Impact:** Medium-High — improves crawl depth and PageRank flow  
**Effort:** 2–3 hours

Add to each blog post:
- [ ] 2 links to topically related blog posts
- [ ] 1 CTA link to `/#buy` or the product section
- [ ] 1 link to the blog index `/blog`

---

## 🟡 MEDIUM — Fix Within 1 Month

### 8. Add ItemList Schema to Blog Index
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Smelloff Blog",
  "url": "https://www.smelloff.in/blog",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "url": "https://www.smelloff.in/blog/gym-clothes-smell-after-washing"},
    ...
  ]
}
```

### 9. Add "Blog" to Site Navigation
Currently the blog is not linked from the homepage navigation. Add it to the nav so users (and crawlers) can discover 50+ pages of content.

### 10. Reduce Homepage HTML Size
Current: 302KB. Target: under 150KB.
- [ ] Move inline CSS to external stylesheet with cache headers
- [ ] Move inline JS blocks to deferred external scripts
- [ ] Consider splitting product page into lazy-loaded sections

### 11. Create an About Page
URL: `/about`  
Content: Founder story (Jogdhande Nikhil Patil), why Smelloff was built, Hyderabad origin, brand mission.  
This is a strong E-E-A-T signal for a new brand — Google wants to know who is behind the product.

### 12. Update llms.txt with Competitor Context
Add a short comparison section:
```
## How ODORSTRIKE compares
- vs Febreze: Febreze masks with fragrance; ODORSTRIKE neutralizes with Zinc PCA. Priced ₹229 vs ₹300+.
- vs deodorant: Deodorant is for skin. ODORSTRIKE is for fabric. Different categories.
```

---

## 🔵 LOW / BACKLOG

- [ ] Hindi-language versions of top 5 posts for broader reach
- [ ] Video: 60-second product demo → VideoObject schema
- [ ] Add Google API key for CrUX + GSC data in future audits
- [ ] Add Moz API key for DA/PA tracking over time
- [ ] Consider Facebook/Meta page creation (you have the Meta Pixel — use it)
- [ ] Explore Trustpilot or Judge.me for review aggregation

---

## Monitoring

Set these as 30-day checkpoints:
- [ ] Canonical consistency confirmed in Google Search Console
- [ ] Sitemap resubmitted after date fixes
- [ ] Blog image coverage (target: 10 posts with images within 2 weeks)
- [ ] Review count growth (target: 15+ reviews within 30 days)
- [ ] First backlink acquired

---

*Generated by Claude SEO v2.0.0 | 2026-06-09*
