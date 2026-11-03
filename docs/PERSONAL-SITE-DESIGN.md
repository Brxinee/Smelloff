# Personal site: design system and decisions

`personal-site/` at https://smelloff.in/NikhilPatil. Why this direction was chosen:
`docs/PERSONAL-SITE-RESEARCH.md` §5.

## Concept

A **photocopied DIY zine about one person**: cheap paper, toner, a ballpoint, a rubber stamp,
masking tape, cut-out pictures. Self-taught people make zines; Nikhil is self-taught. Every playful
element has a job (see the research doc's table). Nothing on the page is a stock prop pretending to
be his.

## Information architecture

One long cover page that reads like an issue, plus four inner pages.

| Section (home) | Purpose |
|---|---|
| Cover | Name as the H1, one-sentence dek, collage of his photos and things, toys (Stamp, Tidy, Ring), printed table of contents |
| 01 Now | One main thing + at most two on the side (his own rule) |
| 02 Clocked in | Work journey as a time card |
| 03 Self-taught syllabus | Selling, operations and web: what he taught himself after Class 10, each with where it shows |
| 04 Shelf | The anime cassette (the interests list was removed on 3 Nov 2026) |
| 05 Things I've made | Startup (one card; the store-website and this-site cards were removed on 3 Nov 2026) |
| 06 Take a card | Visiting card + .vcf download; every profile |

Inner pages: `/about` (the fact page for search and for people), `/now` (notes at `/notes/<slug>` if any are added; the colophon note was removed on 3 Nov 2026 and its credits moved to About). (The dated log and its RSS feed were removed on 3 Nov 2026 at his request; `/NikhilPatil/log` and `/NikhilPatil/feed.xml` 301 to the cover.)
Navigation is always visible and labelled (Now · About), plus the brand link home. Toys are
optional; all content is in the HTML and readable without JavaScript.

## Tokens (`assets/css/site.css` §1)

| Token | Light | Dark ("shutter down") | Contrast on paper |
|---|---|---|---|
| `--paper` | `#F2EDE3` newsprint | `#141311` | |
| `--ink` | `#1A1917` toner | `#ECE6D8` | 15.1 / 14.9 |
| `--ink-2` | `#47433C` | `#C9C2B3` | 8.4 |
| `--muted` | `#625D54` | `#A39C8E` | 5.6 / 6.8 |
| `--blue` | `#2340C8` Reynolds ballpoint | `#9AAAFF` | 6.8 / 8.5 |
| `--stamp` | `#C8341F` stamp-pad red | `#FF7259` | 4.5 / 6.9 |
| `--hi` | `#FFE45A` highlighter (ink on it 13.8) | `#6A5C12` | |

Photo prints stay light paper in both themes, so their captions keep the light-theme blue.
The halftone bottle inverts in dark mode (`--dots`).

**Type.** Archivo (variable, weight 100–900, width 62–125%) for the masthead (125%, 900) and all
text; Courier Prime for typed labels, dates, stamps; Reenie Beanie for ballpoint notes, never for
anything essential. All OFL, subset to Latin, ~140KB total; only Archivo is preloaded. The fallback
face is Arial with measured `size-adjust: 99%` and Archivo's ascent/descent, so the swap doesn't
move the page.

**Scale.** Fluid `clamp()` sizes: body 16–18px, lede 19–24px, H2 36–76px, masthead 64–220px
(20.4vw on phones, capped at 15.2vw/204px from 900px). Spacing steps 4 · 8 · 12 · 16 · 24 · 32 ·
48 · 72 · 112. Container 1260px, gutter 16–44px, prose measure 66ch.

**Breakpoints.** 420 (logo text becomes screen-reader only), 600, 700/760 (cards, log columns),
900 (12-column cover), 1000 (About two columns), 1100 (three cards), 1200.

**Shapes.** Paper corners (2–3px), tape strips (clipped polygons), torn and rotated cards (±1°),
stamps with a grain mask. No glassmorphism, no gradients as decoration, one pill shape (toolbar).

**Motion.** All inside `prefers-reduced-motion: no-preference`: masthead "prints" in (clip-path),
collage pieces drop in with a spring, sections fade up once, cross-page view transitions (scan-in),
the shutter, the stamp's thump, the bell's ring. Only `transform`, `opacity`, `clip-path`. With
reduced motion everything shows its finished state.

**Interactions.**
- Drag: pointer events (mouse, pen, touch); `touch-action: none` only on the pieces, so the page
  still scrolls everywhere else; offsets ride on `translate`; a piece can't be lost off the collage.
- Stamp: a toggle button (`aria-pressed`); tap the cover to stamp; Enter on the armed button stamps
  a random spot; Escape puts it down; a live region says what happened.
- Tidy: everything back in place, stamps washed off.
- Ring: Web Audio, only on a press; the two notes his order dashboard plays.
- Shutter: theme toggle with `aria-pressed`, remembered in `localStorage` (wrapped in try/catch),
  set before first paint by the page's one inline script.
- Visiting card: Accept is a real `<a download>` to `nikhil-patil.vcf`; Decline answers in a live region.

## Search ("Nikhil Patil", only him)

- Title, H1 and first sentence say "Nikhil Patil"; title adds "Hyderabad", the strongest
  disambiguator. The About page states the full name, city, schooling and jobs in plain text.
- One Person entity: `@id https://smelloff.in/#founder` (the id smelloff.in already uses), `url` =
  this page, `image` = his portrait, `alternateName` Jogdhande Nikhil Patil, `homeLocation`
  Hyderabad, `sameAs` = his X, LinkedIn and Product Hunt. Home page: `WebSite` + `ProfilePage`
  (mainEntity Person); About: `AboutPage`; notes: `BlogPosting` by the same Person.
- smelloff.in points back: the founder schema `url`, all 97 blog bylines (`rel="author"`), the
  About page and the homepage founder strip link to `/NikhilPatil`.
- Own sitemap with the portrait as an image entry.
- "Nikhil" alone is one of the most common first names in India; no page can promise that query.
