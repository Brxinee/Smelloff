import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const { SMELLOFF_PRODUCT_TRUTH: T } = await import(
  pathToFileURL(path.join(root, 'shared/product-truth.js')).href
);

const catalog = JSON.parse(read('products.json'));
const items = Array.isArray(catalog.items) ? catalog.items : [];

if (items.length !== 1) errors.push(`products.json must contain exactly one active item; found ${items.length}.`);
const product = items[0];
if (product) {
  if (product.sku !== T.sku) errors.push(`Active SKU mismatch: ${product.sku}`);
  if (Number(product.price) !== T.pricePrepaid) errors.push(`Active price mismatch: ${product.price}`);
  if (product.url !== 'https://smelloff.in/') errors.push(`Product URL mismatch: ${product.url}`);
  if (product.availability !== 'in_stock') errors.push(`Unexpected product availability: ${product.availability}`);
}

const llms = read('llms.txt');
const forbiddenPublicClaims = [
  /instant(?:ly)?/i,
  /unscented/i,
  /fragrance[- ]free/i,
  /zinc ricinoleate/i,
];
for (const pattern of forbiddenPublicClaims) {
  if (pattern.test(llms)) errors.push(`Unapproved public claim in llms.txt: ${pattern}`);
}

if (!/₹229/.test(llms)) errors.push('llms.txt is missing the current ₹229 price.');
if (!/up to 8 hours of odor protection on fabric/i.test(llms)) {
  errors.push('llms.txt is missing the current approved 8-hour fabric protection claim.');
}
if (!/under normal office\/commute conditions/i.test(llms)) {
  errors.push('llms.txt must qualify the 8-hour claim.');
}
if (!/fabric only/i.test(llms)) errors.push('llms.txt must retain the fabric-only scope.');
if (!/15–20 cm/.test(llms)) errors.push('llms.txt must use the canonical 15–20 cm distance.');
if (!/approximately 10 seconds/i.test(llms)) errors.push('llms.txt must use the canonical ~10 second dry time.');
if (!/₹60/.test(llms)) errors.push('llms.txt must disclose the ₹60 COD handling fee.');
if (/4\s*[–-]\s*6 weeks|2\s*[–-]\s*3 months|4 months of daily use|four to six weeks/i.test(llms)) {
  errors.push('llms.txt must not convert 250 sprays into months.');
}

const customerFiles = [
  'index.html',
  'odorstrike.html',
  'faq.html',
  'shipping.html',
  'returns.html',
  'refund.html',
  'about.html',
  'reviews.html',
  'shared/products-config.js',
  'data/brand-facts.json',
  'llms.txt',
  'blog/how-to-use-odorstrike.html',
  'blog/best-deodorant-spray-for-clothes-not-skin.html',
  'solutions/office-commute-fabric-refresher.html',
  'terms.html',
];

const banned = [
  [/10\s*[–—-]\s*15\s*cm/i, '10–15 cm distance (use 15–20 cm)'],
  [/\b8 seconds\b/i, '8 seconds dry/work claim'],
  [/4\s*[–-]\s*6 weeks per bottle/i, '4–6 weeks bottle life'],
  [/four to six weeks from a bottle/i, 'four to six weeks bottle life'],
  [/2\s*[–-]\s*3 months of daily use/i, '2–3 months bottle life'],
  [/2 to 3 months of daily/i, '2 to 3 months bottle life'],
  [/four months of daily use/i, '4 months bottle life'],
  [/Contains Zinc Ricinoleate/i, 'Zinc Ricinoleate presented as an ingredient'],
  [/no extra handling fee/i, 'COD described as fee-free'],
  [/there is no COD handling fee/i, 'COD described as fee-free'],
  [/7-day money-back guarantee/i, 'money-back guarantee (use 7-day returns, 80% full)'],
  [/Do not use on leather, suede, silk, or dry-clean-only/i, 'silk banned instead of patch-test'],
];

for (const file of customerFiles) {
  const text = read(file);
  for (const [pattern, label] of banned) {
    if (pattern.test(text)) errors.push(`${file}: ${label}`);
  }
}

const shipping = read('shipping.html');
if (!/₹60/.test(shipping)) {
  errors.push('shipping.html must disclose ₹60 COD handling.');
}

const returns = read('returns.html');
if (!/80%\s*full/i.test(returns)) errors.push('returns.html must keep the 80% full rule.');
if (!/7 days of delivery/i.test(returns)) errors.push('returns.html must keep the 7-day window.');

if (T.codFee !== 60 || T.pricePrepaid !== 229 || T.priceCod !== 289) {
  errors.push('SMELLOFF_PRODUCT_TRUTH price/COD lock drifted.');
}
if (T.sprayDistance !== '15–20 cm') errors.push('sprayDistance drifted.');
if (!/10 seconds/.test(T.dryTime)) errors.push('dryTime drifted.');
if (T.formulaVersion !== 'v3.1') errors.push('formulaVersion drifted.');
if (T.testerProfiles.length < 7) errors.push('testerProfiles missing canonical testers.');

if (errors.length) {
  console.error('Public truth check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Public truth check passed: SKU, price, COD fee, dose/dry/distance, formula and returns are consistent.');
