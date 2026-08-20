#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

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

let errors = 0;

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');

  // Check for blocking scripts in head
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const head = headMatch[1];
    const scriptMatches = head.matchAll(/<script\s+([^>]+)>/gi);
    for (const m of scriptMatches) {
      const attrs = m[1].toLowerCase();
      if (!attrs.includes('defer') && !attrs.includes('async') && !attrs.includes('type="application/ld+json"') && !attrs.includes('type="module"')) {
        console.error(`[ERROR] Blocking script found in <head> of ${rel}: ${m[0]}`);
        errors++;
      }
    }
  }

  // Check for img width/height
  const imgMatches = html.matchAll(/<img\s+([^>]+)>/gi);
  for (const m of imgMatches) {
    const attrs = m[1].toLowerCase();
    // Exclude tracking pixels
    if (attrs.includes('height="1"') && attrs.includes('width="1"')) continue;
    
    if (!attrs.includes('width=') || !attrs.includes('height=')) {
      console.error(`[ERROR] Missing width/height on <img> in ${rel}: ${m[0]}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\nFAILED: Found ${errors} performance anti-patterns.`);
  process.exit(1);
} else {
  console.log('PASSED: Static performance analysis clean.');
}
