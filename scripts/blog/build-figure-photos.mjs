#!/usr/bin/env node
/* Builds the in-article photos named in figures.config.mjs:

     blog/assets/inline/<slug>@640.{avif,webp}    640×427
     blog/assets/inline/<slug>@1200.{avif,webp}  1200×800

   3:2, cropped around `focal` ("x% y%", like object-position). Sources:
   `pexels: <id>` is fetched into THUMBNAIL_SOURCES (default
   .thumbnail-sources/, gitignored) on first use — Pexels licence: free
   commercial use, no attribution; `file:` is an owner photo in the repo.
   Only the outputs are committed, so `npm run build` never needs sources.

     node scripts/blog/build-figure-photos.mjs           # missing outputs only
     node scripts/blog/build-figure-photos.mjs --all     # rebuild every photo
     node scripts/blog/build-figure-photos.mjs <slug>..  # these posts

   Bump PHOTO_V in figures.config.mjs when pixels change (/assets is immutable). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { FIGURES } from './figures.config.mjs';
import { PHOTO_WIDTHS } from './apply-figures.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'blog', 'assets', 'inline');
const SOURCES = process.env.THUMBNAIL_SOURCES || path.join(REPO, '.thumbnail-sources');

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const only = new Set(args.filter((a) => !a.startsWith('--')));

function source(photo) {
  if (photo.file) return path.join(REPO, photo.file);
  const p = path.join(SOURCES, `pexels-${photo.pexels}.jpg`);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(SOURCES, { recursive: true });
    // curl, not fetch: it honours the HTTPS proxy in CI and dev containers.
    execFileSync('curl', ['-sSfL', '-m', '90', '-o', p,
      `https://images.pexels.com/photos/${photo.pexels}/pexels-photo-${photo.pexels}.jpeg?auto=compress&cs=srgb&w=2400`]);
    console.log(`  fetched Pexels ${photo.pexels}`);
  }
  return p;
}

async function build(slug, photo) {
  const img = sharp(source(photo)).rotate();
  const { width: W, height: H } = await img.metadata();
  const [fx, fy] = (photo.focal || '50% 50%').split(/\s+/).map((v) => parseFloat(v) / 100);
  let w = W, h = Math.round(W / 1.5);
  if (h > H) { h = H; w = Math.round(H * 1.5); }
  const left = Math.round((W - w) * fx), top = Math.round((H - h) * fy);
  const crop = await sharp(source(photo)).rotate().extract({ left, top, width: w, height: h }).toBuffer();
  for (const width of PHOTO_WIDTHS) {
    const height = Math.round(width / 1.5);
    const r = () => sharp(crop).resize(width, height, { kernel: 'lanczos3' });
    await r().avif({ quality: 52, effort: 5 }).toFile(path.join(OUT, `${slug}@${width}.avif`));
    await r().webp({ quality: 76, effort: 6 }).toFile(path.join(OUT, `${slug}@${width}.webp`));
  }
  if (w < 1200) console.warn(`  ${slug}: source crop is only ${w}px wide`);
}

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [slug, figs] of Object.entries(FIGURES)) {
  if (only.size && !only.has(slug)) continue;
  const photo = figs.find((f) => f.kind === 'photo');
  if (!photo) continue;
  const done = fs.existsSync(path.join(OUT, `${slug}@1200.webp`));
  if (done && !ALL && !only.size) continue;
  await build(slug, photo);
  n += 1;
  console.log(`  ${slug}`);
}
console.log(`${n} photo(s) built into blog/assets/inline/`);
