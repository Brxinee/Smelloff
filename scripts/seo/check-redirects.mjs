#!/usr/bin/env node
/**
 * Prevents the classic GSC "Page with redirect" regression:
 * a URL that now has a real HTML page must never also be configured as a
 * permanent redirect. Old/deleted URLs may redirect; live pages must not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const errors = [];

for (const rule of config.redirects || []) {
  const source = rule.source;
  if (!source || source.includes(':') || source.includes('(') || source.includes('*') || source.includes('has')) continue;
  const candidate = source === '/' ? 'index.html' : `${source.replace(/^\//, '')}.html`;
  if (fs.existsSync(path.join(REPO, candidate))) {
    errors.push(`${source} -> ${rule.destination}: a real ${candidate} exists, so this URL must not redirect.`);
  }
}

if (errors.length) {
  console.error(`Redirect audit failed (${errors.length} live-page redirect(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Redirect audit passed: no literal redirect source maps to a live HTML page.');
