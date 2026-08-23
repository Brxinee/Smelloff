import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const HOSTS = new Set(['smelloff.in', 'www.smelloff.in']);
const redirectsConfig = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const redirects = new Set();
for (const rule of redirectsConfig.redirects || []) {
  // Only exact redirect sources are safe to classify statically.
  if (!rule.source || !rule.destination) continue;
  const isPattern = rule.source.includes(':') || rule.source.includes('*') ||
    rule.source.includes('+') || rule.source.includes('(') || rule.source.includes('[');
  if (!isPattern) redirects.add(rule.source);
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase',
  '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function cleanPath(p) {
  if (p === '/') return p;
  return p.replace(/\/+$/, '') || '/';
}

const htmlFiles = walk(REPO);
const errors = [];

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;

    let url;
    try {
      url = raw.startsWith('/') ? new URL(raw, 'https://smelloff.in') : /^https?:\/\//i.test(raw) ? new URL(raw) : null;
    } catch {
      continue;
    }
    if (!url || !HOSTS.has(url.hostname.toLowerCase())) continue;

    const pathname = cleanPath(url.pathname);

    if (redirects.has(pathname)) {
      errors.push(`${rel}: ${raw} -> explicit redirect ${pathname}`);
      continue;
    }
    if (/^\/policies\/(privacy|terms|returns|refund|shipping|cancellation|payment-failed)$/.test(pathname)) {
      errors.push(`${rel}: ${raw} -> policy alias`);
      continue;
    }
    if (/\.html$/i.test(pathname)) {
      const clean = pathname.slice(0, -5) || '/';
      const cleanFile = clean === '/' ? path.join(REPO, 'index.html') : path.join(REPO, clean.slice(1) + '.html');
      if (fs.existsSync(cleanFile) || redirects.has(clean)) {
        errors.push(`${rel}: ${raw} -> clean URL ${clean}`);
        continue;
      }
    }
    if (cleanPath(url.pathname) !== url.pathname) {
      errors.push(`${rel}: ${raw} -> trailing-slash variant`);
      continue;
    }
    if (/^\/(?:index|blog\/index|solutions\/index)$/.test(pathname)) {
      errors.push(`${rel}: ${raw} -> index alias`);
      continue;
    }
    if (/^https?:\/\/www\.smelloff\.in(?:[/?#]|$)/i.test(raw)) {
      errors.push(`${rel}: ${raw} -> www host variant`);
      continue;
    }
    if (/^http:\/\//i.test(raw)) {
      errors.push(`${rel}: ${raw} -> http host variant`);
      continue;
    }
  }
}

if (errors.length) {
  console.error(`Internal-link redirect audit failed (${errors.length} issue(s))`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`- ... ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`Internal-link redirect audit passed across ${htmlFiles.length} HTML files.`);
