#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '..', 'odorstrike.html');
const CHECK = process.argv.includes('--check');

const replacements = [
  [/50ml mist that kills sweat smell, gym odor, and shirt stink in seconds —/gi, '50ml fabric odor-control mist for sweat and clothing odor —'],
  [/kills sweat smell, gym odor, and shirt stink in seconds/gi, 'helps neutralize sweat and clothing odor'],
  [/How to Eliminate Odor from Clothes Instantly/g, 'How to Use a Fabric Odor Spray on Clothes'],
  [/Step-by-step guide to applying ODORSTRIKE fabric spray to eliminate sweat and food smells from clothing\./g, 'Step-by-step guide to applying ODORSTRIKE fabric spray to clothing fabric when you need between-wash odor control.'],
  [/and kills the smell instead of masking it/gi, 'and targets odor instead of simply masking it'],
  [/and kills the smell/gi, 'and targets odor'],
];

let html = fs.readFileSync(FILE, 'utf8');
let next = html;
for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);

if (CHECK) {
  if (next !== html) {
    console.error('Product claim SEO drift detected. Run npm run seo:claims.');
    process.exit(1);
  }
  console.log('Product claim SEO: clean');
} else if (next !== html) {
  fs.writeFileSync(FILE, next);
  console.log('Product claim SEO hardened.');
} else {
  console.log('Product claim SEO already clean.');
}
