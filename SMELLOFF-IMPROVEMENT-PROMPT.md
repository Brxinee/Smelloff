# Claude Code Prompt — Smelloff.in SEO & Quality Fixes

Paste this entire prompt into Claude Code to fix and improve smelloff.in.

---

## Context

You are working on **smelloff.in** — a D2C e-commerce site selling ODORSTRIKE fabric odor remover spray. The site is static HTML + vanilla JS deployed on Vercel. Read `CLAUDE.md` first for full context, then tackle the tasks below in order of priority.

Before touching any file, read it fully. The site has no build step — HTML is served directly. Changes go live on Vercel on push.

---

## TASK 1 — Fix www/non-www Canonical Conflict (CRITICAL)

**The problem:** The server 308-redirects `smelloff.in` → `www.smelloff.in`, but every `<link rel="canonical">`, sitemap URL, JSON-LD `@id`, and hreflang tag uses `https://smelloff.in/` (non-www). Google sees two versions of the site.

**The fix:** Standardize everything to `https://www.smelloff.in`.

Find and update all occurrences of `https://smelloff.in` (without www) in:
1. Every `<link rel="canonical" href="...">` tag in every HTML file
2. `sitemap.xml` — all `<loc>` tags
3. Every JSON-LD `<script type="application/ld+json">` block — `@id`, `url`, `item`, `href` fields
4. Every `hreflang` link tag

Use grep to find all files containing `https://smelloff.in` (without www), then update them. Do not touch `https://www.smelloff.in` (already correct). Do not touch the robots.txt `Disallow` paths.

After fixing, verify: grep for `https://smelloff.in/` (non-www with slash) should return zero results outside of robots.txt.

---

## TASK 2 — Fix Future-Dated Sitemap Entries (CRITICAL)

**The problem:** `sitemap.xml` has ~10+ blog entries with `lastmod` dates after today. This makes the sitemap look manipulative to Google.

Open `sitemap.xml`. For every `<url>` entry where `<lastmod>` is a future date (after today):
- If the page actually exists and is published: change `lastmod` to today's date
- If the page does not exist yet: remove the `<url>` block entirely

Check each future-dated URL with a HEAD request or by checking if the file exists in the repo before deciding.

---

## TASK 3 — Add Author Entity to All Blog Post Article Schema (HIGH)

**The problem:** Blog posts have `Article` JSON-LD but no `author` field. This is a critical E-E-A-T signal.

Find every blog post HTML file. In each one, locate the `<script type="application/ld+json">` block that contains `"@type":"Article"` and add:

```json
"author": {
  "@type": "Person",
  "name": "Brainee",
  "url": "https://www.smelloff.in/blog/why-i-built-odorstrike",
  "jobTitle": "Founder",
  "worksFor": {
    "@type": "Organization",
    "name": "Smelloff"
  }
},
"publisher": {
  "@type": "Organization",
  "name": "Smelloff",
  "logo": {
    "@type": "ImageObject",
    "url": "https://www.smelloff.in/apple-touch-icon.png"
  }
}
```

Also ensure every Article has `"datePublished"` and `"dateModified"` fields that match the post's actual publication date (you can find this in the sitemap or infer from URL slugs).

---

## TASK 4 — Add "Blog" Link to Site Navigation (HIGH)

**The problem:** The homepage (`index.html`) navigation does not link to `/blog`. Users and crawlers can't discover 50+ pages of content.

Open `index.html`. Find the `<nav>` element. Add a link to `/blog` — label it "Blog". Match the existing nav link style exactly (same class, same structure). Place it as the last nav item before any CTA button.

---

## TASK 5 — Add Contextual Internal Links to Blog Posts (HIGH)

**The problem:** Blog posts only have nav/footer links. There are no in-content contextual links to related posts or the buy page.

For each blog post, add:
1. **At least 2 contextual links** to topically related blog posts within the article body. Link naturally from relevant sentences — don't force it.
2. **1 CTA link** to the product — use anchor text like "ODORSTRIKE fabric odor spray" linking to `https://www.smelloff.in/#buy`

Prioritize these high-traffic posts first:
- `gym-clothes-smell-after-washing`
- `remove-sweat-smell-shirts-without-washing`
- `odorstrike-vs-febreze-india`
- `best-fabric-odor-spray-india-2026-body-odor`
- `deodorant-vs-fabric-mist`
- `clothes-smell-after-washing`

Related post clusters to link together:
- Gym/polyester posts → link to each other
- Febreze/comparison posts → link to each other
- Ingredient science posts → link to each other

---

## TASK 6 — Add ItemList Schema to Blog Index (MEDIUM)

**The problem:** `/blog` (blog index page) has no `CollectionPage` or `ItemList` schema.

Open the blog index HTML file. After the existing JSON-LD blocks, add:

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://www.smelloff.in/blog#collection",
  "name": "Smelloff Blog — Fabric Odor, Sweat Science & Real Fixes",
  "description": "Real talk on why clothes smell, what actually kills odor, and the science behind ODORSTRIKE.",
  "url": "https://www.smelloff.in/blog",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Smelloff",
    "url": "https://www.smelloff.in"
  },
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      // Generate ListItem entries for the top 15 posts — use position 1–15, url = canonical URL of each post
    ]
  }
}
```

Fill in the top 15 blog posts by SEO value (competitor comparisons, high-volume how-to posts first).

---

## TASK 7 — Add Open Graph Image Meta to Blog Posts (MEDIUM)

**The problem:** Blog posts don't have per-post `<meta property="og:image">` tags. When shared on WhatsApp/Instagram they show no image or fall back to the site default.

For each blog post, add in the `<head>`:
```html
<meta property="og:image" content="https://www.smelloff.in/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="[post title] | Smelloff">
<meta name="twitter:image" content="https://www.smelloff.in/assets/og-image.jpg">
<meta name="twitter:image:alt" content="[post title] | Smelloff">
```

Use the same `og-image.jpg` as the homepage for now (a product-specific image would be better later). Make sure `og:title`, `og:description`, `og:url`, and `og:type` (use `"article"`) are also present and correct on every blog post.

---

## TASK 8 — Add `datePublished` / `dateModified` to Article Schema (MEDIUM)

**The problem:** Article JSON-LD on blog posts is missing `datePublished` and `dateModified`. Google uses these for freshness ranking.

For each blog post Article schema, add:
```json
"datePublished": "YYYY-MM-DD",
"dateModified": "YYYY-MM-DD"
```

Use the `lastmod` date from `sitemap.xml` as the source of truth for both fields. If not in the sitemap, use today's date.

---

## TASK 9 — Fix Homepage `<title>` and Canonical to Use www (CRITICAL — part of Task 1)

Specifically for the homepage (`index.html`), also ensure:
- `<link rel="canonical" href="https://www.smelloff.in/">` ← note trailing slash
- `hreflang` tags: `href="https://www.smelloff.in/"` for `en-IN` and `x-default`
- All JSON-LD `"url"` and `"@id"` fields use `https://www.smelloff.in/`

---

## Execution Order

Run tasks in this order. Commit after each task with a clear message:

1. `fix: resolve www/non-www canonical conflict across all pages` (Task 1 + 9)
2. `fix: correct future-dated sitemap entries` (Task 2)
3. `seo: add author entity and publisher to all Article schema` (Task 3)
4. `feat: add Blog link to site navigation` (Task 4)
5. `seo: add contextual internal links to top blog posts` (Task 5)
6. `seo: add CollectionPage + ItemList schema to blog index` (Task 6)
7. `seo: add og:image and article meta to blog posts` (Task 7)
8. `seo: add datePublished/dateModified to Article schema` (Task 8)

## Quality checks after each task

- Validate JSON-LD: no syntax errors (check with `python3 -c "import json; json.load(open('file.html'))"` won't work on HTML — use `grep` + manual spot-check instead)
- No `https://smelloff.in` (non-www) remaining after Task 1
- Run `grep -r "https://smelloff\.in[^/]" --include="*.html" --include="*.xml" .` to catch non-www leaks

## What NOT to change

- Do not modify `robots.txt` — it is perfect
- Do not modify `llms.txt` or `llms-full.txt` — they are excellent
- Do not modify the homepage JSON-LD schema types or structure — only update URLs within them
- Do not touch the Supabase config, GA4 ID, Meta Pixel ID, or payment configuration
- Do not change the visual design, colors, fonts, or layout
- Do not add dependencies or change the deployment setup
