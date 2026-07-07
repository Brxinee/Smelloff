# Smelloff — Claude Code Context

## What this project is
Smelloff is a D2C e-commerce site selling **ODORSTRIKE** — India's first pocket-sized fabric odor remover spray (50ml, ₹229). Built as a static/SSR site deployed on Vercel. Single product, direct-to-consumer, COD-enabled, ships pan-India from Hyderabad.

## Stack
- Static HTML + vanilla JS (no framework)
- Vercel deployment
- Supabase (orders/data)
- Google Sheets webhook (order backup)
- GA4 + Meta Pixel (consent-gated)
- Self-hosted fonts (Barlow Condensed + Inter Tight)

## Site structure
- `/` — homepage (product hero, buy section, FAQ, reviews)
- `/blog` — blog index (50+ posts)
- `/blog/[slug]` — individual blog posts
- `/shipping`, `/returns`, `/refund`, `/privacy`, `/terms` — policy pages
- `/llms.txt`, `/llms-full.txt` — AI/LLM context files
- `/sitemap.xml`, `/robots.txt`, `/manifest.json`

## SEO audit status (originally 77/100 — all 9 code-fixable issues resolved as of 2026-06-10)
1. ~~www vs non-www canonical conflict~~ — **FIXED**: everything (canonicals, sitemap, JSON-LD, robots.txt Sitemap directive, llms.txt) uses `https://www.smelloff.in`
2. ~~Future-dated sitemap entries~~ — **FIXED**: all lastmod dates are valid past dates
3. ~~Blog posts have zero images~~ — **FIXED**: all posts have WebP hero images (1200×630) + og:image
4. ~~Article schema missing author~~ — **FIXED**: all posts share one rich `Person` entity (Jogdhande Nikhil Patil, Founder, worksFor Smelloff, url → founder story post)
5. **Only 3 product reviews** — needs real customers, not code; how-to-add instructions are in an HTML comment above the Product schema in index.html
6. ~~Blog not in site navigation~~ — **FIXED**: /blog linked from homepage ("All Guides" + deep links)
7. ~~No contextual internal links~~ — **FIXED**: posts cross-link contextually
8. ~~Blog index missing ItemList schema~~ — **FIXED**
9. ~~Homepage HTML was 302KB~~ — **FIXED**: main app JS (62.8KB) + scroll effects (8.5KB) externalized to `/assets/js/app.js` and `/assets/js/scroll-effects.js` (deferred); HTML now ~224KB. Consent-critical scripts (config, analytics loader, consent bar) intentionally remain inline — do not externalize them.

## What's working well (don't break)
- Excellent robots.txt with all AI bots allowed
- llms.txt + llms-full.txt are comprehensive
- Homepage has 8 JSON-LD schema blocks (Product, FAQPage, HowTo, Speakable, etc.)
- Security headers all set correctly on www
- Self-hosted fonts with preload
- Lazy loading on all images
- Consent-gated analytics
