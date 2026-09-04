# Blog visual system — photography-first (2026-09-05)

Every published guide has a **1920×1080 (16:9)** featured photograph. TEXT lives
in HTML. VISUAL is a real-life image — not a title card, not an overlay
headline, not a logo lockup.

Source of truth: **`scripts/thumbnails/thumbnails.config.mjs`**.
Canonical map: **`blog-image-manifest.json`**.

```
npm run thumbnails          # encode the images, then wire them into markup
npm run thumbnails:build    # images only  (needs .thumbnail-sources/)
npm run thumbnails:apply    # markup only  (no sources needed)
npm run thumbnails:check    # dry run — exits 1 if markup or the manifest drift
```

`npm run build` runs `thumbnails:check`. It does **not** regenerate pixels: the
source stills are gitignored, so a Vercel build must not depend on them.

---

## What this set reversed

An earlier 2026-08 compositor baked a ≤6-word overlay onto licensed Adobe Stock
because a CTR paper preferred text-on-image. Google’s 2026 Images / Discover
guidance is the opposite authority for this site:

- preferred images should not be text-heavy
- Schema.org `image` **and** `og:image` can both be selected as the preview
- Discover wants large, representative photographs (≥1200px wide)

So:

- **No overlay copy in the image.** Headlines stay in HTML.
- **No SVG title cards** as the default blog art. SVG is for genuine diagrams.
- **16:9 at 1920×1080** stays. Discover letterboxes 1200×630.

The Canva Autofill route and the overlay compositor are retired. Do not restore
them without new evidence that beats Google’s current image-selection docs.

https://developers.google.com/search/docs/appearance/google-images
https://developers.google.com/search/docs/appearance/google-discover

---

## Why these specs

| Spec | Value | Why |
|---|---|---|
| Dimensions | 1920×1080 | Discover wants ≥1200px wide and >300,000px total; this is 2,073,600px |
| Aspect | 16:9 | Prevents the crawler auto-cropping off-centre |
| `max-image-preview:large` | in every post's robots meta | Without it the feed renders a small thumbnail no matter how good the asset is. `apply-thumbnails.mjs` **fails** if a post is missing it |
| `og:image` / `twitter:image` | the 1920×1080 **JPEG** | Social scrapers still can't be trusted with WebP. Never a logo, never a square, never an SVG title card |
| JSON-LD `image` | array of the same URL | Google 2026: schema image and og:image are both preview sources |
| Page delivery | AVIF → WebP → JPEG via `<picture>` | Protects LCP |
| `width` / `height` on `<img>` | always explicit | Holds CLS at zero |
| Overlay text | **none** | TEXT = HTML. VISUAL = IMAGE |
| Never | watermarks, logo-as-subject, coloured borders, baked headlines | Commercial noise; text-heavy frames get suppressed |

Output per post (5 files):

```
blog/assets/<slug>.jpg          1920×1080   og:image / twitter:image / schema
blog/assets/<slug>.webp         1920×1080   <picture>
blog/assets/<slug>.avif         1920×1080   <picture>
blog/assets/<slug>@1200.webp    1200×675    srcset step
blog/assets/<slug>@1200.avif    1200×675    srcset step
```

---

## Visual families

| Family | What you photograph |
|---|---|
| `fabric-problems` | Collars, underarms, fibre, wear |
| `laundry` | Machines, drying, storage, humidity |
| `real-life` | Office, commute, meeting, travel, India-first rooms |
| `science` | Fibres, mechanisms — diagrams go *inline*, not in the hero |
| `product` | Real ODORSTRIKE photography, pocket scale (~11cm) |

Problem article → problem image. Science article → science image. Product
article → product image. Do not put the bottle on every card.

---

## Product photography

Use the real ODORSTRIKE files in `/assets/` (`pdp-03-how-to-use.webp`,
`shot-studio.webp`, `shot-flatlay.webp`, `shot-pocket.webp`). Never regenerate
the bottle, never alter the label, never invent a variant.

Portrait product shots use `fit: 'contain'` so the 11cm bottle is padded on
`#080808` instead of cropped into a giant.

Clothing only. Never: skin spray, shoes, helmets, room spray, pet spray.

---

## Sources

Editorial stills and the real product photographs live in `.thumbnail-sources/`
(gitignored). Stage them with `node scripts/thumbnails/stage-sources.mjs` when
the Imagine artefacts and `/assets/` product shots are on disk, then:

```
npm run thumbnails:build
npm run thumbnails:apply
```

Override the folder with `THUMBNAIL_SOURCES=/path/to/originals`. The build
fails naming the missing file rather than rendering a hole.

**Bump `V` in `apply-thumbnails.mjs` whenever the pixels change.** `/assets/*`
is served `Cache-Control: immutable` for a year.

---

## Inline images

Inline figures exist only where they explain something:

- `blog/assets/diagrams/*.svg` — genuine information diagrams (keep)
- `blog/assets/inline/odorstrike-pocket-scale.*` — real bottle at pocket scale
- `blog/assets/inline/shirt-collar-architecture.*` — collar construction

Do not insert a photograph every few paragraphs.

---

## Retired

- SVG title cards in `blog/assets/<slug>.svg` — deleted 2026-09-05. They existed
  to display a headline on black + acid green. That is not a thumbnail.
- Overlay compositor in the previous `build-thumbnails.mjs` — replaced by a
  sharp encode with no type layer.
- `scripts/build_thumbnails.py` — 1200×630 mascot tweet cards. Guarded behind
  `ALLOW_LEGACY_THUMBNAILS=1`.
- `scripts/thumbnail-prompts.json` — unused generative residue.
- Canva Autofill — never ran end-to-end; not the pipeline.

`apply-thumbnails.mjs` unwraps nested `<picture>` tags and will not wrap an
`<img>` that is already inside one. `--check` fails on nested pictures, missing
`max-image-preview:large`, missing encoded assets, or a drifting manifest.
