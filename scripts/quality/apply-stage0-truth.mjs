#!/usr/bin/env node
/**
 * Stage 0 — apply SMELLOFF_PRODUCT_TRUTH to customer-facing copy.
 * Does not restyle pages. Does not change checkout math.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', '.vercel', 'supabase',
  '.thumbnail-sources', 'docs',
]);

const SKIP_FILES = new Set([
  'shared/product-truth.js',
  'scripts/quality/apply-stage0-truth.mjs',
  'scripts/quality/check-public-truth.mjs',
]);

const replacements = [
  [/8\s*[–—-]\s*10\s*seconds?/gi, 'approximately 10 seconds'],
  [/works in 8 seconds/gi, 'air-dries in approximately 10 seconds'],
  [/in 8 seconds/gi, 'in approximately 10 seconds'],
  [/\b8 seconds\b/gi, 'approximately 10 seconds'],

  [/Allow 30\s*[–—-]\s*60 seconds to air-dry/gi, 'Allow approximately 10 seconds to air-dry'],
  [/allow 30\s*[–—-]\s*60s to dry/gi, 'allow approximately 10 seconds to air-dry'],
  [/let dry 30-60s/gi, 'let dry approximately 10 seconds'],
  [/usually takes 30-60 seconds depending on humidity/gi, 'air-dries in approximately 10 seconds; in high humidity wait until fully dry'],
  [/Allow 30\s*[–—-]\s*60 seconds for the evaporative carrier to flash off and dry completely/gi, 'Allow approximately 10 seconds for the evaporative carrier to flash off. In high humidity, wait until the fabric is fully dry'],
  [/30\s*[–—-]\s*60 seconds to air-dry/gi, 'approximately 10 seconds to air-dry'],

  [/10\s*[–—-]\s*15\s*cm/gi, '15–20 cm'],
  [/Hold bottle 15cm away/gi, 'Hold the bottle 15–20 cm away'],
  [/Hold 10–15cm from clothing/gi, 'Hold 15–20 cm from clothing'],

  [/4\s*[–—-]\s*6 weeks per bottle/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/most daily users get 4\s*[–—-]\s*6 weeks per bottle/gi, 'one bottle is ~250 sprays — about 100 refreshes at 2–3 sprays'],
  [/get four to six weeks from a bottle/gi, 'get about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/four to six weeks from a bottle/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/enough for 2\s*[–—-]\s*3 months of daily use/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/around 2 to 3 months of daily office use/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/around 2 to 3 months of daily use/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/2 to 3 months of daily office use/gi, 'about 100 refreshes at 2–3 sprays (~250 sprays per bottle)'],
  [/roughly four months of daily use/gi, 'about 100 refreshes at 2–3 sprays'],
  [/4 months of daily use/gi, 'about 100 refreshes at 2–3 sprays'],

  [/Dispatches in 24\s*[–—-]\s*48 Hours/gi, 'Dispatches within 48 hours of confirmation'],
  [/within 24\s*[–—-]\s*48 business hours/gi, 'within 48 hours of confirmation'],
  [/within 24 to 48 business hours/gi, 'within 48 hours of confirmation'],
  [/Dispatch in 24&ndash;48 hours/gi, 'Dispatch within 48 hours of confirmation'],
  [/Dispatch in 24[–-]48 hours/gi, 'Dispatch within 48 hours of confirmation'],

  [/7-Day Replacement Policy/g, '7-day returns (80% full)'],
  [/7-day money-back guarantee/gi, '7-day returns (80% full)'],

  [/COD available pan-India — no extra handling fee/gi, 'COD available pan-India (+₹60 handling; ₹289 collectable)'],
  [/there is no COD handling fee, so nothing is deducted on that count/gi, 'COD collectable is ₹289 (₹229 + ₹60 handling). Product refunds are ₹229'],
  [/there is no COD handling fee/gi, 'COD includes a ₹60 handling fee'],
  [/no extra handling fee/gi, '+₹60 COD handling (₹289 collectable)'],

  [/Contains Zinc Ricinoleate/g, 'Contains Zinc PCA'],
  [/Zinc Ricinoleate \(Odor absorber\)/g, 'Zinc PCA (Neutralize)'],

  [/and verified buyers/gi, 'and early testers'],

  [/up to 8 hours of odor protection on fabric(?! under normal)/gi, 'up to 8 hours of odor protection on fabric under normal office/commute conditions'],
  [/up to 8 hours of protection on fabric(?! under normal)/gi, 'up to 8 hours of protection on fabric under normal office/commute conditions'],
  [/with up to 8 hours of protection\./gi, 'with up to 8 hours of odor protection on fabric under normal office/commute conditions.'],
  [/providing 8 hours of active fabric protection/gi, 'providing up to 8 hours of odor protection on fabric under normal office/commute conditions'],

  [/Do not use on leather, suede, silk, or dry-clean-only garments/gi, 'Do not use on leather, suede, or dry-clean-only garments. Patch-test silk'],

  [/Two sprays per refresh — about 100 refreshes at 2–3 sprays/g, '2–3 sprays per targeted refresh — about 100 refreshes per bottle'],
  [/<span id="submitText">Place COD order · ₹229<\/span>/g, '<span id="submitText">Open UPI app · ₹229</span>'],

  [/"founder": "Manoj"/g, '"founder": "Jogdhande Nikhil Patil"'],
  [/Founder: Manoj/g, 'Founder: Jogdhande Nikhil Patil'],
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(REPO, full);
    if (SKIP_FILES.has(rel)) continue;
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(html|js|mjs|json|txt|md|py)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(REPO);
let changed = 0;
const changedFiles = [];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const original = text;
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  if (text !== original) {
    changed += 1;
    changedFiles.push(path.relative(REPO, file));
    if (!CHECK) fs.writeFileSync(file, text);
  }
}

if (CHECK) {
  if (changed) {
    console.error(`Stage 0 truth drift in ${changed} file(s):`);
    for (const f of changedFiles) console.error(' -', f);
    process.exit(1);
  }
  console.log('Stage 0 truth: clean');
} else {
  console.log(`Stage 0 truth applied to ${changed} file(s).`);
  for (const f of changedFiles) console.log(' -', f);
}
