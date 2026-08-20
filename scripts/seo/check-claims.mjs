#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const factsPath = path.join(REPO, 'data', 'brand-facts.json');
const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));

const prohibited = facts.products[0].claims.filter(c => c.status === 'PROHIBITED').map(c => c.claim.toLowerCase());

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources', '_shared', 'emails', 'data'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html') || entry.name.endsWith('.txt')) htmlFiles.push(full);
  }
}
walk(REPO);

let errors = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const claim of prohibited) {
    if (content.includes(claim)) {
      console.error(`[ERROR] PROHIBITED CLAIM FOUND in ${file}: "${claim}"`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`FAILED: ${errors} claim violations found.`);
  process.exit(1);
} else {
  console.log("Claim governance passed. No prohibited claims found.");
}
