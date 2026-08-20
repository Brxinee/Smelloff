#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources', '_shared', 'emails'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(REPO);

let drift = false;

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  let html = fs.readFileSync(file, 'utf8');

  // Replace trailing slashes in canonical tags or breadcrumbs (except root https://smelloff.in/)
  const next = html
    .replace(/href=["']https:\/\/smelloff\.in\/([a-zA-Z0-9_-]+)\/["']/g, 'href="https://smelloff.in/$1"')
    .replace(/"item":\s*"https:\/\/smelloff\.in\/([a-zA-Z0-9_-]+)\/"/g, '"item": "https://smelloff.in/$1"');

  if (next !== html) {
    if (CHECK) {
      console.error(`Canonical / Breadcrumb trailing-slash drift detected in ${rel}`);
      drift = true;
    } else {
      fs.writeFileSync(file, next);
      console.log(`Canonical hardening applied to ${rel}`);
    }
  }
}

if (CHECK && drift) {
  process.exit(1);
} else if (!drift) {
  console.log('Canonical hardening: clean across all HTML files.');
}
