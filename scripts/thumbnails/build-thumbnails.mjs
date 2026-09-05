/**
 * Blog thumbnail compositor.
 *
 *   node scripts/thumbnails/build-thumbnails.mjs            # all posts
 *   node scripts/thumbnails/build-thumbnails.mjs <slug> ..  # only these
 *
 * Renders each entry in thumbnails.config.mjs to a 1920x1080 (16:9) card in
 * headless Chromium, then encodes the delivery formats with sharp:
 *
 *   blog/assets/<slug>.jpg          1920x1080  og:image / twitter:image / schema
 *   blog/assets/<slug>.webp         1920x1080  in-page <picture>
 *   blog/assets/<slug>.avif         1920x1080  in-page <picture>
 *   blog/assets/<slug>@1200.webp    1200x675   srcset step
 *   blog/assets/<slug>@1200.avif    1200x675   srcset step
 *
 * Why raw Chromium and not Playwright: this repo has no browser-automation
 * dependency and scripts/build_thumbnails.py already drives Chromium directly.
 * Keeping that means `npm install` stays three packages.
 *
 * SOURCE PHOTOGRAPHY is licensed Adobe Stock, read from THUMBNAIL_SOURCES
 * (default .thumbnail-sources/, gitignored — the originals are 5-15MB each and
 * have no business in the repo). Each file is named "<assetId>.jpg". Re-fetch
 * them with the Adobe connector: license asset id -> download -> drop in that
 * folder. See docs/BLOG-THUMBNAILS.md.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { POSTS, CANVAS, WIDTHS, validateConfig } from './thumbnails.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FONTS = path.join(REPO, 'assets', 'fonts');
const OUT_DIR = path.join(REPO, 'blog', 'assets');
const SOURCES = process.env.THUMBNAIL_SOURCES || path.join(REPO, '.thumbnail-sources');

/** Render at 2x and downsample — Chromium's text rasterisation is noticeably
 *  cleaner resampled down than rendered 1:1 at this size. */
const SCALE = 2;

/**
 * `--window-size` sizes the WINDOW, not the viewport: headless Chromium still
 * reserves its chrome, so roughly the bottom 90 CSS px of the page never make it
 * into --screenshot. Render into a taller window and crop the canvas back out.
 * (scripts/build_thumbnails.py never tripped over this because its card was
 * inset from the bottom edge — the site wordmark here is not.)
 */
const VIEWPORT_PAD = 240;

const CHROME =
  process.env.CHROME ||
  [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p));

const fileUrl = (p) => pathToFileURL(p).href;

/* ---------------------------------------------------------------- template */

/**
 * Fits the headline to the text column. Fraunces 900 runs about 0.52em average
 * advance, and the column is 720px at 1920 wide; solving for the longer of the
 * two lines keeps both on one line each without hyphenation or wrapping.
 */
function headlineSize(top, hi) {
  const longest = Math.max(top.length, hi.length);
  return Math.round(Math.max(74, Math.min(132, 720 / (longest * 0.5) * 1.06)));
}

function template({ kicker, top, hi, photo, focal, tone }) {
  const photoPath = path.join(SOURCES, `${photo}.jpg`);
  if (!fs.existsSync(photoPath)) {
    throw new Error(
      `missing source photo ${photo}.jpg\n` +
        `  looked in: ${SOURCES}\n` +
        `  license it from Adobe Stock (asset id ${photo}) and save it there — see docs/BLOG-THUMBNAILS.md`
    );
  }

  const size = headlineSize(top, hi);
  const F = (n) => fileUrl(path.join(FONTS, n));

  return `<!doctype html><html><head><meta charset="utf-8"><style>
/* Fraunces is the variable face (400..900); the rupee subset carries U+20B9,
   which the latin file does not — "Worth ₹229?" needs both declared. */
@font-face{font-family:'Fraunces';font-weight:400 900;font-style:normal;
  src:url('${F('fraunces-normal-latin-400.woff2')}') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+FEFF,U+FFFD;}
@font-face{font-family:'Fraunces';font-weight:400 900;font-style:normal;
  src:url('${F('fraunces-normal-rupee-400.woff2')}') format('woff2');unicode-range:U+20B9;}
@font-face{font-family:'JetBrains Mono';font-weight:400;font-style:normal;
  src:url('${F('jetbrains-mono-normal-latin-400.woff2')}') format('woff2');}

*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${CANVAS.width}px;height:${CANVAS.height}px;overflow:hidden;background:#080808}
.stage{position:relative;width:${CANVAS.width}px;height:${CANVAS.height}px;background:#080808;overflow:hidden}

/* --- photography: anchored right, bled off the top/bottom/right edges ----- */
.shot{position:absolute;inset:0 0 0 34%;overflow:hidden}
.shot img{width:100%;height:100%;object-fit:cover;object-position:${focal};display:block;filter:${tone || 'none'}}
/* blend the photo's left edge into the ink so there is no hard seam or border
   (the research flags artificial coloured borders as commercial noise) */
.shot::after{content:'';position:absolute;inset:0;background:
  linear-gradient(90deg,#080808 0%,rgba(8,8,8,.97) 14%,rgba(8,8,8,.72) 30%,rgba(8,8,8,.28) 48%,rgba(8,8,8,0) 66%)}
/* keep the bottom third weighted so the wordmark always has contrast under it */
.vig{position:absolute;inset:0;background:
  radial-gradient(120% 85% at 78% 38%,rgba(184,255,87,.10),transparent 58%),
  linear-gradient(0deg,rgba(8,8,8,.72) 0%,rgba(8,8,8,0) 34%)}
/* film grain — "dark, textured background" reads as editorial, not as a flat export */
.grain{position:absolute;inset:0;opacity:.055;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* --- type ---------------------------------------------------------------- */
.copy{position:absolute;left:96px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center;z-index:4}
.kicker{font-family:'JetBrains Mono',monospace;font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:#B8FF57;margin-bottom:30px;display:flex;align-items:center;gap:18px}
.kicker::before{content:'';width:52px;height:3px;background:#B8FF57;flex:none}
.head{font-family:'Fraunces',Georgia,serif;font-weight:900;font-size:${size}px;line-height:.98;letter-spacing:-.022em;color:#F4F1EA;text-wrap:balance}
.head .hi{color:#B8FF57;display:block}
.mark{position:absolute;left:96px;bottom:64px;line-height:1.4;font-family:'JetBrains Mono',monospace;font-size:23px;letter-spacing:.2em;text-transform:uppercase;color:#9A958D;z-index:4}
.mark b{color:#F4F1EA;font-weight:400}
</style></head><body><div class="stage">
  <div class="shot"><img src="${fileUrl(photoPath)}" alt=""></div>
  <div class="vig"></div><div class="grain"></div>
  <div class="copy">
    <div class="kicker">${esc(kicker)}</div>
    <div class="head">${esc(top)}<span class="hi">${esc(hi)}</span></div>
  </div>
  <div class="mark"><b>smelloff.in</b> &nbsp;/&nbsp; ODORSTRIKE</div>
</div></body></html>`;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ render */

function renderPng(html, outPng) {
  const tmpHtml = path.join(os.tmpdir(), `sf-thumb-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html);
  try {
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-lcd-text', // grayscale AA survives the downsample; subpixel AA fringes
        `--force-device-scale-factor=${SCALE}`,
        `--window-size=${CANVAS.width},${CANVAS.height + VIEWPORT_PAD}`,
        `--screenshot=${outPng}`,
        fileUrl(tmpHtml),
      ],
      { stdio: 'ignore' }
    );
  } finally {
    fs.unlinkSync(tmpHtml);
  }
}

async function encode(pngPath, slug) {
  const written = [];
  // Crop the canvas out of the padded viewport, then downsample from 2x.
  const master = await sharp(pngPath)
    .extract({ left: 0, top: 0, width: CANVAS.width * SCALE, height: CANVAS.height * SCALE })
    .resize(CANVAS.width, CANVAS.height, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  for (const w of WIDTHS) {
    const suffix = w === WIDTHS[0] ? '' : `@${w}`;
    const h = Math.round((w / CANVAS.width) * CANVAS.height);
    const resized = () => sharp(master).resize(w, h, { kernel: 'lanczos3' });

    // JPEG only for the canonical width — it is the og:image, and social
    // scrapers are the one audience that still can't be trusted with WebP.
    if (!suffix) {
      const p = path.join(OUT_DIR, `${slug}.jpg`);
      await resized().jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(p);
      written.push(p);
    }
    const wp = path.join(OUT_DIR, `${slug}${suffix}.webp`);
    await resized().webp({ quality: 80, effort: 6 }).toFile(wp);
    written.push(wp);

    const ap = path.join(OUT_DIR, `${slug}${suffix}.avif`);
    await resized().avif({ quality: 58, effort: 5 }).toFile(ap);
    written.push(ap);
  }
  return written;
}

/* -------------------------------------------------------------------- main */

async function main() {
  if (!CHROME) {
    console.error('No Chromium binary found. Set $CHROME to one.');
    process.exit(1);
  }
  validateConfig();

  const only = new Set(process.argv.slice(2));
  const posts = only.size ? POSTS.filter((p) => only.has(p.slug)) : POSTS;

  if (only.size) {
    const unknown = [...only].filter((s) => !POSTS.some((p) => p.slug === s));
    if (unknown.length) {
      console.error(`Unknown slug(s): ${unknown.join(', ')}`);
      process.exit(1);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-thumbs-'));
  let bytes = 0;

  for (const post of posts) {
    const raw = path.join(scratch, `${post.slug}.png`);
    renderPng(template(post), raw);
    const written = await encode(raw, post.slug);
    fs.unlinkSync(raw);

    const jpg = written.find((p) => p.endsWith('.jpg'));
    bytes += written.reduce((n, p) => n + fs.statSync(p).size, 0);
    const overlay = `${post.top} ${post.hi}`;
    console.log(
      `  ${post.slug.padEnd(52)} ${String(overlay).padEnd(30)} ${(fs.statSync(jpg).size / 1024).toFixed(0)}KB jpg`
    );
  }

  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(
    `\n${posts.length} thumbnails at ${CANVAS.width}x${CANVAS.height} · ${(bytes / 1024 / 1024).toFixed(1)}MB across ${WIDTHS.length * 2 + 1} files each`
  );
  console.log('Next: node scripts/thumbnails/apply-thumbnails.mjs');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
