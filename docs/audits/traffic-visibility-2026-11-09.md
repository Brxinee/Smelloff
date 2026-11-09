# Traffic and visibility: Indian-language demand (2026-11-09)

Owner: "deep research and improve the traffic and visibility … go deep … then implement."

## What was checked first (and found already sound)

- **Data tools:** Ahrefs "Insufficient plan", Windsor (GA4 / Search Console) licence
  expired, so no fresh GSC export. The 2 Nov and 9 Nov audits
  (`seo-aeo-geo-2026-11.md`, `gsc-check-2026-11-09.md`) are the latest query data.
  Demand below comes from Google Trends (India, web search) and Google autocomplete
  (`gl=in`), queried 9 Nov 2026. Trends gives relative interest, not volumes.
- **Technical:** every page carries `max-image-preview:large` (Discover), `lang="en-IN"`,
  an image sitemap (236 images), a full feed and full index links. Internal links: every
  guide has at least 3 inbound links from other pages (median 5); the homepage links all
  guides. Nothing to fix there.
- **English coverage is close to saturated:** wardrobe, drying, monsoon, washing machine,
  stored clothes, after-sweating and the clothes-perfume questions all have guides.

## What the demand data says

Google Trends, India, 12 months (same comparison, relative):

| Term | Score |
|---|---|
| badbu (Roman script) | 67 |
| बदबू (Devanagari) | 15 |
| clothes smell | 4 |

The volume of smell searches in India is in **Hinglish**, then Hindi, far above English.
Most "badbu" searches are about mouth or urine odour (out of scope). The clothing-relevant
part is sweat:

| Term (anchored on "clothes smell") | Score |
|---|---|
| clothes smell | 63 |
| pasine ki badbu | 10 |
| पसीने की बदबू | 1 |
| kapdo me khushbu | 1 |

- "pasine ki badbu" draws about **a sixth** of the searches for "clothes smell". Its top
  related query is "pasine ki badbu kaise dur kare" (**+350%**); others: "aana", "ke upay",
  "se chutkara", and autocomplete adds "kyon aati hai", "ke liye sabun", "ke liye perfume",
  "gharelu upay", "doctor". Devanagari phrasing is small; Roman script is where it is.
- "clothes smell" top related queries: **"clothes smell liquid" (100, rising +90%)** and
  **"how to make clothes smell good" (27)**. Hinglish autocomplete repeats it:
  "kapdo me khushbu kaise laye / ke liye kya dale / khushbu wala liquid / khushbudar kaise
  banaye".
- Smaller Hinglish clothing long tails (Trends ~0 against "pasine ki badbu" 22):
  "washing machine se badbu kaise hataye" (6 autocomplete variants),
  "kapdo se seelan ki badbu", "barish me kapdo se badbu", "almari se badbu kaise hataye".
- Today's results for these queries are thin: laundry-service blogs, news listicles and
  uncited home-remedy posts.

## What was built

Three guides, each answer-first with question H2s, sources fetched this session, an
"Honest limits" callout, a Pexels thumbnail and inline photo checked by eye, a diagram,
the product card and llms answers. Facts only from `config/product.json`; no prices.

| Guide | Targets | Sources |
|---|---|---|
| `/blog/pasine-ki-badbu-kaise-dur-kare` (Hinglish) | pasine ki badbu kaise dur kare / kyon aati hai / ke upay / sabun / doctor | NHS Body odour (reviewed May 2025), ASM, Callewaert 2014, DermNet (lime juice + sun) |
| `/blog/how-to-make-clothes-smell-good` | how to make clothes smell good, clothes smell liquid | ACI Laundry Basics, ACI fabric softener guide, Kubota 2012, US EPA |
| `/blog/kapdo-me-khushbu-kaise-laye` (Hinglish) | kapdo me khushbu kaise laye / kya dale / khushbu wala liquid | same as above |

- The sweat guide is body-first (NHS self-care, GP triggers); the product appears only for
  the shirt, "sirf kapde par, kabhi skin par nahi", and it says the spray does not stop sweat.
  It is not an intent duplicate of `kapdon-se-pasine-ki-badbu-kaise-hataye` (clothes only):
  each links to the other.
- The English hub links out to the drying, softener, wardrobe, machine and spray guides
  rather than repeating them (round 2 had skipped "make clothes smell good" as covered by
  several posts; the query had no page of its own).
- Hub → spoke links: the smell hub's Hinglish section, the Hinglish sweat guide,
  sun-dried, all-day-fresh, vinegar/softener and deodorant-vs-antiperspirant guides.
- Not cited: Steinemann 2016 (Springer login wall, figures not verified this time).

### Round 2 (same day, owner: "continue")

| Guide | Targets | Sources |
|---|---|---|
| `/blog/washing-machine-se-badbu-kaise-hataye` (Hinglish) | washing machine se badbu kaise hataye / kyon aati hai / aaye to kya kare (6 autocomplete variants) | Furtwangen University press release on Jacksch et al. 2020 (*Moraxella osloensis* in the seal of 9 of 13 machines), Haier India maintenance page, Kubota 2012, ACI |
| `/blog/kapdo-se-seelan-ki-badbu-kaise-dur-kare` (Hinglish) | kapdo se seelan ki badbu, barish/barsat me kapdo se badbu (4 variants) | Kubota 2012, US EPA, ACI |

- The machine guide has no product card (the machine is the source, as in its English
  twin); its one product link says the spray is for worn clothes, not the machine.
- Photos rejected on sight: a Minnie Mouse T-shirt print, a laundromat brand plate, a
  tumble dryer (rare in Indian homes).
- The 2021 Jacksch paper and the Extension answer on open washer doors could not be
  fetched (403/503) and are not cited.

Blog **123**, sitemap **137**.

## Next candidates (not built)

- "almari se badbu kaise hataye" (one autocomplete variant; the khushbu and seelan guides
  already cover the wardrobe in Hinglish). Build only if the export shows demand.
- **"underarm smell"** is large in English (58 vs "pasine ki badbu" 15). The shirt side is
  covered by `why-shirt-zones-smell-after-washing`; a skin-side guide would overlap with
  `how-to-smell-good-all-day-men-india` and `deodorant-vs-antiperspirant-india`. Decide
  after the 1 Dec export shows which of those gets the impressions.

## Owner actions

1. Search Console → URL Inspection → Request indexing for the three new URLs.
2. Re-export Queries + Pages (28 days) around 1 Dec; check whether Hinglish queries
   ("pasine ki badbu", "kapdo me khushbu") start showing impressions.
3. The earlier list still stands (`seo-aeo-geo-2026-11.md`): Merchant Center feed, Bing
   Webmaster Tools import, real buyer reviews, Amazon.in, chatgpt.com/merchants.
