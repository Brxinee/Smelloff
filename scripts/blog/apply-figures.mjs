#!/usr/bin/env node
/* In-article figures: one photo and one diagram per post, stamped between
   <!-- FIG:START n --> / <!-- FIG:END n --> markers from
   scripts/blog/figures.config.mjs.

   Each figure goes right after the first paragraph of the section it names
   (`after`: an <h2> id), so the section's answer comes first and the picture
   explains it. Diagrams are HTML, not images: they reflow on a phone, their
   text is real text (search, AI answers, screen readers, translation), and
   they take the site's tokens and fonts. Photos are <picture> AVIF/WebP sets
   built by build-figure-photos.mjs into blog/assets/inline/.

   Idempotent: every run removes the old blocks and stamps them again.
   `--check` exits 1 if any post would change (wired into npm run build).

   Content rule (CLAUDE.md): diagram copy restates what the post already
   says. Product facts only from config/product.json; no new claims. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURES, PHOTO_V } from './figures.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** `**bold**` inside short diagram strings, nothing else. */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export const PHOTO_WIDTHS = [640, 1200];
export const photoBase = (slug) => `/blog/assets/inline/${slug}`;

/* ------------------------------------------------------------- garments */
/* 200×240 outlines, stroke only. Zone markers are placed by name so a
   config entry says `zones: ['collar', 'underarms', 'upper back']`. */
const SHAPES = {
  shirt: 'M70 22 L100 34 L130 22 L170 40 L194 128 L170 136 L154 84 L154 226 L46 226 L46 84 L30 136 L6 128 L30 40 Z M70 22 L100 52 L130 22 M100 52 L100 226',
  kurta: 'M74 20 L100 30 L126 20 L166 36 L192 124 L170 132 L154 82 L160 234 L40 234 L46 82 L30 132 L8 124 L34 36 Z M88 24 L100 70 L112 24',
  tee: 'M72 24 Q100 44 128 24 L172 44 L190 92 L160 102 L152 82 L152 222 L48 222 L48 82 L40 102 L10 92 L28 44 Z',
  hoodie: 'M70 30 Q60 4 100 2 Q140 4 130 30 L172 46 L194 136 L170 142 L154 92 L154 226 L46 226 L46 92 L30 142 L6 136 L28 46 Z M80 30 Q100 54 120 30 M70 170 L130 170 L136 214 L64 214 Z',
  jacket: 'M66 20 L100 30 L134 20 L174 38 L196 130 L172 138 L156 86 L156 226 L44 226 L44 86 L28 138 L4 130 L26 38 Z M66 20 L86 96 L100 140 L114 96 L134 20 M100 140 L100 226',
  sweater: 'M74 22 Q100 40 126 22 L170 40 L192 168 L168 172 L154 86 L154 222 L46 222 L46 86 L32 172 L8 168 L30 40 Z M46 206 L154 206 M8 156 L32 160 M192 156 L168 160',
  trousers: 'M44 10 L156 10 L160 36 L172 232 L118 232 L102 82 L98 82 L82 232 L28 232 L40 36 Z M40 36 L160 36',
};
const SPOTS = {
  collar: [100, 34], neckline: [100, 32], hood: [100, 16],
  underarms: [[52, 92], [148, 92]], 'underarm lining': [[52, 92], [148, 92]],
  chest: [100, 104], 'front panel': [100, 120], 'upper back': [100, 74],
  'back lining': [100, 120], 'lower back': [100, 196], cuffs: [[22, 128], [178, 128]],
  'outer sleeves': [[34, 80], [166, 80]], shoulders: [[62, 40], [138, 40]], hem: [100, 210],
  waistband: [100, 22], 'inner thighs': [[86, 110], [114, 110]], 'back of knees': [[60, 170], [140, 170]],
  pockets: [[60, 50], [140, 50]], 'kangaroo pocket': [100, 192],
};
const BACK = new Set(['upper back', 'back lining', 'lower back']);

function zonesSvg(garment, zones) {
  const d = SHAPES[garment];
  if (!d) throw new Error(`unknown garment "${garment}"`);
  const dots = zones.map((z, i) => {
    const key = z.zone;
    const at = SPOTS[key];
    if (!at) throw new Error(`unknown zone "${key}" (known: ${Object.keys(SPOTS).join(', ')})`);
    const pts = Array.isArray(at[0]) ? at : [at];
    const back = BACK.has(key);
    return pts.map(([x, y]) =>
      `<g class="fx-z__pt${back ? ' is-back' : ''}"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 4}">${i + 1}</text></g>`
    ).join('');
  }).join('');
  return `<svg class="fx-z__svg" viewBox="0 0 200 240" aria-hidden="true" focusable="false"><path class="fx-z__shape" d="${d}"/>${dots}</svg>`;
}

/* ------------------------------------------------------------ renderers */
const head = (f) =>
  `<figcaption class="fx__head">${f.kicker ? `<span class="fx__kicker">${esc(f.kicker)}</span>` : ''}` +
  `<span class="fx__title">${esc(f.title)}</span></figcaption>`;
const note = (f) => (f.note ? `<p class="fx__note">${rich(f.note)}</p>` : '');

const R = {
  steps: (f) =>
    `<ol class="fx-steps" style="--n:${f.items.length}">` +
    f.items.map(([label, text]) => `<li><b>${esc(label)}</b><span>${rich(text)}</span></li>`).join('') +
    `</ol>`,

  compare: (f) =>
    `<div class="fx-cmp" style="--n:${f.cols.length}">` +
    f.cols.map((c) =>
      `<div class="fx-cmp__col${c.pick ? ' is-pick' : ''}"><p class="fx-cmp__name">${esc(c.name)}</p>` +
      (c.tag ? `<p class="fx-cmp__tag">${esc(c.tag)}</p>` : '') +
      `<ul>${c.lines.map((l) => `<li>${rich(l)}</li>`).join('')}</ul></div>`
    ).join('') + `</div>`,

  zones: (f) =>
    `<div class="fx-z">${zonesSvg(f.garment, f.zones)}<ol class="fx-z__list">` +
    f.zones.map((z) =>
      `<li><b>${esc(z.label || z.zone[0].toUpperCase() + z.zone.slice(1))}${BACK.has(z.zone) ? ' <em>(back)</em>' : ''}</b><span>${rich(z.text)}</span></li>`
    ).join('') + `</ol></div>`,

  timeline: (f) =>
    `<ol class="fx-tl">` +
    f.items.map(([t, text]) => `<li><time>${esc(t)}</time><span>${rich(text)}</span></li>`).join('') +
    `</ol>`,

  stats: (f) =>
    `<dl class="fx-stats" style="--n:${f.items.length}">` +
    f.items.map(([big, label]) => `<div><dt>${esc(big)}</dt><dd>${rich(label)}</dd></div>`).join('') +
    `</dl>`,

  scale: (f) =>
    `<div class="fx-scale"><div class="fx-scale__ends"><span>${esc(f.left)}</span><span>${esc(f.right)}</span></div>` +
    `<div class="fx-scale__bar" aria-hidden="true">` +
    f.items.map(([name, pos], i) => `<i style="--x:${pos}%">${i + 1}</i>`).join('') +
    `</div><ol class="fx-scale__list">` +
    f.items.map(([name, , text]) => `<li><b>${esc(name)}</b>${text ? `<span>${rich(text)}</span>` : ''}</li>`).join('') +
    `</ol></div>`,

  /* rows: [condition, verdict, tone]; tone: wash | refresh | air | stop | ok */
  decide: (f) =>
    `<ul class="fx-dec">` +
    f.rows.map(([cond, verdict, tone]) =>
      `<li><span class="fx-dec__if">${rich(cond)}</span><span class="fx-dec__then fx-t--${tone}">${esc(verdict)}</span></li>`
    ).join('') + `</ul>`,

  /* items: [label, value, display]; value is relative (max = 100%). */
  bars: (f) => {
    const max = Math.max(...f.items.map((i) => i[1]));
    return `<ul class="fx-bars">` +
      f.items.map(([label, v, shown, hi]) =>
        `<li${hi ? ' class="is-hi"' : ''}><span class="fx-bars__l">${esc(label)}</span><span class="fx-bars__b"><i style="--w:${((v / max) * 100).toFixed(1)}%"></i></span><span class="fx-bars__v">${esc(shown ?? v)}</span></li>`
      ).join('') + `</ul>`;
  },
};

function renderDiagram(f) {
  const body = R[f.type];
  if (!body) throw new Error(`unknown diagram type "${f.type}"`);
  return `<figure class="fx fx--${f.type}">${head(f)}${body(f)}${note(f)}</figure>`;
}

function renderPhoto(slug, f) {
  const base = photoBase(slug);
  for (const w of PHOTO_WIDTHS) for (const ext of ['avif', 'webp']) {
    const file = join(ROOT, `${base}@${w}.${ext}`.slice(1));
    if (!existsSync(file)) throw new Error(`${slug}: missing ${file} — run node scripts/blog/build-figure-photos.mjs ${slug}`);
  }
  const set = (ext) => PHOTO_WIDTHS.map((w) => `${base}@${w}.${ext}?v=${PHOTO_V} ${w}w`).join(', ');
  const sizes = '(min-width: 900px) 720px, calc(100vw - 40px)';
  return `<figure class="blog-figure fx-photo"><picture>` +
    `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">` +
    `<img src="${base}@1200.webp?v=${PHOTO_V}" alt="${esc(f.alt)}" width="1200" height="800" loading="lazy" decoding="async">` +
    `</picture><figcaption>${rich(f.caption)}</figcaption></figure>`;
}

/* --------------------------------------------------------------- stamping */
const BLOCK = /\n[ \t]*<!-- FIG:START \d+ [\s\S]*?<!-- FIG:END \d+ -->/g;

function stamp(html, slug, figs) {
  let out = html.replace(BLOCK, '');
  figs.forEach((f, i) => {
    const n = i + 1;
    // `after` may be an id prefix (ids run long); the first match wins.
    const h2 = out.indexOf(`<h2 id="${f.after}`);
    if (h2 < 0) throw new Error(`${slug}: no <h2 id="${f.after}…">`);
    const h2End = out.indexOf('</h2>', h2) + 5;
    const nextH2 = out.indexOf('<h2', h2End);
    const p = out.indexOf('</p>', h2End);
    // A section that opens with a table or list (no paragraph before the
    // next <h2>) gets the figure at its end instead.
    const noPara = p < 0 || (nextH2 > -1 && p > nextH2);
    if (noPara && nextH2 < 0) throw new Error(`${slug}: section "${f.after}" has no paragraph to follow`);
    // Don't land inside a callout, quick answer or list item: step out of
    // any element the paragraph is nested in, up to the section level.
    let at = noPara ? out.slice(0, nextH2).trimEnd().length : p + 4;
    const TAG = /<(\/?)(div|blockquote|li|ul|ol|table|aside|details)\b[^>]*>/g;
    let depth = 0;
    for (const m of out.slice(h2End, at).matchAll(TAG)) depth += m[1] ? -1 : 1;
    if (depth > 0) {
      TAG.lastIndex = at;
      let m;
      while (depth > 0 && (m = TAG.exec(out))) depth += m[1] ? -1 : 1;
      if (!m) throw new Error(`${slug}: unbalanced markup after "${f.after}"`);
      at = m.index + m[0].length;
    }
    const body = f.kind === 'photo' ? renderPhoto(slug, f) : renderDiagram(f);
    out = `${out.slice(0, at)}\n  <!-- FIG:START ${n} — generated by scripts/blog/apply-figures.mjs; edit scripts/blog/figures.config.mjs -->\n  ${body}\n  <!-- FIG:END ${n} -->${out.slice(at)}`;
  });
  return out;
}

function main() {
  let changed = 0;
  for (const [slug, figs] of Object.entries(FIGURES)) {
    const file = join(ROOT, 'blog', `${slug}.html`);
    if (!existsSync(file)) throw new Error(`figures.config.mjs: no post blog/${slug}.html`);
    const html = readFileSync(file, 'utf8');
    const next = stamp(html, slug, figs);
    if (next !== html) {
      changed += 1;
      if (CHECK) console.error(`stale figures: blog/${slug}.html`);
      else writeFileSync(file, next);
    }
  }
  if (CHECK && changed) {
    console.error(`${changed} post(s) out of date — run node scripts/blog/apply-figures.mjs`);
    process.exit(1);
  }
  console.log(`${Object.keys(FIGURES).length} posts · ${CHECK ? 'figures up to date' : `${changed} updated`}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
