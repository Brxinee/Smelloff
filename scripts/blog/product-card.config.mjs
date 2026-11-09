/* In-article product card: what it says and which posts get it.
   Stamped by scripts/blog/apply-reader.mjs right after each post's quick
   answer, between <!-- PCARD:START --> / <!-- PCARD:END --> markers.

   Why it exists: most search visitors land on a guide, and the product only
   appeared at the end of each post. The card names it once, near the top,
   and links to /odorstrike (never checkout, never a price).

   Rules (CLAUDE.md): no price, MRP, pack or per-use amount anywhere in the
   card (only / and /odorstrike show prices); facts only from
   config/product.json; clothing only; no urgency, ratings or reviews.
   "Use it when" lines stay with sweat, smoke, food/cooking smell and
   everyday between-wash freshness.

   Edit this file, then run `node scripts/blog/apply-reader.mjs`. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'config', 'product.json'), 'utf8'));
const { brand, product, shipping } = CFG;

/* Posts that get NO card, with the reason. Two kinds: posts whose own answer
   is "a spray is not the fix", and posts already about the product (a card
   would repeat them). */
export const SKIP = {
  // Already about the product.
  'how-to-use-odorstrike': 'the post is the product\'s own instructions',
  'odorstrike-ingredients': 'the post is the product\'s own ingredient page',
  'odorstrike-review-30-day-india-test': 'the post is the founder\'s test of the product',
  'odorstrike-vs-febreze-india': 'head-to-head product comparison; the product is the subject',
  'ambi-pur-vs-odorstrike': 'head-to-head product comparison; the product is the subject',
  'why-i-built-odorstrike': 'the founder\'s story of the product',
  'where-to-buy-odorstrike-india': 'the post already answers where and how to buy it',
  // The post's own conclusion: a spray is not the fix.
  'new-clothes-chemical-smell-wash-before-wearing': 'finishing chemicals: the answer is to wash before wearing',
  'remove-perfume-smell-from-clothes': 'the answer is airing and a wash; it warns against spraying more on top',
  'clothes-left-in-washing-machine-overnight-smell': 'says outright that a spray cannot fix a sour wet load',
  'why-washing-machine-makes-clothes-smell': 'the machine is the source; the fix is cleaning the machine',
  'why-shirt-zones-smell-after-washing': 'smell that survives a wash: the answer is a better wash; it calls a mist a narrow stopgap',
  'vinegar-baking-soda-fabric-softener': 'laundry additives; its answer to sweat odor is a proper wash',
  'dry-air-clothes-indian-home': 'a drying routine; a spray plays no part in it',
  // 2026-11-09 series.
  'dry-cleaned-clothes-chemical-smell': "dry-cleaning solvent smell: the answer is airing or a return to the cleaner, and dry-clean-only clothes must never be sprayed",
  'coconut-hair-oil-smell-on-clothes': "oil needs detergent; a spray cannot lift oil out of fibres",
  'petrol-smell-out-of-clothes': "petrol and diesel are fire risks; the answer is airing outdoors and a separate wash",
};

/* "Use it when" per topic cluster (CLUSTERS in apply-reader.mjs). */
export const CLUSTER_LINES = {
  sweat: 'a hot commute has reached your collar and underarms before the first meeting.',
  fabric: 'a shirt, kurta or pair of jeans looks clean but holds a little of yesterday\'s sweat.',
  laundry: 'a clean, dry shirt or kurta has to be worn again before wash day.',
  smells: 'tadka from the kitchen or smoke from a function has followed you out in your clothes.',
  refresh: 'the office shirt or kurta has to go again tomorrow and wash day is still days away.',
  category: 'deodorant has done its job on your skin, but the shirt smells by afternoon.',
  buying: 'your shirt smells of sweat by lunch and you can\'t change it.',
  product: 'a shirt you can\'t wash today smells of sweat, food or smoke.',
  everyday: 'a hot commute and a long day mean one shirt has to stay fresh till evening.',
};

/* Per-post lines where the cluster line would read wrong. A string is the
   text after "Use it when"; an object can change the lead-in too. */
export const SLUG_LINES = {
  // smells
  'remove-cooking-smell-from-clothes': 'the tadka from the kitchen has followed you to office.',
  'remove-cigarette-smoke-smell-from-clothes': 'a smoky party or a smoker\'s company has left the smell on your shirt.',
  'remove-incense-agarbatti-dhoop-smell': 'agarbatti or dhoop smoke from the puja is still in a clean, dry kurta.',
  'firecracker-smoke-smell-out-of-clothes-diwali': 'Diwali cracker smoke has come indoors with you in your kurta.',
  'why-traffic-fumes-cling-to-clothes': 'a ride through traffic in the heat has left sweat and smoke in your shirt.',
  'remove-smell-from-blazer-without-dry-cleaning': 'a restaurant dinner or a smoky function has come home in your jacket lining.',
  'dog-smell-on-clothes': 'a clean, dry shirt or kurta has to be worn again before wash day.',
  'remove-smell-from-thrifted-clothes': 'a jacket or blazer you can\'t wash often needs freshening between wears.',
  // refresh
  'remove-smell-from-saree-and-blouse-without-washing': 'a blouse has to be worn again before it can be washed.',
  'remove-smell-from-winter-jacket-without-washing': 'a winter jacket you can\'t wash every week smells of sweat or smoke.',
  'remove-sweat-smell-from-cap': 'a cap\'s sweatband smells after a hot commute.',
  'wedding-festive-wear-odor-guide': 'a sherwani or kurta from one function has to go to the next. Patch-test silk and zari first.',
  'keep-clothes-fresh-while-travelling': 'a shirt has to do a second day on a trip with no laundry.',
  'kapdon-se-pasine-ki-badbu-kaise-hataye': { lead: 'Kaam aata hai jab', text: 'office shirt ya kurta dobara pehenna ho aur dhone ka time na ho.' },
  'pasine-ki-badbu-kaise-dur-kare': { lead: "Kaam aata hai jab", text: "garam din aur lambe commute ke baad shirt ko shaam tak fresh rehna ho." },
  'how-to-make-clothes-smell-good': "a clean shirt has to stay fresh through a long, hot day.",
  'kapdo-me-khushbu-kaise-laye': { lead: "Kaam aata hai jab", text: "saaf shirt ko lambe, garam din tak fresh rehna ho." },
  // fabric / laundry
  'gym-clothes-smell-after-washing': 'a washed tee is clean but its underarms still smell once you warm up.',
  'does-food-change-sweat-smell-garlic-methi': 'a meal in a smoky restaurant or kitchen has stayed in your shirt.',
  'damp-clothes-musty-smell-monsoon-fix': 'a monsoon-dried shirt is fully dry but still smells faintly stale.',
  // category
  'attar-on-clothes-vs-fabric-odor-spray': 'you want attar to sit on a fresh shirt, not on yesterday\'s sweat.',
  // buying: gifts and kits
  'gifts-for-men-under-500-india': 'you want a small, useful gift for someone who commutes in the heat.',
  'return-gifts-for-men-indian-wedding': 'you want a small, useful gift for someone who commutes in the heat.',
  'secret-santa-gift-ideas-for-coworkers-india': 'you want a small, useful gift for someone who commutes in the heat.',
  'grooming-essentials-for-men-india': 'your kit covers skin and hair, but not the smell in your shirt.',
  // everyday
  'stop-sweat-smell-job-interview': 'you have to walk into an interview after a hot commute.',
  'freshen-up-after-work-before-going-out': 'you are going out straight from office in the shirt you worked in.',
  'how-to-tell-someone-they-have-body-odour': { lead: 'An easy fix to hand over:', text: 'it goes on the shirt\'s collar and underarms, not on the person.' },
  'teenage-son-body-odour-clothes-parents-guide': 'his uniform shirt or hoodie has to last another day before wash day.',
  // 2026-11-09 series.
  'remove-smell-from-lehenga-without-washing': "a washable blouse lining has to go to one more function. Patch-test first; never on dry-clean-only pieces.",
  'rented-sherwani-lehenga-smell': "the vest or kurta under a rented outfit has to stay fresh all evening.",
  'bonfire-smoke-smell-out-of-clothes': "Lohri or barbeque smoke has come home in your jacket lining.",
  'what-to-wear-for-kedarnath-yatra': "the fleece and jacket have to last a yatra with no laundry.",
  'why-does-my-raincoat-smell': "the shirt under your raincoat arrives at office damp with sweat.",
  'fish-smell-on-clothes-after-cooking': "a light fish-fry smell has stayed in a shirt you cannot wash today.",
  'how-to-stay-fresh-without-bathing': "a lightly worn shirt has to do one more day.",
  'advocate-black-coat-summer-fresh': "the white shirt under your coat has done a full morning in court.",
  'durga-puja-pandal-hopping-outfit-fresh': "a cotton panjabi or blouse has to go pandal hopping again. Patch-test silk first.",
  'garba-sweat-chaniya-choli-fresh': "a choli lining has to dance another night. Patch-test first and keep it away from mirror work.",
  'old-age-body-odour-nonenal': "a parent's kurta or sweater will be worn again before wash day.",
  'rakhi-gift-for-brother': "you want a small, useful Rakhi gift for a brother who commutes in the heat.",
  'sweaty-back-while-driving-shirt-smell': "an hour pressed against the seat back has left sweat in your shirt.",
};

/* Facts, all from config/product.json. */
const DISPATCH = (shipping.dispatchWindow.match(/\d+\s*hours/) || [])[0];
if (!DISPATCH) throw new Error('product-card: config shipping.dispatchWindow names no hours');
export const CARD = {
  name: product.shortName,
  kind: `${product.size} · pocket size`,
  what: 'Pocket fabric freshener for clothes: neutralizes sweat, smoke and food smell in the fabric. Never on skin.',
  perks: ['Cash on Delivery', 'Free shipping on prepaid', `Ships from ${brand.city} within ${DISPATCH}`],
  intl: 'We deliver within India only.',
  cta: `See how ${product.shortName} works`,
  href: '/odorstrike',
  img: {
    base: '/assets/photos/offer-in-hand-black',
    alt: `A hand holding the ${product.shortName} ${product.size} fabric odor spray bottle against a black background`,
  },
};

/* The card for one post, or '' if the post is skipped. */
export function useLine(slug, cluster) {
  const o = SLUG_LINES[slug] ?? CLUSTER_LINES[cluster];
  if (!o) throw new Error(`product-card: no "Use it when" line for ${slug} (cluster ${cluster})`);
  return typeof o === 'string' ? { lead: 'Use it when', text: o } : o;
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderCard(slug, cluster) {
  if (slug in SKIP) return '';
  const use = useLine(slug, cluster);
  const b = CARD.img.base;
  return [
    `<div class="pcard" id="blog_pcard">`,
    `<picture class="pcard__pic"><source type="image/avif" srcset="${b}@400.avif 400w, ${b}@640.avif 640w" sizes="72px">` +
      `<img class="pcard__img" src="${b}@400.webp" srcset="${b}@400.webp 400w, ${b}@640.webp 640w" sizes="72px" width="1152" height="2048" alt="${esc(CARD.img.alt)}" loading="lazy" decoding="async"></picture>`,
    `<div class="pcard__body">`,
    `<p class="pcard__name"><strong>${esc(CARD.name)}</strong> <span>${esc(CARD.kind)}</span></p>`,
    `<p class="pcard__what">${esc(CARD.what)}</p>`,
    `<p class="pcard__use"><strong>${esc(use.lead)}</strong> ${esc(use.text)}</p>`,
    `</div>`,
    `<div class="pcard__foot">`,
    `<p class="pcard__perks">${CARD.perks.map(esc).join(' · ')}</p>`,
    `<p class="pcard__intl" hidden>${esc(CARD.intl)}</p>`,
    `<a class="sf-btn sf-btn--ghost pcard__cta" href="${CARD.href}">${esc(CARD.cta)}</a>`,
    `</div>`,
    `</div>`,
  ].join('\n    ');
}
