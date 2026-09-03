#!/usr/bin/env node
/** Build-time, idempotent revenue SEO/AEO layer for Smelloff. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG_DIR = path.join(REPO, 'blog');
const CHECK = process.argv.includes('--check');

const NEW_GUIDES = [
  ['why-clothes-smell-bad-again-after-sweating', 'how-to', 'Fabric Science', '8 min', 'Why Do Clothes Smell Bad Again After You Start Sweating?', 'Why heat and moisture can bring retained odor back on a shirt.'],
  ['why-clothes-smell-bad-after-drying', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell Bad After Drying?', 'Slow drying, retained odor and the fix before you rewash everything.'],
  ['why-clothes-smell-musty-after-being-stored', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell Musty After Being Stored?', 'How humidity, trapped air and storage conditions change clean clothing.'],
  ['why-clothes-smell-in-wardrobe-even-when-clean', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell in the Wardrobe Even When They’re Clean?', 'Sometimes the wardrobe is the source of stale clothing odor.'],
  ['why-polyester-holds-odor-longer-than-cotton', 'science', 'Fabric Science', '9 min', 'Why Does Polyester Hold Odor Longer Than Cotton?', 'What textile research says about polyester, cotton, sweat and odor.'],
  ['why-clean-shirt-starts-smelling-within-hours', 'science', 'Fabric Science', '8 min', 'Why Does a Clean Shirt Start Smelling Within a Few Hours?', 'How sweat, skin oils, microbes and fabric history create fast odor return.'],
  ['how-to-freshen-clothes-stored-for-months', 'how-to', 'How To', '8 min', 'How to Freshen Clothes After They’ve Been Stored for Months', 'A practical seasonal reset for stored clothing.'],
  ['how-to-pack-sweaty-clothes-without-bag-smell', 'how-to', 'How To', '8 min', 'How to Pack Sweaty Clothes Without Making Your Bag Smell', 'Separate, dry and contain worn clothing before it turns your bag into an odor chamber.'],
  ['why-body-odor-comes-back-on-clothes-so-quickly', 'science', 'Fabric Science', '9 min', 'Why Does Body Odor Come Back on Clothes So Quickly?', 'Why a shirt can retain odor even after the skin feels fresh.'],
  ['odor-on-clothes-vs-odor-in-clothes', 'science', 'Fabric Science', '9 min', 'Odor on Clothes vs Odor in Clothes: What’s Actually Happening?', 'Surface odor, retained odor and why heat or moisture can make smell return.'],
];

const META = {
  '/index.html': {
    title: 'ODORSTRIKE Fabric Odor Spray for Clothes | Smelloff',
    description: 'Smelloff makes ODORSTRIKE, a pocket-sized fabric odor spray for clothes. ₹229 prepaid UPI in India. Not perfume. Not deodorant. Fabric only.',
    ogTitle: 'ODORSTRIKE Fabric Odor Spray for Clothes | Smelloff',
    ogDescription: 'ODORSTRIKE is a pocket-sized fabric odor spray for clothing. Not perfume. Not body deodorant. Made in Hyderabad, India. ₹229.',
  },
  '/odorstrike.html': {
    title: 'Fabric Odor Spray for Clothes India ₹229 | ODORSTRIKE',
    description: 'ODORSTRIKE is a 50ml fabric odor spray for clothes. Made for shirts, tees, jackets and other clothing. Not perfume. Not body deodorant. ₹229 in India.',
    ogTitle: 'ODORSTRIKE Fabric Odor Spray for Clothes ₹229 | Smelloff',
    ogDescription: 'A 50ml pocket fabric odor spray for clothing. Not perfume. Not deodorant. Built for shirts and everyday clothes in India.',
  },
  '/blog/index.html': {
    title: 'Fabric Odor Guides & Clothes Smell Fixes | Smelloff',
    description: 'Practical guides on fabric odor, sweat smell, clothes freshness and what actually helps. Science-led, India-first, written for real clothing problems.',
    ogTitle: 'Fabric Odor Guides & Clothes Smell Fixes | Smelloff',
    ogDescription: 'Science-led guides for sweat smell, clothing odor, fabric care and practical between-wash fixes.',
  },
};

const WINNERS = {
  'remove-cooking-smell-from-clothes': ['How to Remove Curry & Cooking Smell From Clothes', 'How to get curry, tadka and cooking smell out of clothes without washing — perfume only covers it.'],
  'best-fabric-odor-spray-india-2026-body-odor': ['Best Fabric Freshener & Odor Spray in India 2026', 'Cheap fabric refresher vs popular brands in India: what actually works on clothes, not sofas. ODORSTRIKE is ₹229.'],
  'hpbcd-cyclodextrin-fabric-odor': ['Beta-Cyclodextrin (HPβCD) Spray for Fabric Odor', 'What cyclodextrin spray does on clothes: HPβCD traps odor in fabric. Used in ODORSTRIKE, not as a deodorant.'],
  'gym-clothes-smell-after-washing': ['Why Dri-Fit Shirts Smell After Washing (Gym Fix)', 'Why dri-fit and gym clothes still smell after washing — polyester holds odor oils a cold wash misses.'],
  'deodorant-vs-fabric-mist': ['Deodorant vs Fabric Mist: Which Fixes Shirt Odor?', 'Can deodorant be used on clothes? No — deodorant is for skin. A fabric mist is for the shirt. Here is the difference.'],
  'fabric-deodorizer-spray-india-guide-2026': ['Fabric Freshener vs Deodorizer in India (2026)', 'A fabric freshener perfumes cloth. A deodorizer traps odor. What to buy for clothes in India — not sofas.'],
  'why-clothes-smell-musty-after-being-stored': ['Why Do Clothes Smell Musty After Being Stored?', 'Why clean clothes smell after storage, what humidity does, and how to reset them without a full rewash.'],
  'why-body-odor-comes-back-on-clothes-so-quickly': ['Why Body Odor Comes Back on Clothes So Quickly', 'Why a shirt can smell again after a shower — the odor is in the fabric, not only on skin.'],
  'why-clothes-smell-bad-after-drying': ['Why Do Clothes Smell Bad After Drying?', 'Why laundry smells after drying — slow damp drying, retained odor, and the fix before you rewash.'],
  'why-polyester-holds-odor-longer-than-cotton': ['Does Polyester Hold Odor Longer Than Cotton?', 'Why polyester and dri-fit hold sweat smell longer than cotton, and what actually resets it.'],
  'best-deodorant-spray-for-clothes-not-skin': ['Cloth Deodorant Spray for Clothes, Not Skin', 'A spray for clothes not skin: cloth deodorant vs body deodorant. ODORSTRIKE is fabric only, ₹229.'],
  'odorstrike-vs-febreze-india': ['Febreze Alternative in India for Clothes | ODORSTRIKE', 'ODORSTRIKE vs Febreze in India: clothes mist vs room/sofa freshener. ₹229 prepaid.'],
  'keep-clothes-fresh-while-travelling': ['How to Keep Clothes Fresh in a Suitcase', 'How to keep clothes fresh while travelling and stop a suitcase smelling. Pack dry, isolate worn items.'],
  'spray-to-remove-sweat-smell-from-clothes-quickly': ['Shirt Odor Spray: Sweat Smell Off Clothes Fast', 'Shirt odor spray for sweat smell on clothes. Fabric only, ~10 second dry. Not a skin deodorant.'],
  'remove-mothball-almirah-smell-from-clothes': ['How to Get Naphthalene / Mothball Smell Out of Clothes', 'Naphthalene and mothball almirah smell on clothes: air, then mist. Perfume will not last.'],
};

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function replaceTitle(html, value) {
  return html.replace(new RegExp('<title>[^<]*</title>', 'i'), `<title>${esc(value)}</title>`);
}

function replaceMeta(html, attr, key, value) {
  const pattern = `<meta\\s+${attr}=["']${key}["'][^>]*content=["'][^"']*["'][^>]*>`;
  const re = new RegExp(pattern, 'i');
  const replacement = `<meta ${attr}="${key}" content="${esc(value)}">`;
  return re.test(html) ? html.replace(re, replacement) : html.replace('</head>', `${replacement}\n</head>`);
}

function applyMeta(html, meta) {
  let out = replaceTitle(html, meta.title);
  out = replaceMeta(out, 'name', 'description', meta.description);
  out = replaceMeta(out, 'property', 'og:title', meta.ogTitle);
  out = replaceMeta(out, 'property', 'og:description', meta.ogDescription);
  out = replaceMeta(out, 'name', 'twitter:title', meta.ogTitle);
  out = replaceMeta(out, 'name', 'twitter:description', meta.ogDescription);
  return out;
}

function collectBlogUrls() {
  return fs.readdirSync(BLOG_DIR)
    .filter(name => name.endsWith('.html') && name !== 'index.html')
    .map(name => `/blog/${name.replace(/\.html$/i, '')}`)
    .sort();
}

function staticGuideCards() {
  return NEW_GUIDES.map(([slug, cat, label, time, title, desc]) => `
<a href="/blog/${slug}" class="b-card" data-cat="${cat}">
  <div class="b-card-thumb"><img loading="lazy" src="/blog/assets/${slug}.svg" alt="${esc(title)}" width="1600" height="900" decoding="async"></div>
  <div class="b-card-body">
    <div class="b-card-meta"><span class="b-card-cat">${esc(label)}</span><span class="b-card-sep">·</span><span>${esc(time)}</span><span class="b-card-sep">·</span><span>New</span></div>
    <h3>${esc(title)}</h3>
    <p>${esc(desc)}</p>
    <span class="b-card-arrow">Read Guide</span>
  </div>
</a>`).join('\n');
}

function updateBlogIndex(html) {
  let out = applyMeta(html, META['/blog/index.html']);
  out = out.replace(/29 Science Guides/g, '39 Science Guides');
  out = out.replace(/All Guides \(29\)/g, 'All Guides (39)');
  out = out.replace(/id="latestCount">29 guides</g, 'id="latestCount">39 guides</g');

  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: collectBlogUrls().map((url, index) => ({ '@type': 'ListItem', position: index + 1, url: `https://smelloff.in${url}` })),
  };
  const itemListScript = `<script type="application/ld+json">\n${JSON.stringify(list)}\n</script>`;
  const itemListPattern = '<script type="application\\/ld\\+json">[\\s\\S]*?"@type"\\s*:\\s*"ItemList"[\\s\\S]*?<\\/script>';
  const itemListRe = new RegExp(itemListPattern, 'i');
  out = itemListRe.test(out) ? out.replace(itemListRe, itemListScript) : out.replace('</head>', `${itemListScript}\n</head>`);

  const start = '<!-- SF-REVENUE-STATIC-GUIDES:START -->';
  const end = '<!-- SF-REVENUE-STATIC-GUIDES:END -->';
  const block = `${start}\n<span id="smelloff-new-guides" hidden aria-hidden="true"></span>\n${staticGuideCards()}\n${end}`;
  const markerRe = new RegExp(`${start}[\\s\\S]*?${end}`, 'i');
  if (markerRe.test(out)) out = out.replace(markerRe, block);
  else if (out.includes('<!-- Card 1 -->')) out = out.replace('<!-- Card 1 -->', `${block}\n<!-- Card 1 -->`);

  return out;
}

function updateProductPage(html) {
  let out = applyMeta(html, META['/odorstrike.html']);
  out = out.replace(/50ml mist that kills sweat smell, gym odor, and shirt stink in seconds —/gi, '50ml fabric odor-control mist for sweat and clothing odor —');
  out = out.replace(/KILLS SWEAT SMELL IN SECONDS/gi, 'FABRIC ODOR CONTROL');
  out = out.replace(/kills sweat smell, gym odor, and shirt stink in seconds/gi, 'helps neutralize sweat and clothing odor');
  out = out.replace(/kills sweat smell in seconds/gi, 'helps neutralize sweat and clothing odor');
  return out;
}

function updateWinner(html, slug) {
  const item = WINNERS[slug];
  if (!item) return html;
  let out = replaceTitle(html, item[0]);
  out = replaceMeta(out, 'name', 'description', item[1]);
  out = replaceMeta(out, 'property', 'og:title', item[0]);
  out = replaceMeta(out, 'property', 'og:description', item[1]);
  out = replaceMeta(out, 'name', 'twitter:title', item[0]);
  out = replaceMeta(out, 'name', 'twitter:description', item[1]);
  return out;
}

function main() {
  const changed = [];
  const root = path.join(REPO, 'index.html');
  const product = path.join(REPO, 'odorstrike.html');
  const blog = path.join(BLOG_DIR, 'index.html');

  let html = fs.readFileSync(root, 'utf8');
  let next = applyMeta(html, META['/index.html']);
  if (next !== html) { fs.writeFileSync(root, next); changed.push('index.html'); }

  html = fs.readFileSync(product, 'utf8');
  next = updateProductPage(html);
  if (next !== html) { fs.writeFileSync(product, next); changed.push('odorstrike.html'); }

  html = fs.readFileSync(blog, 'utf8');
  next = updateBlogIndex(html);
  if (next !== html) { fs.writeFileSync(blog, next); changed.push('blog/index.html'); }

  for (const slug of Object.keys(WINNERS)) {
    const file = path.join(BLOG_DIR, `${slug}.html`);
    if (!fs.existsSync(file)) continue;
    html = fs.readFileSync(file, 'utf8');
    next = updateWinner(html, slug);
    if (next !== html) { fs.writeFileSync(file, next); changed.push(`blog/${slug}.html`); }
  }

  if (CHECK) {
    if (changed.length) {
      console.error(`Revenue SEO drift detected in ${changed.length} file(s):\n- ${changed.join('\n- ')}`);
      process.exit(1);
    }
    console.log('Revenue SEO: clean');
    return;
  }
  console.log(`Revenue SEO applied: ${changed.length} file(s)`);
}

main();
