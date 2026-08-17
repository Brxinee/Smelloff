#!/usr/bin/env node
/**
 * Smelloff revenue SEO layer.
 *
 * This is deliberately build-time and idempotent. It keeps the source pages
 * hand-authored while enforcing the high-leverage search surface consistently:
 * commercial metadata, static discovery of new guides, ItemList coverage, and
 * safe product-entity language.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG_DIR = path.join(REPO, 'blog');

const NEW_GUIDES = [
  ['why-clothes-smell-bad-again-after-sweating', 'how-to', 'Fabric Science', '8 min', 'Why Do Clothes Smell Bad Again After You Start Sweating?', 'Why heat and moisture can bring retained odorants back to life on a shirt.'],
  ['why-clothes-smell-bad-after-drying', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell Bad After Drying?', 'Slow drying, retained odorants and the fix before you rewash everything.'],
  ['why-clothes-smell-musty-after-being-stored', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell Musty After Being Stored?', 'How humidity, trapped air and storage conditions change clean clothing.'],
  ['why-clothes-smell-in-wardrobe-even-when-clean', 'how-to', 'Fabric Care', '8 min', 'Why Do Clothes Smell in the Wardrobe Even When They’re Clean?', 'Sometimes the wardrobe is the source of the stale clothing odor.'],
  ['why-polyester-holds-odor-longer-than-cotton', 'science', 'Fabric Science', '9 min', 'Why Does Polyester Hold Odor Longer Than Cotton?', 'What textile research says about polyester, cotton, sweat and odor.'],
  ['why-clean-shirt-starts-smelling-within-hours', 'science', 'Fabric Science', '8 min', 'Why Does a Clean Shirt Start Smelling Within a Few Hours?', 'How sweat, skin oils, microbes and fabric history create fast odor return.'],
  ['how-to-freshen-clothes-stored-for-months', 'how-to', 'How To', '8 min', 'How to Freshen Clothes After They’ve Been Stored for Months', 'A practical seasonal reset: air, inspect, wash when needed, then neutralize.'],
  ['how-to-pack-sweaty-clothes-without-bag-smell', 'how-to', 'How To', '8 min', 'How to Pack Sweaty Clothes Without Making Your Bag Smell', 'Separate, dry and contain worn clothing without turning your bag into an odor chamber.'],
  ['why-body-odor-comes-back-on-clothes-so-quickly', 'science', 'Fabric Science', '9 min', 'Why Does Body Odor Come Back on Clothes So Quickly?', 'Why the shirt can hold onto odor even after the skin feels fresh.'],
  ['odor-on-clothes-vs-odor-in-clothes', 'science', 'Fabric Science', '9 min', 'Odor on Clothes vs Odor in Clothes: What’s Actually Happening?', 'Surface odor, retained odorants and why heat or moisture can make smell return.'],
];

const META = {
  '/index.html': {
    title: 'Fabric Odor Remover for Clothes | Smelloff India',
    description: 'Smelloff makes ODORSTRIKE, a pocket-sized fabric odor neutralizer for clothes. Remove sweat and clothing odor without using perfume or body deodorant on your shirt.',
    ogTitle: 'Fabric Odor Remover for Clothes | Smelloff India',
    ogDescription: 'ODORSTRIKE is a pocket-sized fabric odor neutralizer made for clothing. Not perfume. Not body deodorant. Made in India.',
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
  'remove-cooking-smell-from-clothes': ['How to Remove Curry & Cooking Smell From Clothes', 'How to remove curry, tadka and cooking smell from clothes without simply covering it with perfume.'],
  'best-fabric-odor-spray-india-2026-body-odor': ['Best Fabric Odor Spray in India: 2026 Guide', 'Compare fabric odor sprays for clothes in India — what to look for, what actually matters, and when an odor neutralizer makes sense.'],
  'beta-cyclodextrin-odor-removal-science': ['Beta-Cyclodextrin for Odor Removal: How It Works', 'Learn how beta-cyclodextrin captures odor compounds in fabric and why it is used in serious odor-control products.'],
  'dri-fit-shirts-smell': ['Why Dri-Fit Shirts Smell After Washing (And What Helps)', 'Why synthetic workout shirts can smell again after washing and what to change in washing, drying and between-wear care.'],
  'deodorant-vs-fabric-mist': ['Deodorant vs Fabric Mist: Which Fixes Shirt Odor?', 'Deodorant is for skin; fabric odor control is for clothing. Learn which one solves the shirt problem and when.'],
};

function replaceMeta(html, attr, key, value) {
  const re = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*content=["'][^"']*["'][^>]*>`, 'i');
  return re.test(html)
    ? html.replace(re, `<meta ${attr}="${key}" content="${value}">`)
    : html.replace('</head>', `<meta ${attr}="${key}" content="${value}">\\n</head>`);
}

function replaceTitle(html, value) {
  return html.replace(/<title>[^<]*<\\/title>/i, `<title>${value}</title>`);
}

function applyMeta(html, meta) {
  html = replaceTitle(html, meta.title);
  html = replaceMeta(html, 'name', 'description', meta.description);
  html = replaceMeta(html, 'property', 'og:title', meta.ogTitle);
  html = replaceMeta(html, 'property', 'og:description', meta.ogDescription);
  html = replaceMeta(html, 'name', 'twitter:title', meta.ogTitle);
  html = replaceMeta(html, 'name', 'twitter:description', meta.ogDescription);
  return html;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collectBlogUrls() {
  return fs.readdirSync(BLOG_DIR)
    .filter((name) => name.endsWith('.html') && name !== 'index.html')
    .map((name) => `/blog/${name.replace(/\.html$/i, '')}`)
    .sort();
}

function staticGuideCards() {
  return NEW_GUIDES.map(([slug, cat, label, time, title, desc]) => `
    <a href="/blog/${slug}" class="b-card" data-cat="${cat}">
      <div class="b-card-thumb">
        <img loading="lazy" src="/blog/assets/${slug}.svg" alt="${esc(title)}" width="1600" height="900" decoding="async">
      </div>
      <div class="b-card-body">
        <div class="b-card-meta"><span class="b-card-cat">${esc(label)}</span><span class="b-card-sep">·</span><span>${esc(time)}</span><span class="b-card-sep">·</span><span>New</span></div>
        <h3>${esc(title)}</h3>
        <p>${esc(desc)}</p>
        <span class="b-card-arrow">Read Guide</span>
      </div>
    </a>`).join('\\n');
}

function updateBlogIndex(html) {
  html = applyMeta(html, META['/blog/index.html']);
  html = html.replace(/29 Science Guides/g, '39 Science Guides');
  html = html.replace(/All Guides \(29\)/g, 'All Guides (39)');
  html = html.replace(/id="latestCount">29 guides</g, 'id="latestCount">39 guides</g');

  const urls = collectBlogUrls();
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://smelloff.in${url}` })),
  };
  const itemListScript = `<script type="application/ld+json">\\n${JSON.stringify(itemList)}\\n</script>`;
  html = html.replace(/<script type="application\\/ld\+json">\\s*\{"@context": "https:\\/\\/schema\\.org", "@type": "ItemList"[\s\S]*?<\\/script>/i, itemListScript);

  const markerStart = '<!-- SF-REVENUE-STATIC-GUIDES:START -->';
  const markerEnd = '<!-- SF-REVENUE-STATIC-GUIDES:END -->';
  const block = `${markerStart}\\n<span id="smelloff-new-guides" hidden aria-hidden="true"></span>\\n${staticGuideCards()}\\n${markerEnd}`;
  const existing = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'i');
  if (existing.test(html)) html = html.replace(existing, block);
  else {
    const needle = '    <!-- Card 1 -->';
    if (html.includes(needle)) html = html.replace(needle, `${block}\\n\\n${needle}`);
    else html = html.replace('</div>\\n</section>\\n\\n<!-- Product Conversion Spotlight Banner -->', `${block}\\n  </div>\\n</section>\\n\\n<!-- Product Conversion Spotlight Banner -->`);
  }
  return html;
}

function updateProductPage(html) {
  html = applyMeta(html, META['/odorstrike.html']);
  html = html.replace(/50ml mist that kills sweat smell, gym odor, and shirt stink in seconds —/i, '50ml fabric odor-control mist for sweat and clothing odor —');
  html = html.replace(/KILLS SWEAT SMELL IN SECONDS/gi, 'FABRIC ODOR CONTROL');
  html = html.replace(/kills sweat smell in seconds/gi, 'helps neutralize sweat and clothing odor');
  html = html.replace(/kills sweat smell, gym odor, and shirt stink in seconds/gi, 'helps neutralize sweat and clothing odor');
  return html;
}

function updateWinner(html, slug) {
  const item = WINNERS[slug];
  if (!item) return html;
  html = replaceTitle(html, item[0]);
  html = replaceMeta(html, 'name', 'description', item[1]);
  html = replaceMeta(html, 'property', 'og:title', item[0]);
  html = replaceMeta(html, 'property', 'og:description', item[1]);
  html = replaceMeta(html, 'name', 'twitter:title', item[0]);
  html = replaceMeta(html, 'name', 'twitter:description', item[1]);
  return html;
}

function main() {
  const changed = [];
  const root = path.join(REPO, 'index.html');
  const product = path.join(REPO, 'odorstrike.html');
  const blog = path.join(BLOG_DIR, 'index.html');

  let html = fs.readFileSync(root, 'utf8');
  const next = applyMeta(html, META['/index.html']);
  if (next !== html) { fs.writeFileSync(root, next); changed.push('index.html'); }

  html = fs.readFileSync(product, 'utf8');
  const productNext = updateProductPage(html);
  if (productNext !== html) { fs.writeFileSync(product, productNext); changed.push('odorstrike.html'); }

  html = fs.readFileSync(blog, 'utf8');
  const blogNext = updateBlogIndex(html);
  if (blogNext !== html) { fs.writeFileSync(blog, blogNext); changed.push('blog/index.html'); }

  for (const [slug] of Object.entries(WINNERS)) {
    const file = path.join(BLOG_DIR, `${slug}.html`);
    if (!fs.existsSync(file)) continue;
    html = fs.readFileSync(file, 'utf8');
    const nextWinner = updateWinner(html, slug);
    if (nextWinner !== html) { fs.writeFileSync(file, nextWinner); changed.push(`blog/${slug}.html`); }
  }

  if (process.argv.includes('--check')) {
    if (changed.length) {
      console.error(`Revenue SEO drift detected in ${changed.length} file(s):\\n- ${changed.join('\\n- ')}`);
      process.exit(1);
    }
    console.log('Revenue SEO: clean');
    return;
  }

  console.log(`Revenue SEO applied: ${changed.length} file(s)`);
}

main();
