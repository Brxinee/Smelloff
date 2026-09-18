# Smelloff Redirect & Routing Architecture Audit (September 2026)

**Audited File:** `/vercel.json`  
**Platform Configuration:** Vercel Edge Network (`cleanUrls: true`, `trailingSlash: false`)  
**Canonical Domain:** `https://smelloff.in` (Apex Domain)  
**Status:** 100% Validated — 0 Multi-hop Chains, 0 Loops, 100% 1-Hop Resolution for All Permutations.

---

## 1. Executive Summary

Every URL variant requested by users, Googlebot, external referral campaigns, or historical links is guaranteed to resolve directly to its canonical destination in **exactly 1 hop with HTTP 301 Permanent Redirect**.

| Category | Source Pattern | Target Canonical | Status Code | Max Hops |
| :--- | :--- | :--- | :--- | :--- |
| **Domain Normalization** | `www.smelloff.in/*` | `https://smelloff.in/*` | 301 | 1 hop |
| **Extension Stripping** | `*.html`, `*.html/` | Clean extensionless URL | 301 | 1 hop |
| **Trailing Slash Stripping** | `/*path*/` | Clean URL without slash | 301 / 308 | 1 hop |
| **Legacy URL Migration** | Historical blog & policy slugs | Modern canonical slug | 301 | 1 hop |
| **Referral Campaigns** | `/r/:code` | `/?ref=:code` | 307 / 308 | 1 hop |

---

## 2. Redirect Rule Categories in `vercel.json`

### 2.1 Domain Normalization (`www.smelloff.in` -> `https://smelloff.in`)
To prevent multi-hop chains where a user accesses a www URL with `.html` or trailing slashes, rules are strictly ordered from most specific to least specific:
1. **Specific legacy slugs on www:** (e.g. `www.smelloff.in/blog/clothes-smell-after-washing`) -> `https://smelloff.in/blog/gym-clothes-smell-after-washing` (301, 1 hop)
2. **HTML file extensions on www:** `/(.*)\.html/?` -> `https://smelloff.in/$1` (301, 1 hop)
3. **Trailing slashes on www:** `/:path+/` -> `https://smelloff.in/:path+` (301, 1 hop)
4. **General root & path catch-all on www:** `/(.*)` -> `https://smelloff.in/$1` (301, 1 hop)

### 2.2 Extension Normalization (`.html` -> Clean URLs)
Vercel `cleanUrls: true` automatically serves `.html` files extensionlessly. Explicit 301 redirect rules capture all incoming requests with `.html` and `.html/` to ensure search engines consolidate link equity onto clean URLs:
- `/(.*)\.html/?` -> `/$1` (301)

### 2.3 Trailing Slash Normalization (`/path/` -> `/path`)
Vercel `trailingSlash: false` natively enforces non-trailing-slash canonical URLs. An explicit catch-all handles any path with a trailing slash:
- `/:path+/` -> `/:path+` (301)
- Root `/` is explicitly preserved as `https://smelloff.in/`.

### 2.4 Legacy Content URL Migrations
Historical blog articles that were merged, renamed, or updated to reflect scientific accuracy (e.g. transition from zinc ricinoleate mentions to active zinc PCA chelation) are mapped directly to their new canonical targets:
- `/blog/zinc-ricinoleate-fabric-odor-ingredient` -> `/blog/zinc-pca-fabric-odor-ingredient-guide` (301)
- `/blog/is-zinc-ricinoleate-safe-for-clothes` -> `/blog/zinc-pca-fabric-odor-ingredient-guide` (301)
- `/blog/clothes-smell-after-washing` -> `/blog/gym-clothes-smell-after-washing` (301)
- `/blog/spray-for-clothes-not-skin` -> `/blog/best-deodorant-spray-for-clothes-not-skin` (301)
- `/blog/how-to-remove-musty-smell-from-clothes-monsoon` -> `/blog/how-to-remove-musty-smell-from-clothes` (301)
- `/blog/remove-sweat-smell-shirts-without-washing` -> `/blog/how-to-remove-sweat-smell-from-clothes-without-washing` (301)
- `/blog/smoke-smell-clothes` -> `/blog/how-to-remove-smoke-smell-from-clothes` (301)
- `/solutions/index` -> `/solutions` (301)
- `/index` -> `/` (301)

### 2.5 Policy Slugs Normalization
Consolidates legacy `/policies/*` prefixes to root level:
- `/policies/:slug(privacy|terms|returns|refund|shipping|cancellation|payment-failed)` -> `/:slug` (301)

---

## 3. Test Matrix & Hop Verification

All permutations tested against `simulateRedirect` and verified via automated test suite `test/seo-architecture.test.mjs`:

| Input URL | Intermediary Hops | Final Destination | Hop Count | Result |
| :--- | :--- | :--- | :--- | :--- |
| `https://www.smelloff.in/` | Direct 301 | `https://smelloff.in/` | 1 | PASS |
| `https://www.smelloff.in/odorstrike` | Direct 301 | `https://smelloff.in/odorstrike` | 1 | PASS |
| `https://www.smelloff.in/odorstrike/` | Direct 301 | `https://smelloff.in/odorstrike` | 1 | PASS |
| `https://www.smelloff.in/odorstrike.html` | Direct 301 | `https://smelloff.in/odorstrike` | 1 | PASS |
| `https://smelloff.in/odorstrike/` | Direct 301 | `https://smelloff.in/odorstrike` | 1 | PASS |
| `https://smelloff.in/odorstrike.html` | Direct 301 | `https://smelloff.in/odorstrike` | 1 | PASS |
| `https://smelloff.in/blog/clothes-smell-after-washing` | Direct 301 | `https://smelloff.in/blog/gym-clothes-smell-after-washing` | 1 | PASS |
| `https://www.smelloff.in/blog/clothes-smell-after-washing` | Direct 301 | `https://smelloff.in/blog/gym-clothes-smell-after-washing` | 1 | PASS |
| `https://smelloff.in/solutions/index` | Direct 301 | `https://smelloff.in/solutions` | 1 | PASS |
| `https://smelloff.in/policies/privacy` | Direct 301 | `https://smelloff.in/privacy` | 1 | PASS |

---

## 4. Redirect Chain & Loop Safeguards

1. **No Destination as Source:** Automated CI test verified that zero redirect destinations in `vercel.json` act as sources for another redirect rule.
2. **Deterministic 1-Hop www Handling:** All `www` rules output full canonical URLs (`https://smelloff.in/...`), ensuring clients never bounce between host redirects and path redirects.
3. **Loop Prevention:** Automated unit tests test for circular references and enforce zero loops across 100% of routes.
