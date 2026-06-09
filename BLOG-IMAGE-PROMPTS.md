# Smelloff Blog Image System — Prompts & Templates

**Brand palette (locked):**
- Background: near-black `#080808`
- Primary accent: acid-green `#B8FF57` (the ONE color — use sparingly, high impact)
- Secondary: light-green `#D2FF8A`, card-grey `#111111`
- Type: Barlow Condensed (bold/900, condensed) for headlines, Inter Tight for any sub-text
- Hero object: ODORSTRIKE — a matte-black 50ml pocket spray bottle with an acid-green label/cap accent

**Output spec (every image):**
- Size: **1200 × 630 px** (1.91:1 — the OG/social + in-article hero ratio)
- Format: export as WebP (fallback JPG), file name = blog slug (e.g. `gym-clothes-smell-after-washing.webp`)
- Safe zone: keep headline text in the left or lower third; never dead-center (so it survives social cropping)

---

## 🔑 MASTER STYLE PROMPT (paste this FIRST, every time)

Use this as the style anchor, then append one scene from below. Works in Midjourney, Flux, DALL·E 3, Nano Banana, Ideogram (Ideogram/Flux handle the text overlay best).

```
Editorial product photograph for a premium Indian D2C grooming brand.
Mood: dark, high-contrast, scientific, masculine, minimalist, confident.
Background: near-black #080808 seamless studio sweep with subtle soft gradient.
Lighting: single hard key light from upper left, deep shadows, slight rim light.
Color: monochrome black-and-charcoal scene with ONE acid-green #B8FF57 accent
as the only color pop. No other colors.
Texture: fine cinematic film grain, crisp focus, shallow depth of field.
Composition: wide 1200x630 banner, generous negative space on the left third for
headline text, subject weighted to the right.
Style: looks like a Nike x lab-equipment campaign. Premium, not cluttered, no stock-photo vibe.
--ar 1.91:1
```

**Negative prompt (Flux/SD):**
```
no clutter, no rainbow colors, no pastel, no busy background, no watermark,
no distorted text, no extra fingers, no cheesy stock photo, no light mode,
no white background, no multiple accent colors
```

**Text-overlay note:** For best OG impact, bake a short Barlow-Condensed headline (3–6 words, white with one acid-green word) into the lower-left. If your generator mangles text, generate the image clean and add the headline in Canva/Figma afterward.

---

## 📸 TOP 10 BLOG IMAGE IDEAS

Each = MASTER PROMPT + the scene line below. Ordered by SEO value.

### 1. `gym-clothes-smell-after-washing`
*"Why Polyester Gym Clothes Smell After Washing"*
```
Scene: a crumpled black polyester gym t-shirt on a dark surface, with a glowing
acid-green #B8FF57 microscopic-fiber pattern emerging from the fabric weave
(odor molecules trapped in micro-fibers). The ODORSTRIKE bottle stands to the right.
Overlay text lower-left: "WASHED. STILL SMELLS." with "STILL" in acid-green.
```

### 2. `odorstrike-vs-febreze-india`
*"ODORSTRIKE vs Febreze"*
```
Scene: clean split-screen face-off. Left side dim/grey with a generic large
fragrance home-spray silhouette; right side lit with the compact black ODORSTRIKE
bottle glowing under an acid-green rim light. A thin acid-green divider line splits them.
Overlay: "MASK vs ELIMINATE" — "ELIMINATE" in acid-green.
```

### 3. `remove-sweat-smell-shirts-without-washing`
*"How to Remove Sweat Smell From Shirts Without Washing"*
```
Scene: a crisp folded dark dress shirt with a fine acid-green mist arcing across
the collar from the ODORSTRIKE bottle nozzle, mist frozen mid-spray, droplets catching light.
Overlay: "NO WASH. NO SMELL." with "NO SMELL" in acid-green.
```

### 4. `deodorant-vs-fabric-mist`
*"Deodorant vs Fabric Mist"*
```
Scene: two objects on a dark pedestal — a generic deodorant stick (grey, dim) and
the ODORSTRIKE bottle (lit, acid-green accent). A faint acid-green outline of a shirt
behind the bottle, a faint skin/arm outline behind the deodorant — showing skin vs fabric.
Overlay: "SKIN vs FABRIC".
```

### 5. `best-fabric-odor-spray-india-2026-body-odor`
*"Best Fabric Odor Spray in India 2026"*
```
Scene: hero product shot — the ODORSTRIKE bottle centered-right on a black reflective
surface, dramatic single spotlight, a subtle acid-green "#1" or laurel accent, faint
India map outline glowing acid-green in the deep background.
Overlay: "INDIA'S FABRIC ODOR SPRAY — 2026" with "2026" in acid-green.
```

### 6. `clothes-smell-after-washing`
*"Why Your Clothes Smell Even After Washing"*
```
Scene: a washing machine drum shot from inside, dark and moody, a single dark shirt
tumbling, with faint acid-green bacteria/odor-molecule glows still clinging to the fabric
after the wash. ODORSTRIKE bottle on the machine's edge in foreground.
Overlay: "CLEAN ISN'T FRESH" — "ISN'T" in acid-green.
```

### 7. `zinc-pca-fabric-odor-ingredient-guide`
*"Zinc PCA — The Ingredient That Kills Fabric Odor"*
```
Scene: science-lab aesthetic. A black hexagonal molecular-bond diagram glowing
acid-green #B8FF57 floating above the ODORSTRIKE bottle, like a chemistry HUD.
Clean dark lab bench, subtle glassware bokeh.
Overlay: "ZINC PCA" big in acid-green, "the molecule that binds odor" small below.
```

### 8. `odorstrike-review-30-day-india-test`
*"ODORSTRIKE Review: 30 Days, Real Results"*
```
Scene: the ODORSTRIKE bottle slightly used, standing beside a minimal dark calendar/grid
with 30 acid-green check-marks, lived-in desk feel, warm key light, honest documentary mood.
Overlay: "30 DAYS. REAL TEST." with "30" in acid-green.
```

### 9. `mumbai-humidity-sweat-smell-survival-guide`
*"Mumbai Humidity Sweat Smell Survival Guide"*
```
Scene: moody dark Mumbai skyline silhouette at dusk with heavy humid haze, foreground
a dark shirt with faint sweat sheen, ODORSTRIKE bottle in pocket of a hanging shirt.
A single acid-green humidity/water-droplet motif.
Overlay: "BEAT THE HUMIDITY" — "BEAT" in acid-green.
```

### 10. `bike-rider-sweat-smell-india`
*"Bike Rider Sweat Smell (India Heat)"*
```
Scene: cinematic low shot of a helmet and dark riding jacket on a motorcycle seat at
golden-dark hour, ODORSTRIKE bottle tucked in the jacket pocket, faint acid-green
mist accent near the collar.
Overlay: "2 SPRAYS BEFORE THE RIDE" — "2 SPRAYS" in acid-green.
```

---

## ⚙️ Production tips
- **Consistency > variety.** Same background, same single accent, same light direction across all 10 = a recognizable feed and stronger brand recall.
- **Batch in one session** with the same seed/style ref so they feel like a set.
- **Reuse the bottle:** if your generator drifts the product design, shoot/generate the bottle once and composite it into each scene for accuracy.
- After generating, each blog post needs: `<img src=".../slug.webp" alt="[descriptive]" loading="lazy" width="1200" height="630">` plus updating the per-post `og:image` from the shared `og-image.jpg` to the new one.

---

## Want me to generate them?
I have an image-gen SEO skill and Canva is connected. I can:
1. Generate the 10 images from these prompts, OR
2. Build them as a Canva template you can edit, OR
3. Wire the `<img>` tags + per-post `og:image` into the blog HTML once images exist.
