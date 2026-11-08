# India sales pass (2026-11-08)

Owner: "I want sales from my website … my product should stand out and tell
exactly what's needed … go deep: Reddit, competitors, Notion … from only India."

## What the data says
- **Search Console, last 3 months** (export 8 Nov): India 423 clicks / 14,283
  impressions; US 82 / 10,033; UK 37 / 4,373. Brand queries 286 clicks from 689
  impressions; non-brand 31 clicks from 6,141 (0.5%). Most non-brand traffic
  lands on guides; the product page has 1,072 impressions at position 10.
- **Notion (Positioning, SEO & Sales Growth Playbook, 7–8 Nov):** "turn relevant
  impressions into clicks, clicks into purchases"; put a product demonstration
  and contextual ODORSTRIKE link near the answer in guides, not only at the
  bottom; the product page must answer what it is, does it work, is it
  convenient, can I trust it, is buying easy.
- **Notion (Product Development & Website Update Brief, 31 Oct):** best-fit
  occasions are environmental odor on clothes between washes (commute, smoke,
  food/cooking, travel, long workday); treat heavy sweat saturation and
  rebloom as wash problems; the page should be built around customer jobs.
- **Reddit:** reddit.com is blocked for every fetch and search tool in this
  environment (8 Nov), so no new threads were read. The Notion brief's two
  passes (100+ r/bodyodor threads; 14 cross-community threads incl.
  r/hyderabad's 25 km commute in "sweat, smoke and dust") and the 1 Nov pass in
  CLAUDE.md (r/laundry, r/CleaningTips, r/HerOneBag, r/IndianFood,
  r/DesiFragranceAddicts) are the Reddit evidence used.
- **Google autocomplete, India (8 Nov):** "clothes smell remover spray",
  "spray for clothes to remove odor", "spray for clothes to smell fresh",
  "deodorant spray for clothes", "body spray on clothes or skin", "clothes
  perfume spray / for men", "odour spray for clothes", "kapdo se badbu nikalne
  ka tarika", "pasine ki badbu kaise hataye". The biggest family by far is
  "clothes smell after washing", which is a laundry problem.
- **Competitors (Flipkart search, 8 Nov; Amazon.in returned 503):** odor
  sprays sold as "Fabric Deodorizer / Fabric Freshener / Wardrobe Odour
  Eliminator", 200–500 ml, ₹165–376 against MRPs of ₹590–1,499, ratings 3–4.1
  from 2–228 reviews. **None is pocket size** (smallest odor spray 200 ml), none
  shows a demo, none explains neutralising vs masking. Per ml they cost
  ₹0.64–1.20 against ODORSTRIKE's ₹4.58, so ODORSTRIKE has to win on the job
  (a pocket spray for the clothes you're wearing, that neutralises instead of
  perfuming), not on price per ml. Earlier passes: the pocket rival is the
  ₹149–282 clothes perfume spray (docs/audits/competitor-conversion-2026-10.md).

## What was built
1. **Product card in the guides** (where the traffic is): right after the quick
   answer, no price, the job + Indian occasions + COD / free prepaid shipping /
   48 h dispatch from Hyderabad, one link to /odorstrike. Skipped on posts whose
   honest answer is "wash it" and on posts already about the product.
2. **Product page:** a "When to reach for it" strip of Indian everyday
   occasions and "What happens after you order" steps for first-time / COD
   buyers, both below the fold (the hero and Buy position are unchanged).
3. **India only:** visitors whose device isn't on India time see "We deliver
   within India only." beside the buy routes; Indian visitors see no change.

## Not built, owner's call (bigger levers than any page change)
- COD charge ₹89–179 on a ₹229 product (peers ₹0–49; ~62% of Indian first-time
  buyers prefer COD).
- Google Merchant Center free listings with `merchant-feed.xml` (India
  Shopping results).
- Amazon.in listing (Notion's phase 2).
- Real verified-buyer reviews (the only route to review stars) and a short
  demonstration video on a real shirt.
- `META_CAPI_TOKEN` (Meta gets no server Purchase; blocks the ₹5,000 test).
- Product-page title wording: Notion's 7 Nov playbook suggests "Fabric Odor
  Spray for Clothes"; the 20 Oct decision is "clothing deodorant". Both phrases
  are searched in India.
- The dose and "spray on the clothes you're wearing" vs "hold the garment away"
  instruction, against the label (Notion tasks #8, #25).
