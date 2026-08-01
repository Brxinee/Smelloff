# Blog thumbnails — AI-photographic set (2026-08-01)

The 17 blog hero/thumbnail images in `blog/assets/` are AI-generated
photorealistic editorial shots, produced from the prompt set in the
"Blog Thumbnail Research and Prompts" strategy doc (Gemini research,
2026-07). They replaced the earlier mascot/tweet-card designs.

## Design rules (from the research doc)

- **No text baked into the image** — the headline lives in the HTML card,
  the image carries the concept. (The old set burnt "Washed But Still
  Stinks?" style copy into the pixels.)
- 2–3 visual elements max, dominant subject at 40–60% of frame,
  30–40% negative space, ≥4.5:1 subject/background contrast.
- Dark, laboratory-editorial palette: slate/charcoal bases with one warm
  (amber/gold) or cool (cyan/teal) accent per image.
- Every image must still read at 120–160px wide (squint test).

## Pipeline

1. Generate at 16:9 from the per-article prompts (kept in
   `scripts/thumbnail-prompts.json`) with any FLUX-class model.
   Bloom (brand "Smelloff", already onboarded) is the preferred backend
   when the workspace has credits; any FLUX endpoint works.
2. Center-crop/resize to **1200×630** (the OG-image ratio used site-wide).
3. Export all three formats per slug: `.png` (source + og:image),
   `.webp` (quality 80), `.avif` (quality 65).
   `scripts/build-blog-thumbnails.js` can derive webp/avif from the png —
   but do NOT let its `updateHtmlPictureTags()` step run: it re-wraps
   `<img>` tags already inside `<picture>` and duplicates `<source>` rows.
4. **Bump the cache-bust query** (`?v=3` → `?v=4` …) on every
   `/blog/assets/...` reference in `blog/*.html`. The files are served
   `immutable` for a year, so replacing bytes under the same URL never
   reaches returning visitors.

## Slug → concept map

| Slug | Concept |
| --- | --- |
| gym-clothes-smell-after-washing | Diagonal split: lipid-clogged vs clean polyester weave |
| does-fabric-spray-stain-clothes | Droplet impact on black/white fabric seam, no marks |
| how-to-use-odorstrike | Levitating shirt with cyan target zones + mist arc |
| odorstrike-ingredients | Lab flat-lay: beaker, amber dropper, zinc powder |
| wedding-festive-wear-odor-guide | Fine mist over crimson silk + gold embroidery |
| best-fabric-odor-spray-india-2026-body-odor | Lab rig: mist penetrating mounted cotton swatch |
| best-deodorant-spray-for-clothes-not-skin | Pocket canister beside folded white oxford shirt |
| spray-to-remove-sweat-smell-from-clothes-instantly | Freeze-frame mist colliding with vapor haze |
| deodorant-vs-fabric-mist | Split: skin pores (warm) vs fabric weave (cool) |
| ambi-pur-vs-odorstrike | Scale contrast: bulky trigger bottle vs pocket mist |
| zinc-pca-fabric-odor-ingredient-guide | Teal zinc ions bonding to cotton micro-fibers |
| hpbcd-cyclodextrin-fabric-odor | Frosted-glass torus molecule trapping a compound |
| beta-cyclodextrin-odor-removal-science | Molecular ring cages woven into fabric threads |
| what-is-fabric-odor-eliminator | Split: perfume haze masking vs mist dissolving particles |
| odorstrike-vs-febreze-india | Two cotton swatches in humid, sun-drenched heat |
| why-i-built-odorstrike | Founder's workbench: notebooks, amber bottles, swatches |
| odorstrike-review-30-day-india-test | 2×2 diagnostic grid of four fabric swatches |
