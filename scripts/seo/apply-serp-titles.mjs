#!/usr/bin/env node
// Search-result titles for the blog (2026-10-15).
//
// Search Console showed impressions with almost no clicks on the guides. The
// fixes here come from how Google builds a result and from CTR studies:
// - Title and H1 say the same thing. Google rewrites ~61% of titles, and when
//   it does, the H1 is its first source (Zyppy 2022, Ahrefs 2023). Seven posts
//   had slogan H1s ("Three additives. Three jobs. Zero killers.") that could
//   become the search result.
// - 40–60 characters, no " | Smelloff" suffix (Google shows the site name
//   above the title; pipes raise the rewrite rate).
// - A concrete promise taken from the post itself ("6 spots to check",
//   "in 10 minutes", "(5 tested)"): a number in both title and H1 survives a
//   rewrite 97% of the time (Zyppy). Never a number the post doesn't back.
// - The description says what the reader gets, not the whole answer, and no
//   price on how-to guides.
//
// Each entry sets <title>, og:title, twitter:title, the Article headline, the
// breadcrumb's last item (schema + visible), the H1 (`h1` keeps its <em>
// accent) and, if given, the description / og / twitter descriptions.
// Idempotent. `--check` exits 1 if a page is out of date.
// Run `node scripts/blog/apply-reader.mjs` after: Related-guide cards use titles.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');

export const SERP = {
  'best-deodorant-spray-for-clothes-not-skin': {
    title: "Cloth Deodorant: Best Deodorant Spray for Clothes in India",
    h1: "Cloth Deodorant: The Best <em>Deodorant Spray</em> for Clothes (Not Skin) in India",
    desc: "Want a deodorant spray for clothes, not skin? How a cloth deodorant differs from body deo, the 4 things to look for in one, and where ODORSTRIKE fits.",
  },
  'why-clothes-smell-bad-again-after-sweating': {
    title: "Why Do Clothes Smell Bad Again After You Start Sweating?",
    h1: "Why Do Clothes Smell <em>Bad Again After You Start Sweating?</em>",
  },
  'why-body-odor-comes-back-on-clothes-so-quickly': {
    title: "Why Does Body Odor Come Back on Clothes So Quickly?",
    h1: "Why Does Body Odor Come Back on Clothes <em>So Quickly?</em>",
  },
  'deodorant-vs-fabric-mist': {
    title: "Can You Use Deodorant on Clothes? Deodorant vs Fabric Mist",
    h1: "Can You Use Deodorant on Clothes? <em>Deodorant vs Fabric Mist</em>",
    desc: "Not as a fix. Body deodorant is made for skin: on a shirt it adds scent over the smell and can leave white marks or yellow pits. What to use on clothes.",
  },
  'remove-smell-from-clothes-without-washing': {
    title: 'How to Remove Smell From Clothes Without Washing (by Smell)',
    h1: 'How to Remove Smell From Clothes <em>Without Washing</em>',
    desc: 'Sweat, curry, smoke, mothballs or a musty almirah: find your smell, where it sits on the garment and the no-wash fix, plus when only a wash will do.',
  },
  'why-clothes-smell-bad-after-drying': {
    title: 'Why Clothes Smell Bad After Drying (and What to Change)',
    h1: 'Why Clothes Smell Bad After Drying <em>(and What to Change)</em>',
    desc: 'Clean when wet, sour once dry? Slow drying, damp seams and a load left in the machine. What to change in the drying step before you rewash it all.',
  },
  'gym-clothes-smell-after-washing': {
    title: "Why Do Dri-Fit Gym Clothes Smell After Washing? 5 Reasons",
    h1: "Why Do Dri-Fit Gym Clothes Smell After Washing? <em>5 Reasons and the Fix</em>",
    desc: "Dri-fit and polyester hold body oil that a cool, quick wash leaves behind, so the smell is back as soon as you warm up. The 5 causes, and how to get it out.",
  },
  'why-clothes-smell-musty-after-being-stored': {
    title: "Why Do Clothes Smell After Being Stored? Causes and Fix",
    h1: "Why Do Clothes Smell After Being Stored? <em>Causes and the Fix</em>",
    desc: "Clean clothes from a closed cupboard or suitcase smelling musty? Trapped damp is the cause. Why it happens, the reset without a rewash, and how to store them.",
  },
  'why-clothes-smell-in-wardrobe-even-when-clean': {
    title: 'Why Clean Clothes Smell in the Wardrobe (and the Fix)',
    h1: 'Why Clean Clothes Smell <em>in the Wardrobe (and the Fix)</em>',
    desc: 'Freshly washed shirts coming out of the almirah stale? The wardrobe itself can be the source. What causes it and the reset that stops it coming back.',
  },
  'why-washing-machine-makes-clothes-smell': {
    title: 'Why Does the Washing Machine Make Clothes Smell? 6 Checks',
    h1: 'Why Does the Washing Machine Make Clothes Smell? <em>6 Spots to Check</em>',
    desc: 'Gasket, detergent drawer, drum, drain filter, the forgotten wet load and the room: six places a washing machine turns clothes sour, and how to fix each.',
  },
  // 2026-11-09 (owner: market it as a fabric freshener): "fabric odor
  // eliminator" has next to no searches in India (Google Trends, 5 years);
  // "what is fabric freshener used for" is a real query.
  'what-is-fabric-odor-eliminator': {
    title: "What Is a Fabric Freshener? How It Works on Clothes",
    h1: "What Is a <em>Fabric Freshener</em>? How It Works on Clothes",
    desc: "Some fabric fresheners only add perfume; others neutralise the smell in the fibre. How to tell them apart, which ingredients work and how to use one.",
  },
  'best-fabric-odor-spray-india-2026-body-odor': {
    title: "Best Fabric Freshener for Clothes in India: 5 Types Compared",
    h1: "Best Fabric Freshener for Clothes in India: <em>5 Types Compared</em>",
    desc: "Which fabric freshener works on clothes in India? Five spray types compared, the 5 checks before you buy, and whether cheap refreshers match big brands.",
  },
  'remove-cigarette-smoke-smell-from-clothes': {
    title: 'How to Get Cigarette Smoke Smell Out of Clothes Tonight',
    h1: 'How to Get Cigarette Smoke Smell <em>Out of Clothes Tonight</em>',
    desc: 'Back from a party smelling of smoke? Six approaches compared by what they do and how long they take, from brushing and airing to a mist or a wash.',
  },
  'remove-cooking-smell-from-clothes': {
    title: "How to Get Curry Smell Out of Clothes Without Washing",
    h1: "How to Get Curry Smell Out of Clothes <em>Without Washing</em>",
    desc: "Tadka or curry smell stuck in your shirt? Why it clings to the fibres, a 10-minute reset that works without a wash, and when only washing will fix it.",
  },
  'remove-mothball-almirah-smell-from-clothes': {
    title: 'How to Get Mothball (Naphthalene) Smell Out of Clothes',
    h1: 'How to Get <em>Mothball and Almirah</em> Smell Out of Clothes',
    desc: 'Clothes from the almirah smell of naphthalene? Why a quick wash barely touches it, why sun and softener backfire, and the airing method that clears it.',
  },
  'remove-smell-from-hoodie-without-washing': {
    h1: 'How to Get Smell Out of a <em>Hoodie</em> Without Washing',
  },
  'dry-air-clothes-indian-home': {
    title: 'How to Dry Clothes Indoors Without a Damp Smell (India)',
    h1: 'How to Dry Clothes Indoors <em>Without a Damp Smell</em>',
  },
  'damp-clothes-musty-smell-monsoon-fix': {
    h1: 'Why Clothes Smell Musty in Monsoon <em>(and How to Fix It)</em>',
  },
  'vinegar-baking-soda-fabric-softener': {
    title: 'Does Vinegar, Baking Soda or Softener Remove Clothes Odor?',
    h1: 'Does Vinegar, Baking Soda or Softener <em>Remove Clothes Odor?</em>',
  },
  'remove-incense-agarbatti-dhoop-smell': {
    h1: 'How to Remove <em>Incense and Agarbatti</em> Smell From Clothes',
  },
  'deodorant-perfume-on-fabric': {
    title: 'Why Deodorant and Perfume Fail on a Sweaty Shirt',
    h1: 'Why Deodorant and Perfume <em>Fail on a Sweaty Shirt</em>',
  },
  'how-odor-neutralizer-works-on-fabric': {
    title: 'How an Odor Neutralizer Works on Fabric: Cage, Not Cover',
    h1: 'How an Odor Neutralizer Works on Fabric: <em>Cage, Not Cover</em>',
  },
  'why-clothes-smell-stale-in-ac-room': {
    title: 'Why Clothes Smell Stale in an AC Room (and the Fix)',
    h1: 'Why Clothes Smell Stale <em>in an AC Room</em>',
  },
  'why-sweat-smells-stronger-on-some-shirts': {
    title: 'Why Sweat Smells Stronger on Some Shirts Than Others',
    h1: 'Why Sweat Smells Stronger <em>on Some Shirts</em>',
  },
  'why-traffic-fumes-cling-to-clothes': {
    title: 'Why Traffic Fumes Cling to Clothes on Your Commute',
    h1: 'Why Traffic Fumes Cling to <em>Clothes on Your Commute</em>',
  },
  'why-water-makes-clothing-odor-louder': {
    title: 'Why Clothes Smell Worse When Wet or Humid',
    h1: 'Why Clothes Smell Worse <em>When Wet or Humid</em>',
  },
  'why-shirt-zones-smell-after-washing': {
    title: 'Why Collar and Armpits Still Smell After Washing',
    h1: 'Why the Collar and Armpits <em>Still Smell After Washing</em>',
  },
  'odorstrike-ingredients': {
    h1: 'ODORSTRIKE Ingredients: <em>The Key Actives, Explained</em>',
  },
  'hpbcd-cyclodextrin-fabric-odor': {
    h1: 'Cyclodextrin (HPβCD) in Deodorant and <em>Fabric Spray, Explained</em>',
  },
  'spray-to-remove-sweat-smell-from-clothes-quickly': {
    title: 'Spray to Remove Sweat Smell From Clothes Fast (5 Tested)',
    h1: 'Spray to Remove Sweat Smell From Clothes Fast <em>(5 Tested)</em>',
  },
  'odorstrike-vs-febreze-india': {
    title: 'ODORSTRIKE vs Febreze: A Febreze Alternative for Clothes',
  },
  'why-deodorant-stops-working-after-3-hours': {
    title: 'Why Deodorant Stops Working After 3 Hours (and What Helps)',
  },
  'how-to-use-odorstrike': {
    h1: 'How to Use ODORSTRIKE: <em>Sprays, Zones and Timing</em>',
  },
  'why-i-built-odorstrike': {
    h1: 'Why I Built ODORSTRIKE: <em>India\'s Pocket Fabric Spray</em>',
  },
  'keep-clothes-fresh-without-washing-machine': {
    h1: 'No Washing Machine? <em>Keep Clothes Fresh in a Hostel or PG</em>',
  },
  'keep-office-trousers-fresh-without-washing': {
    h1: 'Keep <em>Office Trousers</em> Fresh Without Washing Them Daily',
  },
  'wash-refresh-or-wear': {
    title: 'Wash It, Mist It, or Wear It? A Quick Decision Guide',
  },
};

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (s) => s.replace(/&/g, '&amp;');
const json = (s) => JSON.stringify(s).slice(1, -1);

function setMeta(html, re, value) {
  return html.replace(re, (_, a, b) => `${a}${value}${b}`);
}

let stale = 0;
for (const [slug, e] of Object.entries(SERP)) {
  const file = join(ROOT, 'blog', `${slug}.html`);
  const before = readFileSync(file, 'utf8');
  let h = before;
  if (e.title && e.title.length > 60) throw new Error(`${slug}: title is ${e.title.length} characters`);
  if (e.desc && (e.desc.length < 70 || e.desc.length > 160)) throw new Error(`${slug}: description is ${e.desc.length} characters`);

  if (e.title) {
    h = h.replace(/<title>[^<]*<\/title>/, `<title>${text(e.title)}</title>`);
    h = setMeta(h, /(<meta property="og:title" content=")[^"]*(")/, attr(e.title));
    h = setMeta(h, /(<meta name="twitter:title" content=")[^"]*(")/, attr(e.title));
    h = setMeta(h, /("@type":"Article","headline":")(?:[^"\\]|\\.)*(")/, json(e.title));
    // Breadcrumb: the last ListItem (it carries this page's URL) and the visible crumb.
    h = h.replace(new RegExp(`("position":3,"name":")(?:[^"\\\\]|\\\\.)*(","item":"https://smelloff\\.in/blog/${slug}")`), (_, a, b) => `${a}${json(e.title)}${b}`);
    h = h.replace(/(<span aria-current="page">)[^<]*(<\/span>)/, (_, a, b) => `${a}${text(e.title)}${b}`);
  }
  if (e.h1) h = h.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, (_, a, b) => `${a}${e.h1}${b}`);
  if (e.desc) {
    h = setMeta(h, /(<meta name="description" content=")[^"]*(")/, attr(e.desc));
    h = setMeta(h, /(<meta property="og:description" content=")[^"]*(")/, attr(e.desc));
    h = setMeta(h, /(<meta name="twitter:description" content=")[^"]*(")/, attr(e.desc));
  }
  if (h !== before) {
    stale++;
    if (CHECK) console.error(`stale: blog/${slug}.html`);
    else writeFileSync(file, h);
  }
}
if (CHECK && stale) { console.error(`${stale} page(s) out of date: run node scripts/seo/apply-serp-titles.mjs`); process.exit(1); }
console.log(CHECK ? 'serp titles: up to date' : `serp titles: ${stale} page(s) updated`);
