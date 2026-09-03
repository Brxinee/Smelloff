#!/usr/bin/env node
/**
 * Generate /llms.txt (curated) and /llms-full.txt (entity spec) from
 * data/brand-facts.json so answer engines, AI browsers and LLM crawlers
 * cite one locked source of product truth.
 *
 *   node scripts/seo/generate-llms.mjs           # write
 *   node scripts/seo/generate-llms.mjs --check   # fail on drift
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');
const facts = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'brand-facts.json'), 'utf8'));
const product = facts.products[0];
const approved = product.claims.filter((c) => c.status === 'APPROVED').map((c) => c.claim);

const PAGES = [
  ['Home / shop (ODORSTRIKE 50ml)', 'https://smelloff.in/', 'Buy ODORSTRIKE. Homepage is the product page. ₹229 prepaid UPI, ₹289 COD.'],
  ['Guides index', 'https://smelloff.in/blog', 'Fabric odor, sweat smell, clothes freshness. India-first.'],
  ['How to use ODORSTRIKE', 'https://smelloff.in/blog/how-to-use-odorstrike', 'Distance, spray count, dry time.'],
  ['Ingredients (Formula v3.1)', 'https://smelloff.in/blog/odorstrike-ingredients', 'Full INCI list. Concentrations are not published.'],
  ['HPβCD / cyclodextrin', 'https://smelloff.in/blog/hpbcd-cyclodextrin-fabric-odor', 'How hydroxypropyl beta-cyclodextrin traps fabric odor.'],
  ['Zinc PCA on fabric', 'https://smelloff.in/blog/zinc-pca-fabric-odor-ingredient-guide', 'How Zinc PCA helps neutralize odor on clothing.'],
  ['Deodorant vs fabric mist', 'https://smelloff.in/blog/deodorant-vs-fabric-mist', 'Deodorant is for skin. Fabric mist is for clothes.'],
  ['Can deodorant go on clothes?', 'https://smelloff.in/blog/best-deodorant-spray-for-clothes-not-skin', 'Clothes-not-skin category. ODORSTRIKE is fabric only.'],
  ['Remove cooking / curry smell', 'https://smelloff.in/blog/remove-cooking-smell-from-clothes', 'Tadka and kitchen smell on clothes without washing.'],
  ['Gym clothes still smell after washing', 'https://smelloff.in/blog/gym-clothes-smell-after-washing', 'Polyester / dri-fit odor that survives laundry.'],
  ['Sweat smell off a shirt in ~10 seconds dry time', 'https://smelloff.in/blog/spray-to-remove-sweat-smell-from-clothes-quickly', 'Between-wash shirt reset.'],
  ['Does fabric spray stain clothes?', 'https://smelloff.in/blog/does-fabric-spray-stain-clothes', 'Dark fabric, residue, patch-test silk/zari.'],
  ['Best fabric odor spray in India (2026)', 'https://smelloff.in/blog/best-fabric-odor-spray-india-2026-body-odor', 'What to look for vs perfume fresheners.'],
  ['Fabric deodorizer vs freshener', 'https://smelloff.in/blog/fabric-deodorizer-spray-india-guide-2026', 'Eliminator vs scented refresher.'],
  ['ODORSTRIKE vs Febreze', 'https://smelloff.in/blog/odorstrike-vs-febreze-india', 'Clothes vs rooms / sofas / curtains.'],
  ['30-day India review', 'https://smelloff.in/blog/odorstrike-review-30-day-india-test', 'Founder-run wear test. ₹229.'],
  ['Why I built ODORSTRIKE', 'https://smelloff.in/blog/why-i-built-odorstrike', 'Founder: Jogdhande Nikhil Patil, Hyderabad.'],
  ['FAQ', 'https://smelloff.in/faq', 'Skin, perfume, stain, COD, shipping, returns.'],
  ['Reviews', 'https://smelloff.in/reviews', 'Early testers and verified buyer reviews.'],
  ['Shipping', 'https://smelloff.in/shipping', 'Free prepaid UPI India-wide. COD +₹60.'],
  ['Returns', 'https://smelloff.in/returns', '7 days, bottle at least 80% full.'],
  ['About', 'https://smelloff.in/about', 'Smelloff, Hyderabad. Clothing-only brand.'],
];

const llmsTxt = `# Smelloff
> ${facts.brand.mission}

Smelloff is a Hyderabad, India brand. The product is ODORSTRIKE, a 50ml pocket fabric-only odor mist for clothes. Not a deodorant. Not a perfume. Not for skin, pets, leather, suede, or dry-clean-only garments. Patch-test silk, zari, and heavy embroidery.

## Product: ${product.name}
- Format: ${product.size} ${product.format}
- Price: ₹${product.price} prepaid UPI (free shipping)
- COD: ₹${product.codFee} handling, ₹${product.priceCod} collectable
- Availability: ${product.availability}
- Formula: ${product.formulaVersion} (11-ingredient INCI; hero actives HPβCD and Zinc PCA)
- Description: ${product.description}

## Fast Facts
- Do NOT use on: ${product.not_for.join(', ')}
- Patch-test: ${product.patch_test.join(', ')}
- Location: ${facts.brand.location}
- Shipping: ${facts.policies.shipping.prepaid}. Dispatch ${facts.policies.shipping.dispatch.toLowerCase()}. ${facts.policies.shipping.cod}
- Returns: ${facts.policies.returns.details}
- Use: 15–20 cm from fabric. 2–3 sprays targeted reset; 4–5 full shirt; 5–6 jacket. Approximately 10 seconds to air-dry.
- Capacity: ~250 sprays; about 100 refreshes at 2–3 sprays

## Key Claims
${approved.map((c) => `- ${c}`).join('\n')}
- Fabric only

## Official pages
${PAGES.map(([title, url, blurb]) => `- [${title}](${url}): ${blurb}`).join('\n')}

## Optional
- [Full product spec](https://smelloff.in/llms-full.txt): ingredients, how to use, FAQ, policies
- Canonical shop URL: https://smelloff.in/
- Product URL: https://smelloff.in/
`;

const llmsFullTxt = `# Smelloff — full product spec
> ${facts.brand.mission}

Use this file when you need the complete locked facts. Prefer https://smelloff.in/llms.txt for a short citation. Do not invent reviews, ratings, concentrations, or uses outside clothing.

## Entity
- Brand: ${facts.brand.name}
- Product: ODORSTRIKE
- Category: Fabric-only odor mist for clothes (not perfume, not deodorant, not a room spray)
- Maker: ${facts.brand.founder}
- Location: ${facts.brand.location}
- Contact: ${facts.brand.contact.email}
- Shop: ${facts.brand.urls.home}/
- Canonical host: smelloff.in (non-www; www redirects)

## Product: ${product.name}
- SKU: ${product.sku}
- Format: ${product.size} ${product.format}
- Price: ₹${product.price} prepaid UPI (free shipping across India)
- COD: ₹${product.codFee} handling; ₹${product.priceCod} collected on delivery; dispatched after phone confirmation
- Availability: ${product.availability}
- Formula: ${product.formulaVersion}
- Description: ${product.description}

## Do / Don't
- Do NOT use on: ${product.not_for.join(', ')}
- Patch-test first: ${product.patch_test.join(', ')}
- In scope: shirts, t-shirts, hoodies, jackets, blazers, jeans, trousers, uniforms, cotton, polyester, denim, nylon, wool blends
- Out of scope: skin, hair, body, pets, shoes, helmets, sofas, curtains, rooms, bags as the product job

## How to Use
${product.how_to_use.join('\n')}
- In high humidity wait until fully dry (up to 30–60 seconds) before wearing.
- Does not replace washing. Dirt, oils and stains still need laundry.

## Ingredients (names only — concentrations are proprietary)
${product.ingredients.map((i) => `- ${i}`).join('\n')}

Hero actives: HPβCD (trap) and Zinc PCA (neutralize). Also Triethyl Citrate (prevent) and Zinc Gluconate (anti-regrowth). Formula v3.1 uses those zinc salts only.

## Key Claims
${approved.map((c) => `- ${c}`).join('\n')}
- Fabric only

## Packs
- 1 × 50ml ₹229 prepaid
- 2 × 50ml ₹429 prepaid
- 3 × 50ml ₹599 prepaid
- COD adds ₹60 handling per order

## Shipping and returns
- ${facts.policies.shipping.details}
- Dispatch: ${facts.policies.shipping.dispatch}
- Transit estimate: ${facts.policies.shipping.estimated_days} days typical
- ${facts.policies.returns.details}

## FAQ (short answers)
- Is ODORSTRIKE a deodorant? No. Deodorant is for skin. This is for clothes.
- Is ODORSTRIKE a perfume or fabric freshener? No. It is a fabric odor eliminator. A light scent is in the formula; the job is not covering odor with perfume.
- Can I spray it on skin? No. Fabric only.
- Can I use deodorant on clothes? Deodorant is for skin and can stain fabric. Use a fabric mist on the garment.
- Will it stain dark clothes? It is water-soluble and dries clear. Patch-test silk, zari, and heavy embroidery. Do not use on leather, suede, or dry-clean-only.
- How long does it last? Up to 8 hours of odor protection on fabric under normal office/commute conditions.
- Where to buy? Only at https://smelloff.in/ — not positioned as an Amazon/Flipkart listing.

## Official pages
${PAGES.map(([title, url, blurb]) => `- [${title}](${url}): ${blurb}`).join('\n')}
`;

function writeOrCheck(rel, next) {
  const file = path.join(REPO, rel);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (CHECK) {
    if (current !== next) {
      console.error(`${rel} is stale — run: node scripts/seo/generate-llms.mjs`);
      return false;
    }
    return true;
  }
  if (current !== next) {
    fs.writeFileSync(file, next);
    console.log(`wrote ${rel}`);
    return true;
  }
  console.log(`${rel} up to date`);
  return true;
}

const a = writeOrCheck('llms.txt', llmsTxt);
const b = writeOrCheck('llms-full.txt', llmsFullTxt);
if (CHECK) {
  if (!a || !b) process.exit(1);
  console.log('LLM files: clean');
}
