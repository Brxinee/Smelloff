# SEO / AEO / GEO research and pass (2026-11-02)

Owner: "improve the seo, aeo, geo, llm … research what works … need better ctr … sales and traffic".

## What the data says

Search Console export (12 months to 1 Nov 2026, web):

- 928 clicks, 43.6k impressions. Impressions doubled each month since July
  (Sep 10.8k → Oct 20.5k); clicks did not keep up (Oct 255).
- **Brand works, non-brand doesn't.** Brand queries: 1,599 impressions, 36.5% CTR.
  Non-brand (in the 1,000-query sample): 5,907 impressions, 26 clicks (0.4%).
- India is 716 of 928 clicks at 5.0% CTR. US/UK/CA see the guides (16k
  impressions) but click under 1% and can't buy (ships India only).
- Product snippets: 978 impressions at 4.9% CTR, the best non-brand CTR. Review
  snippet 17 impressions, merchant listings 2 (no Merchant Center feed live).
- Indexed pages recovered 22 → 87 after the error-1000 window; 42 "403" and 50
  "crawled, not indexed" are under validation.
- First-party beacon, 90 days: 570 search visitors, 9 from AI assistants.

Query clusters (impressions, CTR, avg position):

| Cluster | Impr | CTR | Pos | Page |
|---|---|---|---|---|
| fabric freshener / refresher / spray for clothes | 1,320 | 0.2% | 9.8 | best-fabric-odor-spray, PDP |
| can deodorant be used on clothes | 669 | 0% | 8.0 | deodorant-vs-fabric-mist |
| dri-fit / gym clothes smell after washing | 565 | 0.2% | 12.4 | gym-clothes-smell-after-washing |
| gifts for men under 500 | 477 | 0.6% | 11.0 | gifts-for-men-under-500-india |
| curry / cooking smell | 410 | 1.2% | 10.8 | remove-cooking-smell-from-clothes |
| cyclodextrin / HPβCD | 273 | 1.1% | 8.6 | hpbcd-cyclodextrin-fabric-odor |
| clothes smell after being stored | 215 | 0% | 8.7 | why-clothes-smell-musty-after-being-stored |

Live India SERPs (2 Nov): smelloff.in is #1 for "smell off" and "odorstrike
spray" (the GSC averages are worldwide and include older data). For "best fabric
freshener for clothes", Amazon and Flipkart category pages hold #1–2 and a Reddit
thread #3; our guide is #6.

## What the research says works (and what doesn't)

- **AI Overviews cut clicks, being cited softens it.** Seer Interactive (53
  brands, 5.47M queries, Jan 2025–Feb 2026): organic CTR 0.61% on AIO queries vs
  1.62% without; a cited brand gets about 120% more clicks per impression than an
  uncited one; CTR on AIO queries recovered to 2.4% by Feb 2026.
  https://www.seerinteractive.com/blog/aio-impact-on-google-ctr-2026-update
- **Titles.** Google rewrites ~61% of titles (Zyppy), least at 51–60 characters;
  brackets raise rewrites. Question titles correlate with ~14% higher CTR
  (Backlinko, correlational). Matching the searcher's exact words gets them bolded.
  https://zyppy.com/seo/google-title-rewrites/
- **Getting cited by ChatGPT / Perplexity / AI Overviews** (practitioner reports,
  r/GrowthHacking Oct 2026, r/ecommerce): be crawlable (no blocked AI bots, content
  in the HTML), be indexed in **Bing** (ChatGPT search leans on it), answer in the
  first lines, one consistent product name, honest comparison pages, and above all
  **mentions on the pages AI already cites** (Reddit threads, "best X" lists,
  marketplaces, YouTube). Schema is hygiene; **llms.txt showed no measurable effect**
  (Ahrefs: 97% of llms.txt files get zero requests).
  https://www.reddit.com/r/GrowthHacking/comments/1x5lnhw/
- **ChatGPT Shopping** now takes most product picks from merchant feeds (Profound,
  via SEJ, Jul–Sep 2026); non-Shopify merchants apply at chatgpt.com/merchants.
- **Google shipping/returns.** Since Nov 2025 any merchant can declare shipping
  (`ShippingService` under `Organization`) and returns site-wide, or set them in
  Search Console → Settings → Shipping and returns (that wins over markup). They can
  show free delivery and returns in product results and the knowledge panel.
  https://developers.google.com/search/blog/2025/11/more-ways-to-share-shipping

## Done in this pass

- `/shipping`: organization-level `ShippingService` + return policy JSON-LD,
  generated from `config/product.json` (`buildShippingServiceJsonLd`).
- Eight high-impression guides retitled to the words people type (curry smell,
  dri-fit, "after being stored", "can you use deodorant on clothes", "best fabric
  freshener… 5 types compared", "cloth deodorant"); five descriptions now answer
  first and say what the click adds. Title = H1, ≤60 characters, no new numbers.
- PDP description names the searched category ("smell remover spray for clothes")
  and COD. Product `alternateName` adds "Odor Strike" and "ODORSTRIKE spray".
- Checked: robots.txt and Cloudflare let GPTBot, OAI-SearchBot, PerplexityBot,
  ClaudeBot, Bingbot and Googlebot through (200); favicon.ico carries 48px.

## Owner actions, in order of likely sales impact

1. **Google Merchant Center**: add `https://smelloff.in/merchant-feed.xml`
   (free listings put the bottle where Amazon/Flipkart now take the top of
   "fabric freshener" searches). Then Search Console → Settings → Shipping and returns.
2. **Amazon.in listing** (marketplace pages own the commercial SERP).
3. **Reviews from real buyers**: ask the delivered customers; review stars are the
   only way to the product rich result's stars.
4. **Bing Webmaster Tools**: import the site from Search Console (one click), so
   ChatGPT search and Copilot have it; IndexNow already pings Bing on deploy.
5. **chatgpt.com/merchants**: apply; the Merchant feed fields map across.
6. **Reddit / YouTube / Instagram**: answer real threads on r/IndianFashionAddicts,
   r/india, r/HerOneBag ("best clothing refresher spray" ranks #3 in India) as the
   founder, saying so. Never fake reviews or sock-puppet accounts.
7. Re-export Search Console (Queries + Pages, last 28 days) around 1 Dec to judge
   these titles; don't retitle again before then.
