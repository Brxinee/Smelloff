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
  const withoutDisclaimers = s.replace(/must not be described as Zinc Ricinoleate/gi, '').replace(/Do not describe the current formula as Zinc Ricinoleate/gi, '');
  if (/Zinc Ricinoleate/i.test(withoutDisclaimers)) fail(`${rel(p)} contains retired Zinc Ricinoleate product truth`);
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
  if (!s.includes('product.json')) fail('Supabase order function must derive from config/product.json');
  if (s.includes('UNIT_PRICE_RUPEES = 229')) fail('Supabase order function has hardcoded price; must derive from product.json');
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

// Site-wide customer-facing claim & commercial audit
const customerFacingFiles = files.filter(p => {
  const relPath = rel(p);
  if (relPath.startsWith('docs/') || relPath.startsWith('test/') || relPath.startsWith('scripts/') || relPath.startsWith('coverage/') || relPath.startsWith('api/') || relPath.startsWith('supabase/')) return false;
  return (relPath.endsWith('.html') || relPath.endsWith('.xml')) && !relPath.startsWith('_shared/');
});

const prohibitedClaimRules = [
  { name: "Ordinal superiority ('India's first' / '#1' / 'pioneer')", regex: /India['’]s\s*#?1\b|India['’]s\s*first\b|\bcategory[- ]pioneer\b/i },
  { name: 'Obsolete ₹579 pricing', regex: /₹\s*579\b|\b579\s*(?:rs|rupees|\/-)/i },
  { name: 'Retired bundle pricing', regex: /Duo\s*₹\s*399|Trio\s*₹\s*549|Solo\s*₹\s*179/i },
  { name: 'Fake 10% discount claim', regex: /\b10%\s*off\b/i },
  { name: 'Kills odor claim', regex: /\bkills?\s+(?:the\s+)?(?:sweat\s+)?odor\b/i },
  { name: 'Kills bacteria product claim', regex: /\bkills?\s+(?:the\s+)?bacteria\s+that\b|\bkills?\s+(?:clothing|fabric|sweat)\s+bacteria\b|ODORSTRIKE[^\.\n]*kills?\s+bacteria/i },
  { name: 'Smell-proof / Odor-proof claim', regex: /\b(?:smell|odor)[-\s]proof\b/i },
  { name: 'Zero smell claim', regex: /\bzero\s+smell\b/i },
  { name: 'Never stains claim', regex: /\bnever\s+stains\b/i },
  { name: 'Unsupported medical / testing claims', regex: /\b(?:clinically|dermatologist)\s+tested\b|\blab\s+(?:tested|certified)\b|\bscientifically\s+proven\b/i },
  { name: 'Stale four months longevity claim', regex: /\b(?:roughly\s+four|lasts\s+4)\s+months\b/i },
  { name: 'Obsolete manual UPI element', regex: /\bupiInlineId\b/i },
  { name: 'Obsolete manual UPI transfer instructions', regex: /\bmanual\s+upi\s+transfer\b|\b12-digit\s+UTR\b/i },
  { name: 'Stale free COD claim', regex: /\bfree\s+cod\b|\bfree\s+cash\s+on\s+delivery\b/i }
];

for (const p of customerFacingFiles) {
  const s = read(p);
  for (const r of prohibitedClaimRules) {
    if (r.regex.test(s)) {
      fail(`${rel(p)} contains prohibited pattern: ${r.name}`);
    }
  }
}

const webhook = path.join(ROOT, 'api/webhook.js');
if (fs.existsSync(webhook) && /payu-webhook/i.test(read(webhook))) fail('Legacy webhook still points customers to a nonexistent payu-webhook route');

// Production artifact determinism checks (Homepage & PDP critical markers)
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexHtml = read(indexPath);
  if (!indexHtml.includes('Your shirt smells.')) fail('index.html missing critical marker: "Your shirt smells."');
  if (!indexHtml.includes('FABRIC ODOR CONTROL · FOR CLOTHES')) fail('index.html missing critical marker: "FABRIC ODOR CONTROL · FOR CLOTHES"');
  if (!indexHtml.includes('Built for the gap') && !indexHtml.includes('Jogdhande Nikhil Patil')) {
    fail('index.html missing current founder heading');
  }
  if (/₹\s*579/.test(indexHtml)) fail('index.html contains obsolete ₹579 pricing');
  if (indexHtml.includes("Kills odor — doesn't hide it")) fail('index.html contains obsolete claim: "Kills odor — doesn\'t hide it"');
  if (indexHtml.includes('roughly four months')) fail('index.html contains obsolete claim: "roughly four months"');
  if (indexHtml.includes('Three seconds. No technique.')) fail('index.html contains obsolete claim: "Three seconds. No technique."');
}

const odorPath = path.join(ROOT, 'odorstrike.html');
if (fs.existsSync(odorPath)) {
  const odorHtml = read(odorPath);
  if (!odorHtml.includes('₹229')) fail('odorstrike.html missing canonical price ₹229');
  if (!odorHtml.includes('MRP ₹499')) fail('odorstrike.html missing canonical MRP ₹499');
  if (!odorHtml.includes('GET ODORSTRIKE')) fail('odorstrike.html missing canonical CTA: "GET ODORSTRIKE"');
  if (!odorHtml.includes('id="mobileBarLabel"')) fail('odorstrike.html missing critical marker: id="mobileBarLabel"');
  if (!odorHtml.includes('id="showcaseBuyBtn"') || !odorHtml.includes('buyNow()')) {
    fail('odorstrike.html missing canonical showcase CTA calling buyNow()');
  }
  if (!odorHtml.includes('id="finalBuyBtn"') || !odorHtml.includes('final-reassurance')) {
    fail('odorstrike.html missing canonical final CTA markers: id="finalBuyBtn" and final-reassurance');
  }
  if (/₹\s*579/.test(odorHtml)) fail('odorstrike.html contains obsolete ₹579 pricing');
  if (odorHtml.includes("Kills odor — doesn't hide it")) fail('odorstrike.html contains obsolete claim: "Kills odor — doesn\'t hide it"');
  if (odorHtml.includes('roughly four months')) fail('odorstrike.html contains obsolete claim: "roughly four months"');
  if (odorHtml.includes('Three seconds. No technique.')) fail('odorstrike.html contains obsolete claim: "Three seconds. No technique."');
  if (/id=["']upiInlineId["']/.test(odorHtml)) fail('odorstrike.html contains obsolete manual upiInlineId element');
}

if (failures.length) {
  console.error(`Production audit failed (${failures.length}):`);
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}
console.log(`Production audit passed: ${blogFiles.length} blog pages checked.`);
