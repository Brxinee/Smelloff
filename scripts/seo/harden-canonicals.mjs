#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '..', 'solutions', 'index.html');
const CHECK = process.argv.includes('--check');

let html = fs.readFileSync(FILE, 'utf8');
const next = html.replace('https://smelloff.in/solutions/', 'https://smelloff.in/solutions');

if (CHECK) {
  if (next !== html) {
    console.error('Canonical drift detected in /solutions.');
    process.exit(1);
  }
  console.log('Canonical hardening: clean');
} else if (next !== html) {
  fs.writeFileSync(FILE, next);
  console.log('Canonical hardening applied: /solutions');
} else {
  console.log('Canonical hardening already clean.');
}
