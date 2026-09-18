# Google Search Console Action Plan & Indexing Health Protocol (September 2026)

**Target Domain:** `https://smelloff.in`  
**Sitemap:** `https://smelloff.in/sitemap.xml` (75 Canonical URLs)  
**Objective:** Maintain a 100% technically clean indexing architecture so Googlebot unambiguously indexes canonical URLs, respects single-hop 301 redirects, and eliminates false duplicate flags.

---

## 1. Immediate Actions (Deployment & Production Verification)

1. **Deploy Repository Main Branch to Vercel Production:**
   - Deploy the canonical tag fixes (`/solutions` canonical without trailing slash, matching `hreflang` tags across all 5 `/solutions/*` pages).
   - Deploy `vercel.json` 1-hop redirect optimizations (www trailing slash rules, `.html/?` regex).
   - Deploy updated `sitemap.xml` (single-escaped XML entities, capped `lastmod`).

2. **Verify Live Parity via Automated Audit Tool:**
   ```bash
   node scripts/audit-live-seo.mjs --live
   ```
   - Confirm:
     - `TOTAL URLS TESTED`: 98
     - `200 CANONICAL`: 75 / 75 (100%)
     - `CANONICAL MISMATCHES`: 0
     - `MULTI-HOP (2 HOPS)`: 0
     - `BROKEN CHAINS (3+ HOPS)`: 0
     - `REDIRECT LOOPS`: 0
     - `SITEMAP DEFECTS`: 0

3. **Verify Sitemap Endpoint in Production:**
   ```bash
   curl -I https://smelloff.in/sitemap.xml
   ```
   - Ensure `Content-Type: application/xml; charset=utf-8` or `text/xml; charset=utf-8`.
   - Ensure HTTP 200 OK and no redirects.

4. **Submit / Re-submit Sitemap in GSC:**
   - Navigate to **Google Search Console > Sitemaps**.
   - Submit `https://smelloff.in/sitemap.xml`.
   - Confirm status changes to **Success** with **75 discovered URLs**.

---

## 2. GSC URL Inspection & Validation Checklist

Perform URL Inspection on the following 5 representative anchor URLs across distinct templates:

### Priority Inspection Targets
1. **Homepage:** `https://smelloff.in/`
2. **Product Core:** `https://smelloff.in/odorstrike`
3. **Solutions Hub:** `https://smelloff.in/solutions`
4. **Top Article:** `https://smelloff.in/blog/gym-clothes-smell-after-washing`
5. **Customer Reviews:** `https://smelloff.in/reviews`

### Inspection Verification Criteria
- [ ] **Presence in Index:** "URL is on Google" or "URL is not on Google" (request indexing if fresh).
- [ ] **User-Declared Canonical:** Matches exact clean URL (e.g., `https://smelloff.in/odorstrike`).
- [ ] **Google-Selected Canonical:** Matches "User-declared canonical" (Inspect > Page indexing > Google-selected canonical: *Same as user-declared canonical*).
- [ ] **Mobile Usability:** Page is usable on mobile devices with zero viewport issues.
- [ ] **Rich Results / Structured Data:** Valid schema detected (Product, Review, Organization, FAQ, BreadcrumbList) with 0 errors.

---

## 3. GSC Issue Remediation & "Validate Fix" Protocol

In **Search Console > Indexing > Pages**, monitor the following issue buckets and trigger validation:

### 3.1 "Duplicate without user-selected canonical"
- **Cause:** Historical crawlers accessed trailing-slash or `.html` variants prior to standardized header tags.
- **Remedy Applied:** 100% of indexable pages now include self-referential canonical and hreflang tags; `vercel.json` executes 1-hop 301 redirects for all variants.
- **Action:** Click into the report and click **"Validate Fix"**.

### 3.2 "Page with redirect"
- **Expected State:** Normal for all legacy blog URLs, www variants, and trailing-slash paths.
- **Verification:** Ensure that all URLs in this report redirect directly to an active canonical page in 1 hop (status 301/308). None should redirect to 404 or form loops.

### 3.3 "Crawled - currently not indexed"
- **Expected Behavior:** Google crawls content but schedules indexing based on quality and crawl allocation.
- **Remedy Applied:** Distinct keyword clustering documented in `content-canonical-clusters-2026-09.md`. Deep cross-linking added between solutions and blog clusters.

---

## 4. Ongoing Maintenance & CI Guardrails

To prevent regression during future feature development and content publication:

1. **Pre-Commit / Pre-Deploy Guardrail:**
   ```bash
   npm run audit
   # or: node scripts/audit-production.mjs
   ```
   - Automatically fails if any page lacks a self-referential canonical tag.
   - Automatically fails if hreflang tags are missing or mismatched.
   - Automatically fails if sitemap URL count does not match filesystem indexable pages.
   - Automatically fails if double-escaped XML entities (`&amp;amp;`) or future `lastmod` dates are detected.
   - Automatically fails if any redirect chain is introduced in `vercel.json`.

2. **Automated Unit Tests:**
   ```bash
   npm test
   ```
   - Enforces 100% test pass across all 228 assertions in `test/seo-architecture.test.mjs` and related test suites.

3. **Monthly Health Sweep:**
   - Run `node scripts/audit-live-seo.mjs --live` on the 1st of every month to catch external link breaks or edge routing anomalies.
