import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const vercelJson = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const redirects = new Map();
if (vercelJson.redirects) {
  for (const r of vercelJson.redirects) {
    if (r.source && r.destination) {
      redirects.set(r.source, r.destination);
    }
  }
}

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(REPO);

console.log(`Scanning ${htmlFiles.length} HTML files...`);

const allHrefs = new Map(); // href -> set of files

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');

  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const m of matches) {
    const href = m[1];
    if (!allHrefs.has(href)) allHrefs.set(href, new Set());
    allHrefs.get(href).add(rel);
  }
}

console.log(`\n=== ALL HREFS FOUND (${allHrefs.size} unique) ===`);
for (const [href, files] of allHrefs.entries()) {
  if (href.startsWith('/') || href.includes('smelloff.in') || href.endsWith('.html') || (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:'))) {
    console.log(`Href: "${href}" (used in ${files.size} file(s))`);
    if (redirects.has(href)) {
      console.log(`  -> REDIRECTS to "${redirects.get(href)}"`);
    }
  }
}
