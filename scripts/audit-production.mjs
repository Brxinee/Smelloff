import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const fail = message => failures.push(message);
const read = p => fs.readFileSync(p, 'utf8');
const rel = p => path.relative(ROOT, p);

const machine = ['llms.txt', 'llms-full.txt', 'products.json']
  .map(p => path.join(ROOT, p)).filter(fs.existsSync);
for (const p of machine) {
  const s = read(p);
  // Strip out allowed negative constraints in llms-full.txt before testing
  const cleaned = s.replace(/Current formulation must not be described as Zinc Ricinoleate\./gi, '')
                   .replace(/Do not describe the current formula as Zinc Ricinoleate\./gi, '');
  if (/Zinc Ricinoleate/i.test(cleaned)) fail(`${rel(p)} contains retired Zinc Ricinoleate product truth`);
  if (/Duo\s*₹399|Trio\s*₹549|Solo\s*₹179/i.test(s)) fail(`${rel(p)} contains retired bundle pricing`);
  if (s.includes('support@smelloff.in')) fail(`${rel(p)} contains stale support email`);
}

// Legacy generators were removed because they could regenerate obsolete product
// claims. Their absence is itself a guardrail.
for (const name of ['scripts/blog_data.py','scripts/build_blogs.py','scripts/fix_prices.py','scripts/fix_seo_blog.py','scripts/fix_audit.py']) {
  if (fs.existsSync(path.join(ROOT, name))) fail(`${name} must not exist; it is a stale generator/rewrite path`);
}

const security = path.join(ROOT, 'api/_security.js');
if (fs.existsSync(security) && /\.endsWith\(['"]\.vercel\.app/i.test(read(security))) {
  fail('api/_security.js permits arbitrary *.vercel.app origins');
}

const createOrder = path.join(ROOT, 'supabase/functions/create-order/index.ts');
if (fs.existsSync(createOrder)) {
  const s = read(createOrder);
  if (!s.includes('UNIT_PRICE_RUPEES = 229')) fail('Supabase order function lost the single-SKU price guard');
  if (s.includes('PACK_PRICES')) fail('Supabase order function still contains bundle/pack pricing');
  if (!s.includes('generateOrderCode')) fail('Supabase order function does not generate missing order codes server-side');
}

const blogFiles = files.filter(p => p.startsWith(path.join(ROOT, 'blog')) && p.endsWith('.html'));
for (const p of blogFiles) {
  const s = read(p);
  const tags = [...s.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const hasImage = key => tags.some(tag => new RegExp(`(?:property|name)=["']${key}["']`, 'i').test(tag) && /https?:\/\//i.test(tag));
  if (!hasImage('og:image')) fail(`${rel(p)} missing absolute og:image`);
  if (!hasImage('twitter:image')) fail(`${rel(p)} missing absolute twitter:image`);
  if (s.includes('"@type": "Article"') && !/"author"\s*:\s*\{[\s\S]*?"@type"\s*:\s*"Person"/s.test(s)) fail(`${rel(p)} Article schema lacks Person author`);
}

const webhook = path.join(ROOT, 'api/webhook.js');
if (fs.existsSync(webhook) && /payu-webhook/i.test(read(webhook))) fail('Legacy webhook still points customers to a nonexistent payu-webhook route');

if (failures.length) {
  console.error(`Production audit failed (${failures.length}):`);
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}
console.log(`Production audit passed: ${blogFiles.length} blog pages checked.`);
