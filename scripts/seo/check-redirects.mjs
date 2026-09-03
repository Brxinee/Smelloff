#!/usr/bin/env node
/** Prevent accidental redirects of real live pages. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const allowedAliases = new Set(['/index', '/blog/index', '/solutions/index', '/odorstrike', '/shop']);
const errors = [];

function isRedirectStub(file) {
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return /noindex/i.test(html) && (/location\.replace\(/.test(html) || /http-equiv=["']refresh/i.test(html));
}

for (const rule of config.redirects || []) {
  const source = rule.source;
  if (!source || allowedAliases.has(source) || source.includes(':') || source.includes('(') || source.includes('*') || rule.has) continue;
  const candidate = source === '/' ? 'index.html' : `${source.replace(/^\//, '')}.html`;
  const file = path.join(REPO, candidate);
  if (fs.existsSync(file) && !isRedirectStub(file)) {
    errors.push(`${source} -> ${rule.destination}: live page ${candidate} exists`);
  }
}

if (errors.length) {
  console.error(`Redirect audit failed (${errors.length} issue(s))`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('Redirect audit passed.');
