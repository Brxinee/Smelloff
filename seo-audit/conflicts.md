# Keyword Cannibalization & Intent Conflicts — smelloff.in

Audited 2026-05-01. Source data: `seo-audit/url-map.json`.

Conflicts are ranked by priority. "Winner" = the URL we keep / strengthen.

---

## C1 — Same primary keyword on 2 URLs

**Keyword:** `best fabric odor spray india 2026` (commercial buyer's guide)

**URLs:**
- A: `/blog/best-fabric-odor-spray-india-2026` — generic category breakdown, sitemap priority 0.85
- B: `/blog/best-fabric-odor-spray-india-2026-body-odor` — 6-product ranking, sitemap priority 0.9, featured on homepage + blog hub

**Reasoning:** B has the deeper article (ranking-style with named competitors), is featured on the homepage and blog hero, has the higher sitemap priority, and already targets the exact same head term plus the body-odor long tail. A is a thinner category-level explainer. Same SERP intent, no meaningful angle differentiation.

**Fix:** **Consolidate via 301**. `/blog/best-fabric-odor-spray-india-2026` → `/blog/best-fabric-odor-spray-india-2026-body-odor`. Remove A from sitemap.

**Winner:** B.

---

## C2 — Transactional blog page competing with the homepage

**Keyword:** `where to buy odorstrike (india)` (transactional, branded)

**URLs:**
- A: `/blog/where-to-buy-odorstrike-india` — pricing, COD, dispatch windows, BUY-now CTA. Pure transactional.
- B: `/` (homepage) — primary product page with #buy anchor, full Product schema, AggregateOffer.

**Reasoning:** A is a transactional page sitting in `/blog/`. The first body line literally says "the answer is short: smelloff.in/#buy". That's an explicit redirect-by-prose. The homepage already owns the buying intent and has the Product schema; an extra blog URL only fragments link equity for branded "buy ODORSTRIKE" queries.

**Fix:** **Consolidate via 301**. `/blog/where-to-buy-odorstrike-india` → `/`. Remove from sitemap. Update internal anchor in homepage footer (`<li><a href="/blog/where-to-buy-odorstrike-india">Where to buy</a></li>`) to point at `/#buy` with informational anchor "Pricing & COD".

**Winner:** `/`.

---

## C3 — Near-duplicate intent: men's body-odor buyer's guide

**Keyword cluster:** "best body odor spray for men in India" / "best fabric odor spray for body odor"

**URLs:**
- A: `/blog/best-body-odor-remover-spray-for-men-india` — ranking-style, opens with "tested fabric mists ranked"
- B: `/blog/best-fabric-odor-spray-india-2026-body-odor` — also a 6-product ranking, also targets body-odor angle

**Reasoning:** Both are commercial ranking guides for "best spray for body odor in India". B is the canonical buyer's guide (priority 0.9, featured). A overlaps heavily but has a differentiator that's not currently surfaced: men-specific physiology (apocrine glands, diet, fabric stack). Title and lead paragraph today position it as a product ranking — which is B's job.

**Fix:** **Differentiate**. Rewrite A's title, H1, meta description, and lead so the primary keyword shifts to **"why Indian men sweat-smell more (and what to do about it)"** — biology/diet/fabric/apocrine, not a product ranking. Internally cross-link A → B with anchor "see the product ranking".

**Winner (for ranking-style query):** B. **Winner (for men's biology query):** A, after rewrite.

---

## C4 — Near-duplicate intent: deodorant-alternative for clothes

**Keyword cluster:** "deodorant for clothes" / "alternative to deodorant for clothes"

**URLs:**
- A: `/blog/alternative-to-deodorant-for-clothes-smell` — conceptual: "why deodorant fails on fabric, what works instead"
- B: `/blog/best-deodorant-spray-for-clothes-not-skin` — same lead paragraph framing, also "deodorant treats skin only…"

**Reasoning:** Both posts open with the same conceptual frame ("deodorant is for skin, your shirt holds the smell"). A targets the educational/awareness query. B's slug implies a product comparison ("best…") but the body delivers the same explainer. Two URLs hitting the same SERP cluster.

**Fix:** **Differentiate**. Rewrite B's title, H1, meta, and lead to be a product/category comparison aligned to its slug — concrete sprays compared with prices and ingredients. Keep A as the conceptual explainer.

**Winner (educational):** A. **Winner (product comparison):** B, after rewrite.

---

## C5 — Near-duplicate intent: clothes smell after washing

**Keyword cluster:** "why do clothes smell after washing"

**URLs:**
- A: `/blog/clothes-smell-after-washing` — broad explainer, all fabric types
- B: `/blog/gym-clothes-smell-after-washing` — also opens with washing-failure framing

**Reasoning:** A owns the head term. B should differentiate by being polyester-specific (the Nike Dri-Fit case it already references in para 1). Today its title and meta are generic enough that it competes with A on the same head query.

**Fix:** **Differentiate**. Rewrite B's title, H1, meta, and lead to lock onto **polyester gym clothes / synthetic activewear odor** specifically — the polyester oleophilic fiber problem, not generic "clothes don't smell clean". Cross-link A as the broader explainer.

**Winner (broad):** A. **Winner (polyester-specific):** B, after rewrite.

---

## C6 — Inconsistent / commercial internal anchor pointing to blog

**Issue:** The homepage footer (`index.html:4276–4281`) links to blog posts with these anchors:

| Anchor | Target | Issue |
|---|---|---|
| "Best fabric odor spray" | `/blog/best-fabric-odor-spray-india-2026-body-odor` | Commercial-sounding anchor → blog post. Should be informational. |
| "Where to buy" | `/blog/where-to-buy-odorstrike-india` | Commercial anchor + blog target that's being redirected to `/` in C2. Must change. |

All other footer blog anchors ("All Guides", "Fix shirt odor fast", "Deodorant vs fabric mist", "30-day review", "Why I built it") are informational — fine.

**Fix:** **Internal-linking edit**.
- "Best fabric odor spray" → "Compare fabric odor sprays" (informational anchor, same target)
- "Where to buy" → "Pricing & COD details", retargeted to `/#buy`

**Winner:** N/A — anchor-text rewrite.

---

## C7 — Mild overlap accepted (no action)

The following clusters share theme but each holds a clearly distinct angle in title + lead. No action needed; cross-linking is sufficient.

- `deodorant-vs-fabric-mist` (comparison) vs `why-deodorant-stops-working-after-3-hours` (timing) vs `alternative-to-deodorant-for-clothes-smell` (solution framing) — three valid distinct angles.
- `remove-sweat-smell-shirts-without-washing` (no-wash methods, multiple) vs `spray-to-remove-sweat-smell-from-clothes-instantly` (5-spray test, single tool intent) — distinct user moments.
- `fix-shirt-odor-before-meeting` (tactical 60-sec) vs `confidence-spray-pre-meeting-date` (habit / mindset) — different framings.
- `bike-rider-sweat-smell-india`, `mumbai-humidity-sweat-smell-survival-guide`, `indian-summer-sweat-smell-guide`, `hostel-clothes-smell-college-guide`, `gym-to-office-without-showering`, `how-to-not-smell-sweaty-at-work`, `office-ac-trap-why-rewear-shirts-smell-worse` — each scoped to a distinct persona / situation. Theme overlap is fine when long-tail keyword is unique.

---

## Action summary

| # | URL | Action | Impl |
|---|---|---|---|
| C1 | `/blog/best-fabric-odor-spray-india-2026` | 301 → `/blog/best-fabric-odor-spray-india-2026-body-odor` | `vercel.json` redirect; remove from sitemap |
| C2 | `/blog/where-to-buy-odorstrike-india` | 301 → `/` | `vercel.json` redirect; remove from sitemap; update homepage anchor |
| C3 | `/blog/best-body-odor-remover-spray-for-men-india` | Differentiate (men's biology angle) | Rewrite title/H1/meta/lead in HTML |
| C4 | `/blog/best-deodorant-spray-for-clothes-not-skin` | Differentiate (product comparison angle) | Rewrite title/H1/meta/lead in HTML |
| C5 | `/blog/gym-clothes-smell-after-washing` | Differentiate (polyester-specific) | Rewrite title/H1/meta/lead in HTML |
| C6 | `/index.html` footer | Fix internal anchor text | Edit anchors in homepage footer |
