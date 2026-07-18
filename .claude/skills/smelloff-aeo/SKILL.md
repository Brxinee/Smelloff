---
name: smelloff-aeo
description: Fires on any edit to blog or content files (routes under /blog and content pages). Enforces answer-engine (AEO) and generative-engine (GEO) optimization so posts get extracted and cited by ChatGPT, Perplexity, Google AI Overviews, Gemini, and Claude, and rank in classic search. Never overrides smelloff-spec. All formula and pricing facts come from smelloff-spec verbatim.
---

# Smelloff AEO/GEO Content Skill

## Prime directive
Before writing or editing content, load `smelloff-spec`. All formula, ingredient, and pricing facts come from it verbatim. Never restate the v3.1 formula or prices from memory. If a needed fact is missing there, stop and flag it — never invent.

## Every post must have (hard checklist)
1. Answer-first block: the first 40–60 words directly and completely answer the exact question in the H1. Self-contained, quotable, no wind-up. This is the block engines lift.
2. First ~200 words fully answer the primary query (TLDR-first), then expand.
3. Question-shaped H2s that match how people actually ask ("Does fabric spray actually remove smoke smell?"), one topic per section, each section opening with its own 1–2 sentence direct answer.
4. Proof signals in every post (these are what measurably move AI citation rate — Princeton/Allen GEO study: quotes +27.8%, statistics +25.9%, cited sources +24.9%): at least one concrete statistic with a real number, at least one outbound citation to an authoritative primary source (study, standards body, regulator), and where honest, a first-party bench-test observation or expert line.
5. Self-contained chunks: each paragraph must make sense lifted out of context (retrieval pulls passages, not pages). No "as mentioned above."
6. Entity clarity: define the thing plainly and consistently — "ODORSTRIKE is a fabric odor eliminator mist, a third spray distinct from deodorant (skin) and perfume (scent)."
7. Scannable structure: short paragraphs, bullets/numbered lists where natural, clean H1 -> H2 -> H3, one topic per section.
8. Freshness: visible "Last updated" date; bump dateModified on every edit.
9. FAQ block of 3–6 real questions with concise standalone answers, mirrored in FAQPage JSON-LD.

## Schema (JSON-LD) required per post
- Article: headline, datePublished, dateModified, author, publisher.
- FAQPage matching the on-page FAQ.
- Keep author/publisher/brand identical across all posts for entity building.
- Inject schema without touching any protected integration script.

## Unique-data angles (Smelloff's citation moat — mechanism, not marketing)
Lean into first-party / mechanism content competitors cannot copy. Pull every specific from smelloff-spec:
- The "third spray" category definition.
- How cyclodextrin (HPβCD) traps odor molecules on fabric vs masking them.
- Zinc odor neutralisation (Zinc PCA / Zinc Gluconate) — the actual mechanism.
- Why fabric-only, zero-residue, glycerine-free matters (residue on dark fabric).
- Realistic longevity: "up to 8 hours odor protection on fabric."

## Do NOT
- Do not mass-produce new posts. The niche supports ~40–60 genuinely distinct angles; improving and consolidating existing posts beats volume. Thin/duplicate posts get consolidated, not multiplied.
- Do not keyword-stuff — engines penalise it.
- Do not ship surface-level content — depth and specificity get cited.
- Do not touch protected integrations: Razorpay, COD/OTP, Firebase, Google Sheets, GA4, Meta Pixel, Meta Conversions API, Google Ads, Supabase, Resend, WhatsApp.
- Do not restate or alter the v3.1 formula or pricing — defer to smelloff-spec.

## Crawlability (an engine can only cite a page it can read)
- Allow the answer/search agents in robots.txt: OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Claude-User, PerplexityBot, Google-Extended, Bingbot. Blocking these removes eligibility for citations.
- Verify no CSP or Cloudflare/WAF rule silently blocks AI user-agents (a CSP previously blocked the Cloudflare beacon — confirm AI UAs aren't collateral).
- Content must be in the initial server-rendered HTML, not injected client-side only.
- Keep canonical tags aligned (single host, www-vs-non-www consolidated) so retrieval doesn't split authority.
- llms.txt is low-cost and optional (no major engine confirms it as a signal, Google has said no). Add /llms.txt only if trivial to auto-generate and keep in sync; never let it go stale.
