#!/usr/bin/env node
/**
 * Remove assistant-only citation artifacts if they ever enter a static HTML
 * post. Real citations must be represented by normal hyperlinks in the page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG = path.join(REPO, 'blog');

let changed = 0;
for (const file of fs.readdirSync(BLOG).filter((name) => name.endsWith('.html'))) {
  const full = path.join(BLOG, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(/cite[^]+/g, '');
  if (after !== before) {
    fs.writeFileSync(full, after, 'utf8');
    changed += 1;
  }
}

console.log(`Blog citation sanitizer: ${changed} file(s) changed.`);
