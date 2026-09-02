#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '..', 'odorstrike.html');
const CHECK = process.argv.includes('--check');

const replacements = [
  [/Pocket fabric odor spray for clothes — not a perfume, not a deo\. Kills sweat smell in seconds, up to 8 hours protection\./gi, 'Pocket fabric odor spray for clothes — not a perfume, not a deodorant. Designed for between-wash clothing odor control with a current public claim of up to 8 hours on fabric.'],
  [/Pocket fabric odor spray for clothes\. Not perfume\. Not deodorant\. Not body spray\. Kills sweat smell in seconds — up to 8 hours odor protection on fabric\./gi, 'Pocket fabric odor spray for clothes. Not perfume. Not deodorant. Not body spray. Designed for between-wash clothing odor control with up to 8 hours of odor protection on fabric under normal office/commute conditions as a current public claim.'],
  [/50ml mist that kills sweat smell, gym odor, and shirt stink in seconds —/gi, '50ml fabric odor-control mist for sweat and clothing odor —'],
  [/kills sweat smell, gym odor, and shirt stink in seconds/gi, 'helps neutralize sweat and clothing odor'],
  [/How to Eliminate Odor from Clothes Instantly/g, 'How to Use a Fabric Odor Spray on Clothes'],
  [/Step-by-step guide to applying ODORSTRIKE fabric spray to eliminate sweat and food smells from clothing\./g, 'Step-by-step guide to applying ODORSTRIKE fabric spray to clothing fabric when you need between-wash odor control.'],
  [/and kills the smell instead of masking it/gi, 'and targets odor instead of simply masking it'],
  [/and kills the smell/gi, 'and targets odor'],
  [/A pocket-sized fabric odor eliminator mist\. Kills smell on contact\. Not a perfume, not a deodorant\./gi, 'A pocket-sized fabric odor-control mist for clothing. Not a perfume, not a deodorant.'],
  [/"D2C men's grooming brand from Hyderabad\. Maker of ODORSTRIKE — a pocket-sized fabric odor remover spray\."/g, '"Hyderabad-based maker of ODORSTRIKE — a pocket-sized fabric odor remover spray for clothing."'],
  [/("knowsAbout":\[[^\]]*)"cyclodextrin",\s*"zinc pca",/g, '$1'],
  [/("description":)"A pocket-sized fabric odor remover spray\. 50ml mist that kills sweat smell, gym odor, and shirt stink in seconds —[^\n]*?Fabric-only\. Works on cotton, polyester, denim, and wool\."/g, '$1"A pocket-sized 50ml fabric odor remover spray for clothing. Fabric-only and designed for between-wash odor control. Current public claim: up to 8 hours of odor protection on fabric under normal office/commute conditions. Not perfume. Not deodorant."'],
  [/\n\s*"material":"HPβCD \(Cyclodextrin\), Zinc PCA, Triethyl Citrate, Zinc Gluconate",/g, ''],
  [/HPβCD \(cyclodextrin\) traps odor molecules and Zinc PCA neutralizes them instead of covering them with heavy fragrance\./gi, 'it targets fabric odor rather than simply adding fragrance.'],
  [/HPβCD \(cyclodextrin\) traps odor molecules and Zinc PCA neutralizes them/gi, 'it is designed to target fabric odor rather than simply adding fragrance'],
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
