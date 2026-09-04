/**
 * Wires photography-first thumbnails into blog markup.
 *
 *   node scripts/thumbnails/apply-thumbnails.mjs
 *   node scripts/thumbnails/apply-thumbnails.mjs --check
 *
 * Replaces <picture> blocks AND lone <img> heroes/cards that still point at
 * SVG title cards, then keeps og:image / twitter:image / JSON-LD / sitemap
 * on the 1920×1080 JPEG.
 *
 * Idempotent: never wraps an <img> that is already inside <picture>.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, EXTRA_ASSETS, CANVAS, WIDTHS, CACHE_V, deliveryUrl, srcsetFor, validateConfig } from './thumbnails.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG = path.join(REPO, 'blog');
const ORIGIN = 'https://smelloff.in';
const MANIFEST = path.join(REPO, 'blog-image-manifest.json');

const CHECK = process.argv.includes('--check');
const ALL = [...POSTS, ...EXTRA_ASSETS];
const bySlug = new Map(ALL.map((p) => [p.slug, p]));

const PRODUCT_PHOTO = new Set([
  'how-to-use-odorstrike',
  'odorstrike-ingredients',
  'what-is-fabric-odor-eliminator',
]);

const GRADE_D = new Set([
  'deodorant-perfume-on-fabric',
  'dry-air-clothes-indian-home',
  'how-odor-neutralizer-works-on-fabric',
  'how-to-freshen-clothes-stored-for-months',
  'how-to-pack-sweaty-clothes-without-bag-smell',
  'odor-on-clothes-vs-odor-in-clothes',
  'remove-incense-agarbatti-dhoop-smell',
  'vinegar-baking-soda-fabric-softener',
  'wash-refresh-or-wear',
  'why-body-odor-comes-back-on-clothes-so-quickly',
  'why-clean-shirt-starts-smelling-within-hours',
  'why-clothes-smell-bad-after-drying',
  'why-clothes-smell-bad-again-after-sweating',
  'why-clothes-smell-in-wardrobe-even-when-clean',
  'why-clothes-smell-musty-after-being-stored',
  'why-clothes-smell-stale-in-ac-room',
  'why-polyester-holds-odor-longer-than-cotton',
  'why-shirt-zones-smell-after-washing',
  'why-sweat-smells-stronger-on-some-shirts',
  'why-traffic-fumes-cling-to-clothes',
  'why-washing-machine-makes-clothes-smell',
  'why-water-makes-clothing-odor-louder',
]);

const asset = (slug, ext, w) => deliveryUrl(slug, ext, w);
const srcset = (slug, ext) => srcsetFor(slug, ext);

const esc = (s) =>
  String(s).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<');

const SIZES = {
  hero: '(min-width: 900px) 820px, 100vw',
  card: '(min-width: 900px) 380px, 100vw',
};

function pictureBlock(post, { role, imgAttrs }) {
  const sizes = SIZES[role];
  return (
    `<picture>` +
    `<source type="image/avif" srcset="${srcset(post.slug, 'avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${srcset(post.slug, 'webp')}" sizes="${sizes}">` +
    `<img ${imgAttrs} src="${asset(post.slug, 'jpg')}" alt="${esc(post.alt)}" ` +
    `width="${CANVAS.width}" height="${CANVAS.height}" decoding="async">` +
    `</picture>`
  );
}

function slugOf(block) {
  const m = block.match(/\/blog\/assets\/([a-z0-9-]+?)(?:@\d+)?\.(?:jpg|png|webp|avif|svg)/i);
  return m ? m[1] : null;
}

function keepFromImg(img) {
  const keep = [];
  const cls = img.match(/\sclass="([^"]*)"/);
  if (cls) keep.push(`class="${cls[1]}"`);
  if (/\sfetchpriority="high"/.test(img)) keep.push('fetchpriority="high"');
  if (/\sloading="lazy"/.test(img)) keep.push('loading="lazy"');
  const style = img.match(/\sstyle="([^"]*)"/);
  if (style) keep.push(`style="${style[1]}"`);
  return keep.join(' ');
}

/** Collapse <picture>…<picture>inner</picture>…</picture> to the inner block. */
function unwrapNestedPictures(html) {
  const re =
    /<picture>(?:(?!<\/picture>|<picture>)[\s\S])*?<picture>([\s\S]*?)<\/picture>(?:(?!<\/picture>|<picture>)[\s\S])*?<\/picture>/g;
  let prev;
  do {
    prev = html;
    html = html.replace(re, '<picture>$1</picture>');
  } while (html !== prev);
  return html;
}

function insidePicture(html, offset) {
  const before = html.slice(0, offset);
  return before.lastIndexOf('<picture') > before.lastIndexOf('</picture>');
}

function rewritePictures(html, role) {
  let touched = 0;
  let out = unwrapNestedPictures(html);

  out = out.replace(/<picture>[\s\S]*?<\/picture>/g, (block) => {
    const slug = slugOf(block);
    const post = slug && bySlug.get(slug);
    if (!post) return block;
    const img = block.match(/<img\b[^>]*>/)?.[0] ?? '';
    touched++;
    return pictureBlock(post, { role, imgAttrs: keepFromImg(img) });
  });

  out = out.replace(
    /<img\b[^>]*\/blog\/assets\/[a-z0-9-]+\.(?:svg|jpg|png|webp|avif)[^>]*>/gi,
    (img, offset) => {
      if (insidePicture(out, offset)) return img;
      const slug = slugOf(img);
      const post = slug && bySlug.get(slug);
      if (!post) return img;
      if (/class="[^"]*blog-inline/.test(img) || /class="[^"]*diagram/.test(img)) return img;
      if (/\/blog\/assets\/(?:inline|diagrams)\//.test(img)) return img;
      touched++;
      const attrs = keepFromImg(img);
      const withHero =
        /\bblog-hero\b/.test(img) && !/\bclass=/.test(attrs)
          ? `class="blog-hero" ${attrs}`.trim()
          : attrs || (role === 'hero' ? 'class="blog-hero" fetchpriority="high"' : 'loading="lazy"');
      return pictureBlock(post, { role, imgAttrs: withHero });
    }
  );

  return { out, touched };
}

function rewriteHead(html, post) {
  let s = html;
  const jpg = `${ORIGIN}${asset(post.slug, 'jpg')}`;

  const set = (re, replacement) => {
    if (re.test(s)) s = s.replace(re, replacement);
  };

  set(/(<meta property="og:image" content=")[^"]*(">)/, `$1${jpg}$2`);
  set(/(<meta property="og:image:width" content=")[^"]*(">)/, `$1${CANVAS.width}$2`);
  set(/(<meta property="og:image:height" content=")[^"]*(">)/, `$1${CANVAS.height}$2`);
  set(/(<meta property="og:image:alt" content=")[^"]*(">)/, `$1${esc(post.alt)}$2`);
  set(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${jpg}$2`);
  set(/(<meta name="twitter:image:alt" content=")[^"]*(">)/, `$1${esc(post.alt)}$2`);

  if (/<meta property="og:image:type"/.test(s)) {
    set(/(<meta property="og:image:type" content=")[^"]*(">)/, `$1image/jpeg$2`);
  } else if (/<meta property="og:image:height"/.test(s)) {
    s = s.replace(
      /(<meta property="og:image:height" content="[^"]*">)/,
      `$1\n<meta property="og:image:type" content="image/jpeg">`
    );
  } else if (/<meta property="og:image"/.test(s)) {
    s = s.replace(
      /(<meta property="og:image" content="[^"]*">)/,
      `$1\n<meta property="og:image:width" content="${CANVAS.width}">\n<meta property="og:image:height" content="${CANVAS.height}">\n<meta property="og:image:type" content="image/jpeg">`
    );
  }

  if (/<meta property="og:image:alt"/.test(s) === false && /<meta property="og:image"/.test(s)) {
    s = s.replace(
      /(<meta property="og:image" content="[^"]*">)/,
      `$1\n<meta property="og:image:alt" content="${esc(post.alt)}">`
    );
  }
  if (/<meta name="twitter:image:alt"/.test(s) === false && /<meta name="twitter:image"/.test(s)) {
    s = s.replace(
      /(<meta name="twitter:image" content="[^"]*">)/,
      `$1\n<meta name="twitter:image:alt" content="${esc(post.alt)}">`
    );
  }

  s = s.replace(
    /("image":\s*)(?:"[^"]*"|\[[^\]]*\])/g,
    (m, key) => (m.includes('/blog/assets/') ? `${key}["${jpg}"]` : m)
  );

  return s;
}

function rewriteSitemap(xml) {
  let s = xml;
  for (const post of POSTS) {
    const jpg = `${ORIGIN}${asset(post.slug, 'jpg')}`;
    s = s.replace(
      new RegExp(
        `<image:loc>${ORIGIN}/blog/assets/${post.slug}\\.(?:png|jpg|webp|svg)(?:\\?v=\\d+)?</image:loc>`,
        'g'
      ),
      `<image:loc>${jpg}</image:loc>`
    );
  }
  return s;
}

function collectInlines(html) {
  const found = [];
  const seen = new Set();
  const re = /(?:src|srcset)="(\/blog\/assets\/(?:inline|diagrams)\/[^"?#]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const abs = path.join(REPO, url.replace(/^\//, ''));
    found.push({
      url,
      purpose: url.includes('/diagrams/') ? 'science-diagram' : 'supporting-photo',
      exists: fs.existsSync(abs),
    });
  }
  return found;
}

function gradeOf(slug) {
  if (PRODUCT_PHOTO.has(slug)) return 'B';
  if (GRADE_D.has(slug)) return 'D';
  return 'C';
}

function sourceKind(post) {
  if (PRODUCT_PHOTO.has(post.slug)) return 'real-product-photo';
  return 'editorial-still';
}

function buildManifest(inlineBySlug) {
  const posts = POSTS.map((p) => {
    const jpg = `${ORIGIN}${asset(p.slug, 'jpg')}`;
    return {
      slug: p.slug,
      family: p.family,
      grade: gradeOf(p.slug),
      sourceKind: sourceKind(p),
      imagePurpose: 'hero + index card + og:image + schema image',
      filename: `blog/assets/${p.slug}.jpg`,
      width: CANVAS.width,
      height: CANVAS.height,
      format: ['jpg', 'webp', 'avif'],
      alt: p.alt,
      focal: p.focal,
      fit: p.fit || 'cover',
      hero: `/blog/assets/${p.slug}.jpg?v=${CACHE_V}`,
      thumbnail: `/blog/assets/${p.slug}.jpg?v=${CACHE_V}`,
      ogImage: jpg,
      schemaImage: jpg,
      inlineImages: inlineBySlug.get(p.slug) || [],
    };
  });

  return {
    version: CACHE_V,
    generated: '2026-09-05',
    principle: 'TEXT lives in HTML. VISUAL is a photograph or a genuine diagram. No overlay headlines.',
    canvas: CANVAS,
    families: {
      'fabric-problems': 'Close fabric, collars, underarms, wear',
      laundry: 'Washing, drying, storage, humidity',
      'real-life': 'Office, commute, meeting, travel, evening',
      science: 'Fibres, mechanisms, comparisons',
      product: 'ODORSTRIKE in authentic clothing situations',
    },
    counts: {
      articles: POSTS.length,
      A: posts.filter((p) => p.grade === 'A').length,
      B: posts.filter((p) => p.grade === 'B').length,
      C: posts.filter((p) => p.grade === 'C').length,
      D: posts.filter((p) => p.grade === 'D').length,
      inlineImages: posts.reduce((n, p) => n + p.inlineImages.length, 0),
    },
    posts,
    extraAssets: EXTRA_ASSETS.map((p) => ({
      slug: p.slug,
      family: p.family,
      note: 'Encoded photography for unpublished index cards. Not a live HTML guide.',
      alt: p.alt,
      filename: `blog/assets/${p.slug}.jpg`,
    })),
  };
}

function assertDeliveryAssets(post) {
  const missing = [];
  for (const ext of ['jpg', 'webp', 'avif']) {
    const p = path.join(BLOG, 'assets', `${post.slug}.${ext}`);
    if (!fs.existsSync(p)) missing.push(path.relative(REPO, p));
  }
  for (const w of WIDTHS.slice(1)) {
    for (const ext of ['webp', 'avif']) {
      const p = path.join(BLOG, 'assets', `${post.slug}@${w}.${ext}`);
      if (!fs.existsSync(p)) missing.push(path.relative(REPO, p));
    }
  }
  if (missing.length) {
    throw new Error(`missing encoded assets for ${post.slug}:\n  - ${missing.join('\n  - ')}`);
  }
}

function run() {
  validateConfig();
  validateConfig(EXTRA_ASSETS);
  const stale = [];
  let files = 0;
  let blocks = 0;
  const inlineBySlug = new Map();

  for (const post of POSTS) {
    assertDeliveryAssets(post);
    const file = path.join(BLOG, `${post.slug}.html`);
    if (!fs.existsSync(file)) {
      throw new Error(`no post markup for slug "${post.slug}" (${file})`);
    }
    const before = fs.readFileSync(file, 'utf8');

    if (!/max-image-preview:large/.test(before)) {
      throw new Error(
        `${post.slug}.html is missing max-image-preview:large — without it Discover ` +
          `only ever renders a small thumbnail`
      );
    }

    const { out, touched } = rewritePictures(before, 'hero');
    const after = rewriteHead(out, post);
    inlineBySlug.set(post.slug, collectInlines(after));
    blocks += touched;

    if (/<picture>(?:(?!<\/picture>).)*<picture>/s.test(after)) {
      throw new Error(`${post.slug}.html still has nested <picture> tags`);
    }

    if (after !== before) {
      stale.push(`blog/${post.slug}.html`);
      if (!CHECK) fs.writeFileSync(file, after);
    }
    files++;
  }

  const indexFile = path.join(BLOG, 'index.html');
  const idxBefore = fs.readFileSync(indexFile, 'utf8');
  const { out: idxAfter, touched: idxTouched } = rewritePictures(idxBefore, 'card');
  blocks += idxTouched;
  if (/<picture>(?:(?!<\/picture>).)*<picture>/s.test(idxAfter)) {
    throw new Error('blog/index.html still has nested <picture> tags');
  }
  if (idxAfter !== idxBefore) {
    stale.push('blog/index.html');
    if (!CHECK) fs.writeFileSync(indexFile, idxAfter);
  }

  const sitemapFile = path.join(REPO, 'sitemap.xml');
  const smBefore = fs.readFileSync(sitemapFile, 'utf8');
  const smAfter = rewriteSitemap(smBefore);
  if (smAfter !== smBefore) {
    stale.push('sitemap.xml');
    if (!CHECK) fs.writeFileSync(sitemapFile, smAfter);
  }

  for (const extra of EXTRA_ASSETS) assertDeliveryAssets(extra);

  const manifest = buildManifest(inlineBySlug);
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  if (CHECK) {
    if (!fs.existsSync(MANIFEST)) {
      stale.push('blog-image-manifest.json (missing)');
    } else if (fs.readFileSync(MANIFEST, 'utf8') !== manifestJson) {
      stale.push('blog-image-manifest.json');
    }
  } else {
    const before = fs.existsSync(MANIFEST) ? fs.readFileSync(MANIFEST, 'utf8') : '';
    if (before !== manifestJson) {
      fs.writeFileSync(MANIFEST, manifestJson);
      stale.push('blog-image-manifest.json');
    }
  }

  console.log(`${files} posts + index + sitemap · ${blocks} image blocks rebuilt at ?v=${CACHE_V}`);

  if (CHECK) {
    if (stale.length) {
      console.error(`\nstale (${stale.length}):\n  ${stale.join('\n  ')}`);
      process.exit(1);
    }
    console.log('up to date');
  } else if (stale.length) {
    console.log(`updated ${stale.length} file(s)`);
  } else {
    console.log('already up to date');
  }
}

try {
  run();
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
