/**
 * Wires the generated thumbnails into the blog markup.
 *
 *   node scripts/thumbnails/apply-thumbnails.mjs           # write
 *   node scripts/thumbnails/apply-thumbnails.mjs --check   # dry run, exits 1 if stale
 *
 * Idempotent, in the same spirit as scripts/apply-chrome.mjs: it REPLACES each
 * <picture> block rather than wrapping what it finds, so running it twice is a
 * no-op. The previous generator (scripts/build-blog-thumbnails.js) re-wrapped an
 * <img> that was already inside a <picture>, which is why every block on the
 * blog index had accumulated six <source> tags for two formats.
 *
 * Per the research's crawler checklist it keeps these in lockstep with the assets:
 *   - og:image / twitter:image  -> the 1920x1080 JPEG (never a logo or a square)
 *   - og:image:width/height     -> 1920 / 1080, so Discover can render a large card
 *   - JSON-LD Article "image"   -> a matching high-resolution array
 *   - <img width/height>        -> explicit, to hold CLS at zero
 *   - srcset/sizes              -> so phones fetch the 1200px step, not the 1920px one
 *
 * `max-image-preview:large` is already present in every post's robots meta; this
 * script asserts that rather than adding it, and fails loudly if one is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, CANVAS, WIDTHS, validateConfig } from './thumbnails.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG = path.join(REPO, 'blog');
const ORIGIN = 'https://smelloff.in';

/** Bump when the pixels change — /assets/* is served `immutable` for a year. */
const V = 4;

const CHECK = process.argv.includes('--check');
const bySlug = new Map(POSTS.map((p) => [p.slug, p]));

const asset = (slug, ext, w) =>
  `/blog/assets/${slug}${w && w !== WIDTHS[0] ? `@${w}` : ''}.${ext}?v=${V}`;

const srcset = (slug, ext) =>
  WIDTHS.slice()
    .sort((a, b) => a - b)
    .map((w) => `${asset(slug, ext, w)} ${w}w`)
    .join(', ');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * The hero runs the full article column; index cards run roughly a third of a
 * 1200px grid. Both collapse to full-bleed on phones.
 */
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

/** Pulls the slug out of whatever <img>/<source> the old block pointed at. */
function slugOf(block) {
  const m = block.match(/\/blog\/assets\/([a-z0-9-]+?)(?:@\d+)?\.(?:jpg|png|webp|avif)/i);
  return m ? m[1] : null;
}

function rewritePictures(html, role) {
  let touched = 0;
  const out = html.replace(/<picture>[\s\S]*?<\/picture>/g, (block) => {
    const slug = slugOf(block);
    const post = slug && bySlug.get(slug);
    if (!post) return block;

    // Carry the loading strategy and presentation from the block being replaced —
    // the hero is fetchpriority=high, index cards are lazy, and the article hero
    // has inline layout styles that belong to blog.css's territory, not ours.
    const img = block.match(/<img\b[^>]*>/)?.[0] ?? '';
    const keep = [];
    const cls = img.match(/\sclass="([^"]*)"/);
    if (cls) keep.push(`class="${cls[1]}"`);
    if (/\sfetchpriority="high"/.test(img)) keep.push('fetchpriority="high"');
    if (/\sloading="lazy"/.test(img)) keep.push('loading="lazy"');
    const style = img.match(/\sstyle="([^"]*)"/);
    if (style) keep.push(`style="${style[1]}"`);

    touched++;
    return pictureBlock(post, { role, imgAttrs: keep.join(' ') });
  });
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

  // og:image:type follows the format change from PNG to JPEG.
  if (/<meta property="og:image:type"/.test(s)) {
    set(/(<meta property="og:image:type" content=")[^"]*(">)/, `$1image/jpeg$2`);
  } else {
    s = s.replace(
      /(<meta property="og:image:height" content="[^"]*">)/,
      `$1\n<meta property="og:image:type" content="image/jpeg">`
    );
  }

  // JSON-LD Article image -> high-resolution array.
  s = s.replace(
    /("image":\s*)(?:"[^"]*"|\[[^\]]*\])/g,
    (m, key) => (m.includes('/blog/assets/') ? `${key}["${jpg}"]` : m)
  );

  return s;
}

/**
 * sitemap.xml carries an <image:image> per post. It pointed at the retired PNGs,
 * so image search and Discover were being handed a URL that no longer resolves.
 */
function rewriteSitemap(xml) {
  let s = xml;
  for (const post of POSTS) {
    const jpg = `${ORIGIN}${asset(post.slug, 'jpg')}`;
    s = s.replace(
      new RegExp(
        `<image:loc>${ORIGIN}/blog/assets/${post.slug}\\.(?:png|jpg|webp)(?:\\?v=\\d+)?</image:loc>`,
        'g'
      ),
      `<image:loc>${jpg}</image:loc>`
    );
  }
  return s;
}

function run() {
  validateConfig();
  const stale = [];
  let files = 0;
  let blocks = 0;

  for (const post of POSTS) {
    const file = path.join(BLOG, `${post.slug}.html`);
    if (!fs.existsSync(file)) {
      throw new Error(`no post markup for slug "${post.slug}" (${file})`);
    }
    const before = fs.readFileSync(file, 'utf8');

    if (!/max-image-preview:large/.test(before)) {
      throw new Error(
        `${post.slug}.html is missing max-image-preview:large — without it Discover ` +
          `only ever renders a small thumbnail, and every asset here is wasted`
      );
    }

    const { out, touched } = rewritePictures(before, 'hero');
    const after = rewriteHead(out, post);
    blocks += touched;

    if (after !== before) {
      stale.push(`blog/${post.slug}.html`);
      if (!CHECK) fs.writeFileSync(file, after);
    }
    files++;
  }

  // Blog index: cards only, no per-post head to rewrite.
  const indexFile = path.join(BLOG, 'index.html');
  const idxBefore = fs.readFileSync(indexFile, 'utf8');
  const { out: idxAfter, touched: idxTouched } = rewritePictures(idxBefore, 'card');
  blocks += idxTouched;
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

  console.log(`${files} posts + index + sitemap · ${blocks} <picture> blocks rebuilt at ?v=${V}`);

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
