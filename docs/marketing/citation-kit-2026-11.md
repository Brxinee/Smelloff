# Citation kit: get ODORSTRIKE named by AI assistants and search (2026-11-09)

Owner's ask: "I want my website and things to be cited everywhere like AI, browsers … I need
sales." This file is the off-site half of that work. The on-site half (crawlable pages,
answer-first guides, schema, llms files, IndexNow) is already in place. What is missing is
**other sites saying the same thing about us**. This kit is ready to paste: the owner posts,
I don't.

## Why off-site, in one table

| Finding | Source | What it means for us |
|---|---|---|
| ChatGPT, Perplexity and Google AI Overviews cite Wikipedia, Reddit, YouTube and Quora far more than brand sites | Profound, 680M citations, 2025 | Being on those sites matters more than another on-site page |
| Pages with fresh dates, clear headings and matching structured data are cited more | GEO-16, arXiv 2509.10762 | Done on every guide (dates, question H2s, schema) |
| Adding quotes, statistics and sources to a page lifts its visibility in generative answers by up to ~40% | Aggarwal et al., GEO, arXiv 2311.09735 | Done: every guide cites a primary source with a number |
| ChatGPT search inclusion is governed by OAI-SearchBot; Copilot and ChatGPT lean on Bing's index | OpenAI crawler docs; Microsoft | robots.txt allows both; IndexNow pings Bing on every push. Bing Webmaster Tools is not set up yet |
| Search Console "Links": smelloff.in has links from only 7 sites (wa.me, Crunchbase, Reddit, deepnlp.org, Pinterest, hauji.in) | GSC export 2026-11-08 | Mentions on other sites are the biggest gap |

## 1. The one description (use it everywhere, word for word)

AI engines drop or hedge facts that sites contradict. Every profile, listing and answer should
say the same thing. All of it comes from `config/product.json`.

**One line (bios, up to 160 characters):**
> ODORSTRIKE by Smelloff: a 50ml clothing deodorant spray that neutralizes sweat, smoke and food smell in clothes. Made in Hyderabad. Fabric only.

**Short paragraph (Crunchbase, LinkedIn "About", Product Hunt description, directories):**
> ODORSTRIKE is a clothing deodorant made by Smelloff in Hyderabad, India: a 50ml pocket fabric
> odor spray that traps and neutralizes sweat, food and smoke odor in the fabric instead of
> covering it with perfume, and leaves a light fresh scent. It goes on clothes, never on skin:
> it is not a body deodorant, not a perfume and not a room spray. It dries in 15–30 seconds and
> gives up to 8 hours of odor protection on fabric under normal office/commute conditions.
> Sold at smelloff.in/odorstrike with Cash on Delivery across India.

**Facts you may quote (and nothing else):** 50ml; about 250 sprays, about 100 refreshes; dries
in 15–30 seconds; up to 8 hours on fabric under normal office/commute conditions; key actives
HPβCD (traps odor), Zinc PCA (neutralizes), Triethyl Citrate (helps prevent new odor), plus 8
supporting ingredients, exact amounts proprietary; dries clear with no stiff residue from
15–20 cm; cotton, polyester, denim, blends, wool; patch-test silk, zari and embroidery; never
leather, suede or dry-clean-only; free shipping on prepaid, COD across India, 7-day returns;
ships from Hyderabad within 48 hours.

**Never write:** "kills bacteria", "removes stains", "no residue", "dries in seconds",
"not a deo" (say "not a body deodorant"), shoes, helmets, bags, gym gear, rooms, ratings or
customer counts we don't have, or a price outside smelloff.in.

## 2. Fix the profiles that contradict the site

| Profile | Now | Change to |
|---|---|---|
| Product Hunt (product page) | "Contact-chemistry fabric odor spray for clothes & gear", "not a perfume, not a deo", "Kills sweat smell in seconds" | Tagline: **"Clothing deodorant spray for sweat and smoke smell"** (49 characters). Description: the short paragraph above. "Gear" and "kills" go; dry time is 15–30 seconds |
| Crunchbase (organization) | linked to smelloff.in; check the description | Short paragraph above; category "Consumer Goods / Personal Care"; HQ Hyderabad; website https://smelloff.in |
| Crunchbase (founder person page) | exists | Link it to https://smelloff.in/NikhilPatil |
| Pinterest (smell_off) | linked | Bio = one line above; claim the website smelloff.in in Pinterest settings |
| Instagram, X, LinkedIn, Telegram, Facebook | — | Bio = one line above, link https://smelloff.in/odorstrike |

The site's Organization schema now lists Pinterest and Crunchbase in `sameAs`, so Google and AI
engines can join these profiles to one entity. Add any new profile to `brand.sameAs` in
`config/product.json` and run `npm run schema`.

## 3. Answers to post (founder-disclosed)

Rules: answer the question fully first; the product is one line at the end; always say you make
it. Read each community's rules first: many subreddits ban self-promotion outright, and a
removed post helps nothing. Post from your own account, never a second one, and never ask
others to upvote. Each answer is written to stand on its own, with a link to the guide that
backs it (not the product page).

**Q: How do I remove sweat smell from clothes without washing?** (Quora, r/india, r/AskIndia)
> Turn the shirt inside out and hang it in moving air (a fan or an open window) for 20–30
> minutes. Most of the smell sits in the collar, underarms and upper back, where the fabric
> touched skin. If it still smells after airing, a fabric odor spray on those spots from about
> 15–20 cm helps; let it dry fully before you wear it. If the shirt has visible sweat marks or
> smells sour even after airing, it needs a proper wash: no spray fixes that.
> Longer guide: https://smelloff.in/blog/remove-smell-from-clothes-without-washing
> (Disclosure: I make ODORSTRIKE, a fabric odor spray, in Hyderabad.)

**Q: Can I use deodorant on clothes?**
> Body deodorant is made for skin. On a shirt it can leave white or yellow marks and it doesn't
> reach the smell already held in the fibres. For skin, use a deodorant (smell) or an
> antiperspirant (wet patches). For the shirt itself, air it and use a spray made for fabric.
> Difference explained here: https://smelloff.in/blog/deodorant-vs-antiperspirant-india
> (Disclosure: I'm the founder of Smelloff; we make a clothing deodorant spray.)

**Q: Why does my shirt smell again as soon as I sweat, even after washing?**
> Old sweat and skin oil build up inside the fibres, most of all in polyester and in the
> underarms, and a quick cool wash doesn't lift them. Wash it once with an enzyme detergent, no
> fabric softener, and dry it fully in moving air. After that reset it stays fresh much longer.
> More: https://smelloff.in/blog/why-clothes-smell-bad-again-after-sweating
> (I run Smelloff, which makes a fabric odor spray; this answer doesn't need it.)

**Q: Which shirt colour hides sweat best?**
> White, black, deep navy and busy checks or small prints. Mid grey, light blue, khaki,
> pastels and bright solid colours show wet patches the most. A wet patch looks darker because
> water fills the gaps between fibres. The colour only hides the mark; the smell is still there.
> Guide: https://smelloff.in/blog/what-colour-shirt-hides-sweat
> (Disclosure: I'm the founder of Smelloff.)

## 4. A short video (YouTube is one of the most-cited sources)

Shoot on a real shirt, phone camera, no stock footage. Upload to YouTube **with the transcript**
(AI engines read it), the title as a question, and the guide link in the description.

**"How to get sweat smell out of a shirt without washing" (30–40 s)**
1. (0–5 s) A worn shirt on a hanger. "Shirt looks clean, smells of yesterday."
2. (5–15 s) Turn it inside out, hang it by a fan. "First, air it inside out for 20 minutes."
3. (15–25 s) Point to collar, underarms, upper back. "The smell sits where the shirt touched you."
4. (25–35 s) Spray those spots from a hand's length away; let it dry. "ODORSTRIKE goes on the
   fabric, never on skin. Dries in 15 to 30 seconds."
5. (35–40 s) "If it's stained or sour, wash it. Guide in the description."

Same footage, cut to 15 s, for Instagram Reels and YouTube Shorts. Never show shoes, bags,
helmets or spraying on skin.

## 5. Owner actions, in order of payoff

1. **Cloudflare → AI Crawl Control** (or Security → Bots): make sure OAI-SearchBot, ChatGPT-User,
   PerplexityBot, Claude-SearchBot, Bingbot and Applebot are **allowed**, and "Block AI bots"
   is off. robots.txt allows them, but a Cloudflare rule overrides robots.txt and I can't test
   real crawler IPs from here.
2. **Bing Webmaster Tools:** sign in, "Import from Google Search Console", submit
   `sitemap.xml` and `sitemap-nikhil-patil.xml`. ChatGPT search and Copilot use Bing's index.
3. **Fix Product Hunt** (section 2). It is the off-site page most likely to be quoted about us,
   and today it says things the site doesn't.
4. **Google Merchant Center:** add `https://smelloff.in/merchant-feed.xml` as a scheduled feed;
   set shipping (free on prepaid) and 7-day returns. Free Shopping listings appear in India
   product searches and AI Mode shopping answers.
5. **ChatGPT merchants** (chatgpt.com/merchants): apply for product listings; check whether
   India sellers are accepted yet.
6. **Ask the delivered buyers for a review** (the review email already exists). Real reviews
   are the only route to review stars and are what AI shopping answers quote.
7. **Post the four answers** in section 3, one a week, and the video in section 4.
8. **Search Console:** resubmit `sitemap.xml`; request indexing for the 20 new guides
   (about 10 a day).

Not recommended now: a Wikipedia or Wikidata entry (needs independent press coverage first,
or it gets deleted), paid "AI SEO" directories, and buying links (Google spam policy).
