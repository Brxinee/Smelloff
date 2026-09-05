# Smelloff blog — shared chrome & editorial architecture

Every blog post (`/blog/*.html`) and the blog index (`/blog/index.html`) share the site's unified chrome (`.sf-hdr`, `.sf-ftr`) and canonical article presentation (`.article-wrap`).

## Architectural Separation of Concerns
- **`/assets/css/chrome.css`**: Canonical source of truth for all shared site chrome (global sticky header `.sf-hdr`, navigation, cart, hamburger drawer, skip link, and multi-column footer `.sf-ftr`).
- **`/assets/css/blog.css`**: Canonical source of truth for blog and article editorial typography, reading progress bar, hero, prose rhythms, tables, callouts, quick-answer blocks, FAQ accordions, and related guides grids.

No shared header/footer chrome is duplicated inside `blog.css`.

## Files here
- `nav.html` — canonical header reference markup (`.sf-hdr`).
- `end-of-post.html` — canonical end-of-post stack: Product CTA → optional Read Next → 3-card Related Guides grid.
- `footer.html` — canonical multi-column footer reference markup (`.sf-ftr`).

## Stylesheets
Shared chrome styling is defined once in `/assets/css/chrome.css`.
Article layout and prose styling are defined in `/assets/css/blog.css`.
Design tokens: matte black `#080808`, acid green `#B8FF57`, body `DM Sans`, headings `Fraunces`, monospace/eyebrows `JetBrains Mono`.

## Add a new post
1. Copy an existing post (e.g. `deodorant-vs-fabric-mist.html`) as your template.
2. Replace the `<head>` SEO block, article header, and article body with your content.
   Keep `<link rel="stylesheet" href="/assets/css/blog.css?v=1">` in `<head>`.
   Do **not** re-add an inline component `<style>` block — use blog.css. (A small inline
   `<style>` is only for genuinely post-specific body widgets, e.g. a custom timer/table.)
3. Keep the canonical nav (`nav.html`), end-of-post stack (`end-of-post.html`) and
   footer (`footer.html`) exactly. In the stack, only edit:
   - the CTA `.cta-spec` line (one-line product spec for this post),
   - the optional Read Next target (omit the whole `<section class="read-next">` if none),
   - the **3** `.guide-card` links — pick 3 topically-relevant neighbours.
4. Add the post to `/blog/index.html` (guide grid + `ItemList` schema) and `/sitemap.xml`.

## Re-standardizing existing posts
`scripts/standardize_blog.py` restamps every post from its current content. It is
**guarded against re-runs** (skips any post that already has `.related-guides`) so it
won't clobber curated links. To re-standardize a post from scratch, revert it first.
