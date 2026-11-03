# Nikhil Patil: a zine about one person

The personal site at **https://smelloff.in/NikhilPatil**. Static HTML, CSS and a little JavaScript,
built by one Node script with no dependencies. It ships with the smelloff.in deploy but shares
nothing with the store's design.

```
node build.mjs     # preview build → dist/NikhilPatil (+ dist/sitemap-nikhil-patil.xml)
node serve.mjs     # http://localhost:4321/NikhilPatil
node --test        # 14 tests (also run by the repo's root `npm test`)
```

## Edit the content

Everything the site says is in `content/`:

| File | What it holds |
|---|---|
| `site.json` | Name, full name, city, description, photo, profiles (`sameAs`), contact |
| `now.json` | The /now note: one main thing, at most two on the side (a test holds the rule) |
| `journey.json` | The "Clocked in" time card: jobs in order, no dates |
| `syllabus.json` | The self-taught syllabus |
| `bench.json` | "Things I've made" cards; `status` becomes the rubber stamp |
| `shelf.json` | The anime cassette (`items` is empty on purpose; any added return as a list) |
| `credits.json` | Credits for pictures that aren't his (shown on About) |
| `notes/*.md` | Optional notes (Markdown with front matter); each gets a page. None today |

Facts must come from `docs/PERSONAL-CONTENT-SOURCE-MAP.md` category 1, or be approved by Nikhil.

## How it ships

`scripts/prepare-public.mjs` (the last step of `npm run build`) calls `build()` with
`outDir: public/NikhilPatil`, so the pages are generated at deploy time and never committed. The
Smelloff page generators skip `personal-site/` (`apply-chrome`, `build-sitemap`, `audit-production`).
The sitemap goes to `/sitemap-nikhil-patil.xml` and `robots.txt` names it. Other spellings
(`/nikhilpatil`, `/NIKHILPATIL/About`) 301 to the right one (`src/canonical.js`).

The Person on these pages uses smelloff.in's founder id (`https://smelloff.in/#founder`), and
smelloff.in's founder schema, blog bylines and About page now point here, so search engines see one
person with one home page.

## Look and feel

Design decisions and tokens: `docs/PERSONAL-SITE-DESIGN.md`. Research: `docs/PERSONAL-SITE-RESEARCH.md`.
QA and performance: `docs/PERSONAL-SITE-QA.md`.

Images: `assets/img/me/` are his photos; `glove.*` and `cassette.*` are CC0 Wikimedia Commons photos
cut out with `scripts/cutout.py`; `bottle-halftone.*` comes from `scripts/halftone.py`; the share
image `og.jpg` is rendered from `scripts/og.html` by `scripts/render-images.mjs` (needs Playwright).
Fonts in `assets/fonts/` are OFL, subset to Latin (`OFL.txt`). Hashed file names mean a changed
asset reaches everyone at once.
