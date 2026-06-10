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

## Known issues (from SEO audit, score 77/100)
1. **www vs non-www canonical conflict** — server 308-redirects `smelloff.in` → `www.smelloff.in` but all canonicals/sitemap/JSON-LD use non-www
2. **Future-dated sitemap entries** — ~10 blog URLs have lastmod dates that haven't occurred yet
3. **Blog posts have zero images** — all 50+ posts are text-only
4. **Article schema missing author** — no `Person` entity in blog post JSON-LD
5. **Only 3 product reviews** — low social proof in Product schema
6. **Blog not in site navigation** — /blog isn't linked from homepage nav
7. **No contextual internal links** in blog posts (only nav/footer links)
8. **Blog index missing ItemList schema**
9. **Homepage HTML is 302KB** — large, inline scripts

## What's working well (don't break)
- Excellent robots.txt with all AI bots allowed
- llms.txt + llms-full.txt are comprehensive
- Homepage has 8 JSON-LD schema blocks (Product, FAQPage, HowTo, Speakable, etc.)
- Security headers all set correctly on www
- Self-hosted fonts with preload
- Lazy loading on all images
- Consent-gated analytics
