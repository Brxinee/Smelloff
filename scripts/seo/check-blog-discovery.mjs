#!/usr/bin/env node
/**
 * Verify that every published blog HTML file is discoverable from the blog index.
 * This protects organic discovery when new guides are added.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG = path.join(REPO, 'blog');
const INDEX = path.join(BLOG, 'index.html');

const pages = fs.readdirSync(BLOG)
  .filter((name) => name.endsWith('.html') && name !== 'index.html')
  .map((name) => `/blog/${name.replace(/\.html$/i, '')}`)
  .sort();

const html = fs.readFileSync(INDEX, 'utf8');
const missing = pages.filter((url) => !html.includes(`href="${url}"`));

if (missing.length) {
  console.error(`Blog discovery check failed: ${missing.length} page(s) are not linked from /blog/.`);
  for (const url of missing) console.error(`- ${url}`);
  process.exit(1);
}

console.log(`Blog discovery check: clean (${pages.length} published guides linked).`);
