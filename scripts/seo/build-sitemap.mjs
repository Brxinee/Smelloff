#!/usr/bin/env node
/**
 * Generates sitemap.xml from the filesystem, so adding a page is enough to get
 * it crawled and nobody has to remember to hand-edit XML.
 *
 *   node scripts/seo/build-sitemap.mjs           # write
 *   node scripts/seo/build-sitemap.mjs --check   # dry run, exits 1 if stale
 *
 * WHAT IT FIXED WHEN IT WAS WRITTEN
 *   - /solutions/ was listed with a trailing slash. vercel.json sets
 *     trailingSlash:false, so that URL 308s to /solutions and Search Console
 *     files it under "Page with redirect" — a sitemap should never contain a
 *     URL that redirects. The URL builder below cannot emit one.
 *   - Six blog posts carried a lastmod up to five weeks in the FUTURE. Google
 *     discounts a future lastmod, and SEO audit item 1 in CLAUDE.md was closed
 *     on "all lastmod dates are valid past dates". Dates are now clamped to
 *     today, so it cannot regress no matter what a post's front matter says.
 *   - The homepage image caption still read "clothes, shoes, helmets and gear"
 *     — the last survivor of the 2026-08-02 clothing-only purge, which had been
 *     removed from all 24 pages but not from the sitemap. Captions are now
 *     derived from the page's own og: tags, so they cannot drift again.
 *
 * WHY lastmod IS NOT TAKEN FROM GIT
 * The obvious approach is `git log -1 --format=%cs -- <file>`. It does not work
 * on this repo: history was squashed, so every file reports the same date and
 * the sitemap would claim the entire site changed today. Precedence is instead:
 *
 *   1. JSON-LD `dateModified`      — editorial truth, and the AEO skill already
 *                                    requires bumping it on every edit
 *   2. `article:modified_time`     — same idea, OG flavour
 *   3. the lastmod already in sitemap.xml — preserves real history for the
 *                                    static pages that have neither
 *   4. today
 *
 * ...and the result is clamped to today in every case.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ORIGIN = 'https://smelloff.in';
const CHECK = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);

/* Directories that never contain a crawlable page. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase',
  '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel',
]);

/* Ranking hints. First matching rule wins, so order matters. */
const RULES = [
  [/^\/$/,                       { priority: '1.0',  changefreq: 'weekly'  }],
  [/^\/odorstrike$/,             { priority: '1.0',  changefreq: 'weekly'  }],
  [/^\/blog$/,                   { priority: '0.8',  changefreq: 'weekly'  }],
  [/^\/blog\//,                  { priority: '0.8',  changefreq: 'monthly' }],
  [/^\/solutions$/,              { priority: '0.9',  changefreq: 'weekly'  }],
  [/^\/solutions\//,             { priority: '0.85', changefreq: 'weekly'  }],
  [/^\/reviews$/,                { priority: '0.7',  changefreq: 'weekly'  }],
  [/^\/faq$/,                    { priority: '0.7',  changefreq: 'monthly' }],
  [/^\/about$/,                  { priority: '0.6',  changefreq: 'yearly'  }],
  [/.*/,                         { priority: '0.5',  changefreq: 'yearly'  }],
];

/* Per-URL overrides for the handful of pages whose weight is an editorial call
 * rather than a function of where they sit. Kept tiny on purpose. */
const PRIORITY_OVERRIDES = {
  '/blog/odorstrike-review-30-day-india-test': '0.85',
  '/blog/odorstrike-vs-febreze-india': '0.85',
  '/blog/why-i-built-odorstrike': '0.7',
};

function decodeEntities(s) {
  const ent = (name) => '&' + name + ';';
  return String(s)
    .replaceAll(ent('amp'), '&')
    .replaceAll(ent('quot'), '"')
    .replaceAll('&#39;', "'")
    .replaceAll(ent('apos'), "'")
    .replaceAll(ent('lt'), '<')
    .replaceAll(ent('gt'), '>');
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Every .html file that isn't in a skipped directory. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * File path -> canonical URL path, honouring vercel.json's
 * `cleanUrls: true` + `trailingSlash: false`. This is the only place a URL is
 * constructed, which is what guarantees no trailing slash ever ships again.
 */
function urlPathFor(file) {
  let rel = path.relative(REPO, file).split(path.sep).join('/');
  rel = rel.replace(/\.html$/, '');
  if (rel === 'index') return '/';
  rel = rel.replace(/\/index$/, '');
  return '/' + rel;
}

const meta = (html, re) => (html.match(re) || [null, ''])[1].trim();

function shouldIndex(html, urlPath) {
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) return false;
  // Search Console site-verification stubs are not content.
  if (/^\/google[0-9a-f]{16,}$/.test(urlPath)) return false;
  if (urlPath === '/404') return false;
  return true;
}

/**
 * lastmod is the LATEST of what the page claims and what the sitemap already
 * said, then clamped to today.
 *
 * Taking the page's date alone would move several posts BACKWARDS: they were
 * edited on 2026-07-29 (the chrome pass) without anyone bumping the JSON-LD
 * dateModified, so the sitemap legitimately knew about a change the markup
 * didn't. A lastmod that goes backwards tells Google the page got older, which
 * is worse than a slightly stale one. max() can only ever move it forward.
 */
function lastmodFor(html, urlPath, previous) {
  const claimed = [
    meta(html, /"dateModified":\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})/),
    meta(html, /<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([0-9-]{10})/),
    previous.get(urlPath) || '',
  ].filter(Boolean);
  const picked = claimed.length ? claimed.reduce((a, b) => (a > b ? a : b)) : TODAY;
  // Never emit a future date — Google discounts it and it regresses audit item 1.
  return picked > TODAY ? TODAY : picked;
}

/**
 * Image entry from the page's own OG tags, so it can never drift from them.
 *
 * Only pages with their OWN artwork get one. 15 pages share
 * /assets/og-image.jpg as a house default, and listing that same file 15 times
 * is noise in an image sitemap, not coverage — Google is being asked to index
 * one image, not fifteen pages that happen to reference it. Uniqueness is
 * measured across the site rather than hardcoded, so a page that gains its own
 * artwork starts appearing without anyone editing this file.
 */
function imageFor(html, shared) {
  const loc = meta(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/);
  if (!loc || !loc.startsWith('http') || shared.has(loc)) return null;
  const title = decodeEntities(meta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/));
  const alt = decodeEntities(meta(html, /<meta[^>]+property=["']og:image:alt["'][^>]+content=["']([^"']+)/));
  return { loc, title, caption: alt };
}

/** lastmod values already in sitemap.xml, so static pages keep real history. */
function previousLastmods() {
  const map = new Map();
  const file = path.join(REPO, 'sitemap.xml');
  if (!fs.existsSync(file)) return map;
  const xml = fs.readFileSync(file, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    map.set(m[1].replace(ORIGIN, '').replace(/\/$/, '') || '/', m[2]);
  }
  return map;
}

function build() {
  const previous = previousLastmods();
  const entries = [];

  const pages = walk(REPO)
    .map((file) => ({ file, html: fs.readFileSync(file, 'utf8'), urlPath: urlPathFor(file) }))
    .filter((p) => shouldIndex(p.html, p.urlPath));

  // og:image URLs that appear on more than one page are house defaults, not
  // page artwork. See imageFor().
  const counts = new Map();
  for (const p of pages) {
    const loc = meta(p.html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/);
    if (loc) counts.set(loc, (counts.get(loc) || 0) + 1);
  }
  const shared = new Set([...counts].filter(([, n]) => n > 1).map(([loc]) => loc));

  for (const { html, urlPath } of pages) {

    const rule =
      RULES.find(([re]) => re.test(urlPath))[1];
    entries.push({
      loc: ORIGIN + (urlPath === '/' ? '/' : urlPath),
      lastmod: lastmodFor(html, urlPath, previous),
      changefreq: rule.changefreq,
      priority: PRIORITY_OVERRIDES[urlPath] || rule.priority,
      image: imageFor(html, shared),
      sort: [urlPath === '/' ? 0 : urlPath.startsWith('/odorstrike') ? 1
            : urlPath.startsWith('/blog') ? 2 : urlPath.startsWith('/solutions') ? 3 : 4, urlPath],
    });
  }

  entries.sort((a, b) =>
    a.sort[0] - b.sort[0] || a.sort[1].localeCompare(b.sort[1]));

  const body = entries.map((e) => {
    const img = e.image
      ? `\n    <image:image>\n      <image:loc>${esc(e.image.loc)}</image:loc>` +
        (e.image.title ? `\n      <image:title>${esc(e.image.title)}</image:title>` : '') +
        (e.image.caption ? `\n      <image:caption>${esc(e.image.caption)}</image:caption>` : '') +
        `\n    </image:image>`
      : '';
    return (
      `  <url>\n` +
      `    <loc>${e.loc}</loc>\n` +
      `    <lastmod>${e.lastmod}</lastmod>\n` +
      `    <changefreq>${e.changefreq}</changefreq>\n` +
      `    <priority>${e.priority}</priority>${img}\n` +
      `  </url>`
    );
  }).join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- GENERATED by scripts/seo/build-sitemap.mjs — do not hand-edit.\n` +
    `     Add a page and re-run; noindex pages are skipped automatically. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `${body}\n</urlset>\n`;

  /* Guard rails. These are the failures that actually cost coverage in Search
   * Console, so they stop the build rather than warn. */
  const errors = [];
  for (const e of entries) {
    if (e.lastmod > TODAY) errors.push(`${e.loc}: future lastmod ${e.lastmod}`);
    if (e.loc !== ORIGIN + '/' && e.loc.endsWith('/')) {
      errors.push(`${e.loc}: trailing slash will 308 under trailingSlash:false`);
    }
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.loc)) errors.push(`${e.loc}: duplicate`);
    seen.add(e.loc);
  }
  if (errors.length) {
    throw new Error(`sitemap validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return { xml, count: entries.length, withImages: entries.filter((e) => e.image).length };
}

const { xml, count, withImages } = build();
if (count >= 45000) console.warn("WARNING: Approaching 50,000 URL limit for a single sitemap. Prepare to implement sitemap index splitting.");
const target = path.join(REPO, 'sitemap.xml');
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';

console.log(`${count} URLs · ${withImages} with images · lastmod capped at ${TODAY}`);

if (xml !== current) {
  if (CHECK) {
    console.log('\nsitemap.xml is stale — run: node scripts/seo/build-sitemap.mjs');
    process.exit(1);
  }
  fs.writeFileSync(target, xml);
  console.log('sitemap.xml updated');
} else {
  console.log('up to date');
}
