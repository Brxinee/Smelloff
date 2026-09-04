/**
 * Blog thumbnail encoder.
 *
 *   node scripts/thumbnails/build-thumbnails.mjs            # all posts
 *   node scripts/thumbnails/build-thumbnails.mjs <slug> ..  # only these
 *
 * Reads photography from THUMBNAIL_SOURCES (default .thumbnail-sources/)
 * and writes delivery formats with sharp — no text overlay:
 *
 *   blog/assets/<slug>.jpg          1920x1080  og:image / twitter:image / schema
 *   blog/assets/<slug>.webp         1920x1080  <picture>
 *   blog/assets/<slug>.avif         1920x1080  <picture>
 *   blog/assets/<slug>@1200.webp    1200x675   srcset
 *   blog/assets/<slug>@1200.avif    1200x675   srcset
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { POSTS, EXTRA_ASSETS, CANVAS, WIDTHS, validateConfig } from './thumbnails.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(REPO, 'blog', 'assets');
const SOURCES = process.env.THUMBNAIL_SOURCES || path.join(REPO, '.thumbnail-sources');
const PAD = '#080808';

function sourcePath(post) {
  const p = path.join(SOURCES, post.source);
  if (!fs.existsSync(p)) {
    throw new Error(
      `missing source ${post.source}\n` +
        `  looked in: ${SOURCES}\n` +
        `  drop the editorial still or real product photograph there`
    );
  }
  return p;
}

function parseFocal(focal = '50% 50%') {
  const [x, y] = String(focal)
    .split(/\s+/)
    .map((n) => Number(String(n).replace('%', '')) / 100);
  return {
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
  };
}

async function fitToCanvas(inputPath, post) {
  const img = sharp(inputPath, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const w = meta.width || CANVAS.width;
  const h = meta.height || CANVAS.height;

  if (post.fit === 'contain' || h > w) {
    return sharp(inputPath, { failOn: 'none' })
      .rotate()
      .resize(CANVAS.width, CANVAS.height, {
        fit: 'contain',
        background: PAD,
        kernel: 'lanczos3',
      })
      .toBuffer();
  }

  const { x, y } = parseFocal(post.focal);
  const targetRatio = CANVAS.width / CANVAS.height;
  const srcRatio = w / h;
  let extractW;
  let extractH;
  if (srcRatio > targetRatio) {
    extractH = h;
    extractW = Math.round(h * targetRatio);
  } else {
    extractW = w;
    extractH = Math.round(w / targetRatio);
  }
  const left = Math.max(0, Math.min(w - extractW, Math.round((w - extractW) * x)));
  const top = Math.max(0, Math.min(h - extractH, Math.round((h - extractH) * y)));

  return sharp(inputPath, { failOn: 'none' })
    .rotate()
    .extract({ left, top, width: extractW, height: extractH })
    .resize(CANVAS.width, CANVAS.height, { kernel: 'lanczos3' })
    .toBuffer();
}

async function encode(master, slug) {
  const written = [];
  for (const w of WIDTHS) {
    const suffix = w === WIDTHS[0] ? '' : `@${w}`;
    const h = Math.round((w / CANVAS.width) * CANVAS.height);
    const resized = () => sharp(master).resize(w, h, { kernel: 'lanczos3' });

    if (!suffix) {
      const p = path.join(OUT_DIR, `${slug}.jpg`);
      await resized().jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(p);
      written.push(p);
    }
    const wp = path.join(OUT_DIR, `${slug}${suffix}.webp`);
    await resized().webp({ quality: 80, effort: 4 }).toFile(wp);
    written.push(wp);

    const ap = path.join(OUT_DIR, `${slug}${suffix}.avif`);
    await resized().avif({ quality: 55, effort: 2 }).toFile(ap);
    written.push(ap);
  }
  return written;
}

async function main() {
  validateConfig();
  validateConfig(EXTRA_ASSETS);

  const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('-')));
  const all = [...POSTS, ...EXTRA_ASSETS];
  const posts = only.size ? all.filter((p) => only.has(p.slug)) : all;

  if (only.size) {
    const unknown = [...only].filter((s) => !all.some((p) => p.slug === s));
    if (unknown.length) {
      console.error(`Unknown slug(s): ${unknown.join(', ')}`);
      process.exit(1);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let bytes = 0;

  for (const post of posts) {
    const master = await fitToCanvas(sourcePath(post), post);
    const written = await encode(master, post.slug);
    const jpg = written.find((p) => p.endsWith('.jpg'));
    bytes += written.reduce((n, p) => n + fs.statSync(p).size, 0);
    console.log(
      `  ${post.slug.padEnd(52)} ${post.family.padEnd(18)} ${(fs.statSync(jpg).size / 1024).toFixed(0)}KB jpg`
    );
  }

  console.log(
    `\n${posts.length} thumbnails at ${CANVAS.width}x${CANVAS.height} · ${(bytes / 1024 / 1024).toFixed(1)}MB`
  );
  console.log('Next: node scripts/thumbnails/apply-thumbnails.mjs');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
