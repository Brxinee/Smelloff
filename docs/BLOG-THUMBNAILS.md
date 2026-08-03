# Blog thumbnails — licensed-photography set (2026-08-03)

The 17 posts under `/blog` each have a **1920×1080 (16:9)** featured image: licensed
Adobe Stock photography under a brand type layer, built by a script from a single
config. This document is the operating manual.

Source of truth: **`scripts/thumbnails/thumbnails.config.mjs`** — one entry per post,
consumed by both renderers so copy and photography can't drift.

```
npm run thumbnails          # build the images, then wire them into the markup
npm run thumbnails:build    # images only  (needs .thumbnail-sources/)
npm run thumbnails:apply    # markup only  (no images needed)
npm run thumbnails:check    # dry run — exits 1 if markup is out of sync
```

`npm run build` runs `thumbnails:check` + `node -c server.js`. It deliberately does
**not** regenerate images: the source photography is not in the repo, so a build on
a fresh clone (or on Vercel) must not depend on it.

---

## What changed, and what it reversed

This set replaced the 1200×630 mascot "tweet cards". It was specified by
`High_CTR_Blog_Thumbnail_Research.pdf` (2026-08), which supersedes the earlier
Gemini prompt research that the previous version of this file described.

Two rules from that earlier doc are **deliberately reversed**; don't restore them
without new evidence:

- **"No text baked into the image."** The new research measures the opposite: a
  short overlay outperforms a bare image, and interrogative framing runs ~20% above
  a flat statement. Overlays are now baked in, capped at six words.
- **1200×630 (the OG ratio).** Discover letterboxes it. 16:9 is what gets the
  full-width card.

The earlier doc also described an AI-generated photorealistic set as though it
shipped. It never did — the assets in `blog/assets/` were still the mascot cards
when this set replaced them. `scripts/thumbnail-prompts.json` is the residue of
that plan and is now unused.

---

## Why these specs

The numbers are the reason, not decoration.

| Spec | Value | Why |
|---|---|---|
| Dimensions | 1920×1080 | Discover wants ≥1200px wide and >300,000px total; this is 2,073,600px and clears the >920,000px benchmark |
| Aspect | 16:9 | Prevents the crawler auto-cropping off-centre |
| `max-image-preview:large` | in every post's robots meta | Without it the feed renders a small, low-CTR thumbnail no matter how good the asset is. `apply-thumbnails.mjs` **fails** if a post is missing it |
| `og:image` / `twitter:image` | the 1920×1080 **JPEG** | Social scrapers are the one audience that still can't be trusted with WebP. Never a logo, never a square |
| JSON-LD `image` | array of the same URL | The structural validator looks for a matching high-resolution array |
| Page delivery | AVIF → WebP → JPEG via `<picture>` | Protects LCP |
| `width` / `height` on `<img>` | always explicit | Holds CLS at zero |
| Overlay text | **≤ 6 words** | Past 10 words CTR drops ~16%. `validateConfig()` throws above 6 |
| Framing | a question wherever honest | ~20% above flat descriptive statements |
| Visual anchor | a human face | 9.2% median CTR vs 6.1% for object-only compositions |
| Never | watermarks, logo-as-subject, coloured borders | All three score as commercial noise and get suppressed |

Output per post (5 files, ~260KB total):

```
blog/assets/<slug>.jpg          1920×1080   og:image / twitter:image / schema
blog/assets/<slug>.webp         1920×1080   <picture>
blog/assets/<slug>.avif         1920×1080   <picture>
blog/assets/<slug>@1200.webp    1200×675    srcset step
blog/assets/<slug>@1200.avif    1200×675    srcset step
```

---

## The photography

Licensed **Adobe Stock**, bought against the Smelloff account. `photo` in the config
is the Adobe Stock asset id.

The originals are **not committed** — 5–15MB each, and `.thumbnail-sources/` is
gitignored. To rebuild images from scratch you need them back:

1. In a session with the Adobe connector, license each id
   (`asset_license_and_download_stock` → 1-hour presigned URL). Re-licensing an id
   you already own does **not** charge again; it just refreshes the URL.
2. Save each as `.thumbnail-sources/<assetId>.jpg`.
3. `npm run thumbnails`.

Override the folder with `THUMBNAIL_SOURCES=/path/to/originals`. The build fails
naming the specific missing asset id rather than rendering a hole, so a partial
folder is safe.

### Brand constraints on photo choice

Per CLAUDE.md "Positioning: clothing only" — not stylistic preferences:

- **Never** spray being applied to skin, hair or body. ODORSTRIKE is fabric-only and
  a thumbnail carries no copy to qualify it. (`best-deodorant-spray-for-clothes-not-skin`
  first drew an underarm/deodorant frame, which argued the exact opposite of the post
  it sat on — it is now a man smelling his *shirt*.)
- **Never** shoes, helmets, gym gear, bags, sofas, curtains, room freshening.
- Clothing, fabric, laundry, and the people wearing them.

### Per-photo knobs

- `focal` — `object-position` for the crop. The photo panel is ~1.17:1 and most stock
  is 3:2, so **both** axes bite; use it to keep the face in frame.
- `tone` — optional CSS `filter`. The lab/science stock is dim and low-contrast and
  the scrim pushed it to mud; those entries carry a brightness/contrast lift.

### Rendering note

`--window-size` sizes the **window**, not the viewport — headless Chromium still
reserves its chrome, so roughly the bottom 90 CSS px never reach `--screenshot`.
`build-thumbnails.mjs` renders into a taller window and crops the canvas back out.
`scripts/build_thumbnails.py` never hit this because its card was inset from the
bottom edge; the site wordmark here is not.

---

## Canva Connect route (not yet runnable)

`scripts/canva_thumbnail_automation.js` implements the Autofill pipeline from the
research PDF, driven by the same config.

**It needs a paid Canva plan.** Brand Templates and the Autofill API are
Pro/Teams/Enterprise features; the connected account was on Free, and every
brand-template call returns:

> This feature requires a Canva paid plan (such as Canva Pro, Canva Teams, or
> Canva Enterprise).

That is why the committed thumbnails came from the local compositor. **The script
has never been run end-to-end against a live template.**

To enable it:

1. Canva Developer Portal → create a Public Integration; note Client ID/Secret.
2. Scopes: `brandtemplate:content:read`, `brandtemplate:meta:read`,
   `design:content:write`, `asset:read`, `asset:write`.
3. Add your redirect URL under Authorized Redirects.
4. Create a 1920×1080 Brand Template with a text field `headline_text` and an image
   frame `main_visual`. Record the `brand_template_id`.
5. ```
   export CANVA_ACCESS_TOKEN="..."
   export CANVA_TEMPLATE_ID="..."
   node scripts/canva_thumbnail_automation.js --all
   ```

It writes designs into Canva and prints edit URLs; it does **not** write into
`blog/assets/`. Export from Canva, drop the files in, then `npm run thumbnails:apply`.

Three deliberate deviations from the PDF's reference script are documented in its
header — most importantly the asset upload posts **raw binary** with an
`Asset-Upload-Metadata` header, because the PDF's `{name, file_base64}` JSON body is
rejected by the live endpoint with a 400.

---

## Changing a thumbnail

Copy only:

1. Edit `top` / `hi` in the config (≤6 words combined — it throws otherwise).
2. `npm run thumbnails`.

Swapping a photo:

1. License the new Adobe Stock id, save to `.thumbnail-sources/<id>.jpg`.
2. Update `photo`, `focal` and **`alt`** together — alt must describe the image that
   is actually there.
3. `npm run thumbnails`.

**Bump `V` in `apply-thumbnails.mjs` whenever the pixels change.** `/assets/*` is
served `Cache-Control: immutable` for a year, so without a new `?v=` returning
visitors keep the old image indefinitely — the same trap CLAUDE.md documents for the
shared CSS/JS layers.

---

## Retired

- `scripts/build-blog-thumbnails.js` — **deleted**. It re-wrapped `<img>` elements
  already inside a `<picture>`, so every block accumulated duplicate `<source>` tags
  on each run; the blog index had six sources for two formats. (The previous version
  of this file warned "do NOT let its `updateHtmlPictureTags()` step run" — a warning
  in prose is not a fix.) `apply-thumbnails.mjs` replaces whole blocks and is
  idempotent, with `--check` for CI.
- `scripts/build_thumbnails.py` — the 1200×630 mascot tweet cards. Kept for reference
  but guarded: exits unless `ALLOW_LEGACY_THUMBNAILS=1`, because it would overwrite
  the current assets and most of its slug table was deleted in the 2026-07-28 prune.
- `scripts/thumbnail-prompts.json` — generative prompts for the macro route that was
  never run. Superseded by licensed photography.
