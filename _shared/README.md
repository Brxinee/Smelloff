# Smelloff blog — shared chrome (single source of truth)

Every blog post (`/blog/*.html`) and the blog index (`/blog/index.html`) share **one**
nav, **one** end-of-post stack, and **one** footer. This folder is the canonical
reference; the live styling is centralized in **`/assets/css/blog.css`**.

No build step runs on Vercel — the shared markup is stamped into each static `.html`
file so the footer/related links exist as real `<a>` tags in the initial HTML response
(critical for SEO/crawlability). JS only enhances (progress bar, year, service worker).

## Files here
- `nav.html` — canonical sticky nav (wordmark + `BUY ₹229` pill).
- `end-of-post.html` — canonical end-of-post stack: Product CTA → optional Read Next → 3-card Related Guides grid.
- `footer.html` — canonical multi-column footer (Brand / Shop / Guides / Company + bottom bar).

## The single stylesheet
`/assets/css/blog.css` owns all tokens + component styles (nav, article typography,
callouts, CTA card, Read Next, `.guide-card` grid, footer, FAQ, focus states).
**Edit component styling there — never per-file.** Each post links it with
`<link rel="stylesheet" href="/assets/css/blog.css?v=1">`. Bump the `?v=` when you change it.

Design tokens: matte black `#080808`, acid green `#B8FF57`, body `Inter Tight`,
headings `Fraunces` (editorial serif), wordmark/eyebrows `Barlow Condensed 900`.
**Acid rule:** on dark backgrounds acid may be text; on light backgrounds (e.g. the
white `.guide-card`) acid may only be a background/border/underline — never body text.
The footer is always dark (`#080808`) on every page, even the light-themed index.

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
