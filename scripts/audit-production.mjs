import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name.startsWith('.vercel')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
function text(p) { return fs.readFileSync(p, 'utf8'); }
function fail(message) { failures.push(message); }
function metaTags(html) { return [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]); }
function hasMetaImage(tags, key) {
  return tags.some(tag => new RegExp(`(?:property|name)=["']${key}["']`, 'i').test(tag) && /https?:\/\//i.test(tag));
}

const all = walk(ROOT);
const publicHtml = all.filter(p => p.endsWith('.html') && p.includes(`${path.sep}blog${path.sep}`));
const generatorFiles = all.filter(p => /(?:scripts[\\/](?:blog|fix_seo_blog)|scripts[\\/]build_blogs\.py$)/i.test(p));
const machineFiles = ['llms.txt', 'llms-full.txt', 'products.json'].map(p => path.join(ROOT, p)).filter(fs.existsSync);

// Legacy product chemistry/pricing must not survive in active generators or
// machine-readable product truth. Historical audit docs are intentionally excluded.
for (const p of [...generatorFiles, ...machineFiles]) {
  const s = text(p);
  if (/Zinc Ricinoleate/i.test(s)) fail(`${path.relative(ROOT, p)} contains legacy Zinc Ricinoleate product truth`);
  if (/Solo\s*₹399|Duo\s*₹399|Trio\s*₹549|Solo\s*₹179/i.test(s)) fail(`${path.relative(ROOT, p)} contains legacy pack pricing`);
}

for (const p of machineFiles) {
  const s = text(p);
  if (s.includes('support@smelloff.in')) fail(`${path.relative(ROOT, p)} contains stale support@smelloff.in address`);
}

for (const p of publicHtml) {
  const s = text(p);
  const rel = path.relative(ROOT, p);
  const tags = metaTags(s);
  if (/TODO(?:\([^)]*\))?|TODO\s*—\s*unresolved before publish|TODO:\s*stain test data/i.test(s)) fail(`${rel} contains unresolved publication TODO text`);
  if (!hasMetaImage(tags, 'og:image')) fail(`${rel} is missing an absolute og:image`);
  if (!hasMetaImage(tags, 'twitter:image')) fail(`${rel} is missing an absolute twitter:image`);
  if (s.includes('"@type": "Article"')) {
    if (!/"author"\s*:\s*\{[\s\S]*?"@type"\s*:\s*"Person"/s.test(s)) fail(`${rel} Article schema is missing a Person author`);
    if (!/"datePublished"\s*:/s.test(s)) fail(`${rel} Article schema is missing datePublished`);
    if (!/"dateModified"\s*:/s.test(s)) fail(`${rel} Article schema is missing dateModified`);
  }
}

// There is one canonical public host in this repo.
for (const p of all.filter(p => /\.(html|xml|txt|json)$/.test(p))) {
  const s = text(p);
  if (/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.smelloff\.in/i.test(s)) fail(`${path.relative(ROOT, p)} contains a www canonical; non-www is canonical`);
}

const security = path.join(ROOT, 'api/_security.js');
if (fs.existsSync(security) && /endsWith\('\.vercel\.app'\)|endsWith\("\.vercel\.app"\)/.test(text(security))) {
  fail('api/_security.js still permits arbitrary *.vercel.app origins');
}

const webhook = path.join(ROOT, 'api/webhook.js');
if (fs.existsSync(webhook) && /410 Gone/.test(text(webhook)) && /payu-webhook/i.test(text(webhook))) {
  fail('api/webhook.js still advertises a dead PayU replacement endpoint');
}

if (failures.length) {
  console.error(`Production audit failed with ${failures.length} issue(s):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`Production audit passed: ${publicHtml.length} blog page(s), ${generatorFiles.length} generator source(s), ${machineFiles.length} machine-readable file(s).`);
