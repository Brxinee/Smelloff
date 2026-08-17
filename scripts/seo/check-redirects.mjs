#!/usr/bin/env node
/** Prevent live HTML pages from being permanent redirects. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const errors = [];
for (const rule of config.redirects || []) {
  const source = rule.source;
  if (!source || source.includes(':') || source.includes('(') || source.includes('*') || rule.has) continue;
  const candidate = source === '/' ? 'index.html' : `${source.replace(/^\//, '')}.html`;
  if (fs.existsSync(path.join(REPO, candidate))) errors.push(`${source} -> ${rule.destination}: live page ${candidate} exists`);
}
if (errors.length) {
  console.error(`Redirect audit failed (${errors.length} issue(s))`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('Redirect audit passed.');
