#!/usr/bin/env node
/**
 * Keep public internal <a href> links on canonical URLs.
 *
 * Google can discover redirect variants from links that nobody intended to be
 * indexable: www/http hosts, trailing slashes, .html clean-URL variants and
 * retired slugs that are intentionally redirected by vercel.json.
 *
 * This script changes ONLY anchor hrefs. Canonical tags, hreflang, OG URLs,
 * JSON-LD URLs and external links are left alone.
 *
 *   node scripts/seo/normalize-internal-links.mjs
 *   node scripts/seo/normalize-internal-links.mjs --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');
const HOSTS = new Set(['smelloff.in', 'www.smelloff.in']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase',
  '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel',
]);

const vercel = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const redirects = new Map();
for (const rule of vercel.redirects || []) {
  if (!rule.source || !rule.destination) continue;
  // Pattern rules such as /r/:code are intentionally not treated as exact
  // redirects here because their runtime parameters must remain functional.
  if (/[:*+()]|\\[/.test(rule.source)) continue;
  redirects.set(rule.source, rule.destination);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = walk(REPO);

function decodePathPart(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function preserveSuffix(pathname, search, hash) {
  return pathname + search + hash;
}

function exactRedirectTarget(pathname) {
  let current = pathname;
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    if (seen.has(current)) return current;
    seen.add(current);
    const destination = redirects.get(current);
    if (!destination || !destination.startsWith('/')) return current;
    current = destination;
  }
  return current;
}

function normalizeHref(rawHref) {
  if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
    return rawHref;
  }

  let url;
  let sameOrigin = false;
  try {
    if (rawHref.startsWith('/')) {
      url = new URL(rawHref, 'https://smelloff.in');
      sameOrigin = true;
    } else if (/^https?:\/\//i.test(rawHref)) {
      url = new URL(rawHref);
      sameOrigin = HOSTS.has(url.hostname.toLowerCase());
    } else {
      return rawHref;
    }
  } catch {
    return rawHref;
  }

  if (!sameOrigin) return rawHref;

  let pathname = decodePathPart(url.pathname);
  if (pathname !== '/') pathname = pathname.replace(/\/+$/, '');

  // Remove clean-URL extension variants when the extensionless page actually
  // exists. This preserves unusual real .html assets while fixing /privacy.html,
  // /refund.html and old blog .html variants that Vercel redirects.
  if (/\.html$/i.test(pathname)) {
    const candidate = pathname.slice(0, -5) || '/';
    const candidateFile = candidate === '/'
      ? path.join(REPO, 'index.html')
      : path.join(REPO, candidate.slice(1) + '.html');
    if (fs.existsSync(candidateFile) || redirects.has(candidate)) pathname = candidate;
  }

  // Follow explicit legacy slug redirects to their final internal target.
  pathname = exactRedirectTarget(pathname);

  // Vercel's cleanUrls + trailingSlash:false make these canonical aliases.
  if (pathname === '/index') pathname = '/';
  if (pathname === '/blog/index') pathname = '/blog';
  if (pathname === '/solutions/index') pathname = '/solutions';
  if (pathname !== '/') pathname = pathname.replace(/\/+$/, '');

  // Use root-relative canonical links. This removes http://, www and apex
  // host variants from internal discovery without changing the destination.
  return preserveSuffix(pathname, url.search, url.hash);
}

const anchorHrefRe = /(<a\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'][^>]*>)/gi;
let totalChanged = 0;
let fileCount = 0;
const changes = [];

for (const file of htmlFiles) {
  const original = fs.readFileSync(file, 'utf8');
  let changedInFile = 0;
  const updated = original.replace(anchorHrefRe, (full, prefix, href, suffix) => {
    const normalized = normalizeHref(href);
    if (normalized === href) return full;
    changedInFile++;
    totalChanged++;
    changes.push(`${path.relative(REPO, file)}: ${href} -> ${normalized}`);
    return prefix + normalized + suffix;
  });

  if (updated !== original) {
    fileCount++;
    if (!CHECK) fs.writeFileSync(file, updated);
  }
}

console.log(`Scanned ${htmlFiles.length} HTML files.`);
console.log(`Canonicalized ${totalChanged} internal anchor href(s) across ${fileCount} file(s).`);

if (changes.length) {
  for (const line of changes.slice(0, 80)) console.log(`- ${line}`);
  if (changes.length > 80) console.log(`… ${changes.length - 80} more`);
}

if (CHECK && totalChanged > 0) {
  console.error('\nInternal-link canonicalization is stale — run: node scripts/seo/normalize-internal-links.mjs');
  process.exit(1);
}
