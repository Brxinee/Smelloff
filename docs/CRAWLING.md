# Crawling, indexing and Search Console (2026-08-03)

Adding a page should be enough to get it crawled. Nobody should be hand-editing
XML, and nobody should have to remember a post-deploy step. This is how that
works and what it fixed.

```
npm run sitemap          # regenerate sitemap.xml from the filesystem
npm run sitemap:check    # dry run, exits 1 if stale (wired into npm run build)
npm run indexnow         # push URLs to Bing/Copilot/Yandex (usually automatic)
```

---

## The pipeline

| Piece | What it does | Runs when |
|---|---|---|
| `scripts/seo/build-sitemap.mjs` | Walks the repo for HTML, emits `sitemap.xml` | `npm run sitemap`; `--check` on every build |
| `robots.txt` | Points every crawler at the sitemap; allows all AI answer engines | static |
| `scripts/indexnow-ping.mjs` | Submits URLs to IndexNow | `.github/workflows/indexnow.yml` on push to `main` |
| Google | Reads `robots.txt` → sitemap on its own schedule | — |

**Google has no ping endpoint any more** — the `/ping?sitemap=` URL was retired
in 2023. For Google the levers are the sitemap being listed in `robots.txt`
(it is), lastmod being honest (now enforced), and internal linking. There is no
button that makes Google crawl faster, and anything claiming otherwise is
selling something.

---

## What the generator decides, and why

**Which pages.** Every `.html` outside `scripts/`, `docs/`, `api/`, `_shared/`,
`emails/`, `admin/`, `outreach/` and friends. A page is dropped automatically if
it carries `noindex`, if it is `404.html`, or if it is a Search Console
verification stub. So `payment-failed` and `404` exclude *themselves* — nothing
to maintain.

**The URL.** Built in exactly one function, honouring `cleanUrls: true` +
`trailingSlash: false` from `vercel.json`. `index.html` → `/`,
`solutions/index.html` → `/solutions`, `blog/foo.html` → `/blog/foo`. Because
that is the only place a URL is constructed, a trailing slash cannot ship again.

**lastmod.** The **latest** of the page's JSON-LD `dateModified`, its
`article:modified_time`, and whatever the sitemap already said — then **clamped
to today**.

- Not from git: history here was squashed, so every file reports the same date
  and the sitemap would claim the whole site changed today.
- `max()` rather than "the page wins", because several posts were edited in the
  2026-07-29 chrome pass without anyone bumping `dateModified`. Taking the page
  alone moved their lastmod *backwards*, which tells Google the page got older.
- Clamped, because six posts were carrying dates up to five weeks in the future.

**Images.** From the page's own `og:image` / `og:title` / `og:image:alt`, and
**only when that image is unique to the page**. Fifteen pages share
`/assets/og-image.jpg` as a house default; listing it fifteen times is noise,
not coverage. Uniqueness is measured at build time, so a page that gains its own
artwork starts appearing on its own.

**priority / changefreq.** A small rules table by URL shape, plus three
per-URL overrides. Both are hints Google largely ignores; they are kept because
Bing still reads them and they cost nothing.

---

## What this fixed

1. **`/solutions/` had a trailing slash** and 308-redirected. A sitemap should
   never contain a URL that redirects — Search Console files it under *Page with
   redirect* and the entry does nothing. Every one of the 42 URLs now returns
   200.
2. **Six posts had future lastmod** (up to 2026-09-09, five weeks out). Google
   discounts a future lastmod, and SEO audit item 1 in `CLAUDE.md` had been
   closed on "all lastmod dates are valid past dates".
3. **The homepage image caption still said "clothes, shoes, helmets and gear"** —
   the last survivor of the 2026-08-02 clothing-only purge. It had been removed
   from all 24 pages, `llms.txt` and `llms-full.txt`, but not from the sitemap,
   because the sitemap was hand-maintained and nobody thought to grep it.
4. **IndexNow was submitting the wrong host.** It used `www.smelloff.in` when
   the canonical is non-www. It fetched a sitemap URL that 308s, then submitted
   a `host` and a `keyLocation` that both redirect — IndexNow verifies the key
   with a direct fetch, and every URL submitted was a www URL that canonicalises
   somewhere else. The script now refuses to run if the sitemap redirects or
   contains off-host URLs.

---

## Adding a page

Create the HTML. Run `npm run sitemap`. Commit both. That is the whole
procedure — and if you forget, `npm run build` fails with `sitemap.xml is
stale`.

To keep a page **out** of the index, give it
`<meta name="robots" content="noindex">`. The generator honours it, so the page
and the sitemap can never disagree.

---

## Search Console checklist

Things worth doing in the UI, which no script can do for you:

- **Submit `https://smelloff.in/sitemap.xml` once** under Sitemaps. It only has
  to be done once; after that Google re-reads it on its own schedule.
- **Use the Domain property `smelloff.in`.** A URL-prefix property on
  `www.smelloff.in` will look like a pile of redirects, because www 301s to the
  apex. Domain property covers both.
- **Inspect and request indexing** on the canonical money URLs after a content
  pass: `https://smelloff.in/`, `/blog/remove-cooking-smell-from-clothes`,
  `/blog/hpbcd-cyclodextrin-fabric-odor`, `/blog/gym-clothes-smell-after-washing`,
  `/blog/deodorant-vs-fabric-mist`, `/blog/best-fabric-odor-spray-india-2026-body-odor`,
  `/blog/best-deodorant-spray-for-clothes-not-skin`,
  `/blog/why-clothes-smell-musty-after-being-stored`,
  `/blog/why-clothes-smell-bad-after-drying`,
  `/blog/why-polyester-holds-odor-longer-than-cotton`.
- **Ignore leftover Performance rows** on retired slugs
  (`/blog/how-to-remove-cooking-smell-from-clothes`,
  `/blog/beta-cyclodextrin-odor-removal-science`, `/blog/dri-fit-shirts-smell`,
  `/odorstrike`, www host). Those are 301s. Clicks still land. Google reports the
  requested URL for months after a move. Do not restore the old files.
- **`.html` and trailing-slash URLs now 301** (not platform 308). GSC will
  still show the old rows for a while.
- **Submit `https://smelloff.in/feed.xml` is optional.** It is for Bing /
  Perplexity / LLM fetchers, not Google Search. Google ignores `llms.txt`
  (June 2026 AI optimization guide); keep it for ChatGPT / Claude / Perplexity.
- **Ignore "Discovered – currently not indexed" on a young site.** It means
  Google knows the URL and hasn't got to it. More sitemap pings do not help;
  internal links from already-indexed pages do.
- **Watch "Duplicate, Google chose a different canonical".** That is the signal
  worth acting on — it means two of our pages compete. The `/solutions/*`
  landing pages and their matching blog posts are the pair most likely to trip
  it (monsoon and post-gym both exist twice). `/solutions` is now lower
  sitemap priority than the matching guides.

GSC 2026-09-03 (last 6 months): 442 clicks, 12.3k impressions. ~78% of query
clicks are branded (`smelloff`). Non-brand impressions cluster on cooking-smell,
cyclodextrin, dri-fit/gym, "can deodorant be used on clothes", and long
AI-overview questions about cheap fabric refreshers in India. Product snippets
show at an average position ~25 — do not add fake `aggregateRating`. Hidden
FAQ JSON-LD (questions in schema but not on the page) is now synced by
`scripts/seo/apply-gsc-aeo.mjs`.

---

## Known, not fixed

**www → apex is still a platform 308** on the bare homepage (Vercel host-level
www redirect fires before `vercel.json`). Content redirects in `vercel.json`
are 301. Google treats 308 as permanent; Domain property `smelloff.in` covers
both hosts. Do not restore www URLs.

**Product snippets stay weak without reviews.** Do not fake `aggregateRating`.
Merchant return + shipping schema is already on the homepage Product offers.

**`/odorstrike` is a 301 to `/`.** The homepage carries the unique campaign
OG image and the Product JSON-LD. Do not un-redirect `/odorstrike`.
