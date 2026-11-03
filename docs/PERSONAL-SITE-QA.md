# Personal site: QA and performance (2 Nov 2026)

Everything below was run against a local build (`node personal-site/build.mjs`, `node serve.mjs`)
in headless Chromium (Playwright). Production adds Cloudflare compression, so live transfer sizes
will be smaller than the uncompressed numbers here.

## Tests

| Check | Result |
|---|---|
| `personal-site/test/site.test.mjs` (14 tests: pages, one H1, titles 15–70, descriptions ≤170, canonicals under /NikhilPatil, hashed assets that exist, links and #anchors resolve, external links `rel="noopener"`, JSON-LD: one Person with smelloff.in's `#founder` id and his portrait, ProfilePage/AboutPage/BlogPosting, sitemap with image, RSS count, no phone numbers / unknown emails / prices / percentages / personal dates / unapproved items, one inline script, no inline styles, content rules) | 14 / 14 pass |
| Root `npm test` | 415 tests, 406 pass. The same 9 fail on `main` in this container: the `resend` package isn't installed |
| `test/cloudflare-routing.test.mjs` (incl. `/nikhilpatil` → `/NikhilPatil`) | pass |
| Smelloff build checks (`apply-thumbnails`, `apply-figures`, `apply-structured-data`, `build-llms`, `chat-guides`, `apply-reader`, `apply-serp-titles`, `share`, `sitemap` with `--check`; `audit-production`) | all pass |
| `scripts/prepare-public.mjs` | writes `public/NikhilPatil` (5 pages) and `public/sitemap-nikhil-patil.xml`; no `_redirects` rule collides with the path |

Not run here: `npm run build` end to end (its image step needs `sharp`, not installed in this
container) and `wrangler` (not installed). Cloudflare Workers Builds runs both on the PR.

## Accessibility (axe-core 4.10, WCAG 2.2 A/AA + best practice)

5 pages × 360 / 390 / 430 / 768 / 1024 / 1440, light, plus dark at 390 and 1440 (40 runs):
**0 violations, no horizontal overflow, exactly one H1 per page, no tap target under 24×24 px
(inline text links excepted, as 2.5.8 allows), no console errors, no failed requests.**

Found and fixed during the pass: the logo link lost its name on phones (its text was
`display:none`), and photo captions failed contrast in dark mode (prints stay light, the ink
didn't).

## Performance (lab)

Throttled to 150 ms RTT, 1.6 Mbps down; phone runs at 390×844, DPR 3, CPU 4× slower.

| Page | LCP | LCP element | CLS | Requests | Bytes (uncompressed) |
|---|---|---|---|---|---|
| Cover, phone | 1.54 s | dek paragraph | 0 | 13 | 296 KB (fonts 136, images 82, CSS 42, HTML 27, JS 9) |
| About, phone | 1.19 s | photo | 0.0014 | 9 | 208 KB |
| Cover, desktop | 1.10 s | masthead | 0.0003 | 14 | 311 KB |

A tap on a cover tool reaches the next frame in 23–37 ms (a lab stand-in for INP). Targets:
LCP ≤ 2.5 s, INP < 200 ms, CLS < 0.1. Field data comes from Search Console once it's live.

## Screens checked by eye

Cover at 360, 390, 768, 1024, 1440 (light and dark); every section on a 390 phone; About, Now,
Log and the colophon at 390 and 1440. Fixed on the way: collage pieces colliding at each width,
a code snippet clipping at 360, the share image's stamp over its text.

## Independent review

A separate reviewer agent exercised keyboard, touch drag, the toys, JavaScript off, copy and
metadata. Its findings and what was done about them are listed below.
