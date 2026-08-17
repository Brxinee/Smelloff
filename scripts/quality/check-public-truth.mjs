import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const catalog = JSON.parse(read('products.json'));
const items = Array.isArray(catalog.items) ? catalog.items : [];

if (items.length !== 1) errors.push(`products.json must contain exactly one active item; found ${items.length}.`);
const product = items[0];
if (product) {
  if (product.sku !== 'OS-001-50ML') errors.push(`Active SKU mismatch: ${product.sku}`);
  if (Number(product.price) !== 229) errors.push(`Active price mismatch: ${product.price}`);
  if (product.url !== 'https://smelloff.in/odorstrike') errors.push(`Product URL mismatch: ${product.url}`);
  if (product.availability !== 'in_stock') errors.push(`Unexpected product availability: ${product.availability}`);
}

const llms = read('llms.txt');
const forbiddenPublicClaims = [
  /instant(?:ly)?/i,
  /in\s+(?:10|30)\s+seconds?/i,
  /unscented/i,
  /fragrance[- ]free/i,
];
for (const pattern of forbiddenPublicClaims) {
  if (pattern.test(llms)) errors.push(`Unapproved public claim in llms.txt: ${pattern}`);
}

if (!/₹229/.test(llms)) errors.push('llms.txt is missing the current ₹229 price.');
if (!/up to 8 hours of odor protection on fabric/i.test(llms)) {
  errors.push('llms.txt is missing the current approved 8-hour fabric protection claim.');
}
if (!/fabric only/i.test(llms)) errors.push('llms.txt must retain the fabric-only scope.');

if (errors.length) {
  console.error('Public truth check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Public truth check passed: one active SKU, current price, URL, scope and approved claims are consistent.');
