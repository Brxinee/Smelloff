#!/usr/bin/env node
/** Crawl/index safety audit for Smelloff. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ORIGIN = 'https://smelloff.in';
const SKIP = new Set(['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '_shared', 'emails', 'admin', 'outreach', '.vercel', '.thumbnail-sources']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(full, out);
    } else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function urlPathFor(file) {
  let rel = path.relative(REPO, file).split(path.sep).join('/').replace(/\.html$/, '');
  if (rel === 'index') return '/';
  rel = rel.replace(/\/index$/, '');
  return `/${rel}`;
}

function isIndexable(html, urlPath) {
  if (urlPath === '/404') return false;
  if (/google-site-verification:/i.test(html)) return false;
  return !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function canonical(html) {
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [null, ''])[1];
}

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

const pages = walk(REPO).map(file => ({ file, html: fs.readFileSync(file, 'utf8'), urlPath: urlPathFor(file) }));
const indexable = pages.filter(p => isIndexable(p.html, p.urlPath));
const pageMap = new Map(indexable.map(p => [ORIGIN + p.urlPath, p]));
const urls = sitemapUrls();
const errors = [];

for (const page of indexable) {
  const wanted = ORIGIN + page.urlPath;
  const got = canonical(page.html);
  if (!got) errors.push(`${page.urlPath}: missing canonical`);
  else if (got !== wanted) errors.push(`${page.urlPath}: canonical is ${got}, expected ${wanted}`);
}

for (const loc of urls) {
  if (!pageMap.has(loc)) errors.push(`sitemap URL is not an indexable local page: ${loc}`);
  if (loc !== ORIGIN + '/' && /\/$/.test(loc)) errors.push(`sitemap URL is non-canonical: ${loc}`);
}

if (new Set(urls).size !== urls.length) errors.push('sitemap contains duplicate <loc> values');

if (errors.length) {
  console.error(`Indexability audit failed (${errors.length} issue(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Indexability audit passed: ${indexable.length} indexable HTML pages, ${urls.length} sitemap URLs.`);
