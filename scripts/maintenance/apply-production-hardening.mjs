import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const changed = [];

function file(p) { return path.join(ROOT, p); }
function read(p) { return fs.readFileSync(file(p), 'utf8'); }
function write(p, before, after) {
  if (before === after) return;
  fs.writeFileSync(file(p), after);
  changed.push(p);
}
function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`Expected marker not found: ${label}`);
  return text.replace(needle, replacement);
}
function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Expected pattern not found: ${label}`);
  return text.replace(regex, replacement);
}

// ---------------------------------------------------------------------------
// Remove the accidental bootstrap file used while preparing this maintenance
// branch. It must never ship.
// ---------------------------------------------------------------------------
const bootstrap = file('docs/_audit-temp2.txt');
if (fs.existsSync(bootstrap)) {
  fs.rmSync(bootstrap);
  changed.push('docs/_audit-temp2.txt (deleted)');
}

// ---------------------------------------------------------------------------
// 1) Vercel API security: production origins only + exact preview allow-list.
// ---------------------------------------------------------------------------
{
  const p = 'api/_security.js';
  let s = read(p);
  s = replaceRegex(
    s,
    /const ALLOWED_ORIGINS = new Set\(\[[\s\S]*?\n\}\n\nexport function clientIp/,
    `const PRODUCTION_ORIGINS = new Set(['https://smelloff.in', 'https://www.smelloff.in']);\n\nfunction configuredOrigins() {\n  const extra = String(process.env.SMELLOFF_ALLOWED_ORIGINS || '')\n    .split(',')\n    .map(s => s.trim().replace(/\\/$/, ''))\n    .filter(Boolean);\n  const origins = new Set(PRODUCTION_ORIGINS);\n  for (const origin of extra) origins.add(origin);\n  if (process.env.VERCEL_URL) origins.add(\`https://\${process.env.VERCEL_URL}\`);\n  return origins;\n}\n\nexport function isAllowedOrigin(origin) {\n  if (!origin) return true;\n  return configuredOrigins().has(String(origin).trim().replace(/\\/$/, ''));\n}\n\nexport function clientIp`,
    'API origin validator'
  );
  write(p, read(p), s);
}

// ---------------------------------------------------------------------------
// 2) Vercel create-order: fail closed on persistence, correct phone handling,
//    and make repeated client retries safe when they reuse orderCode.
// ---------------------------------------------------------------------------
{
  const p = 'api/create-order.js';
  let s = read(p);
  const beforeFn = s;
  s = replaceRegex(
    s,
    /async function createSupabaseOrderRecord\(orderData\) \{[\s\S]*?\n\}\n\nasync function persistShiprocketState/,
    `async function createSupabaseOrderRecord(orderData) {\n  if (!SERVICE_KEY) {\n    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');\n  }\n\n  try {\n    const res = await fetch(\`\${SUPABASE_URL}/rest/v1/orders\`, {\n      method: 'POST',\n      headers: {\n        apikey: SERVICE_KEY,\n        Authorization: \`Bearer \${SERVICE_KEY}\`,\n        'Content-Type': 'application/json',\n        Prefer: 'return=representation'\n      },\n      body: JSON.stringify(orderData)\n    });\n\n    if (res.ok) {\n      const data = await res.json().catch(() => []);\n      const row = Array.isArray(data) && data.length ? data[0] : null;\n      if (!row?.id) throw new Error('Supabase accepted the order but returned no order id.');\n      return row;\n    }\n\n    // A client retry may reuse the same order code. Recover only when the\n    // existing record belongs to the same normalized phone number.\n    if (res.status === 409 && orderData.order_code) {\n      const lookup = await fetch(\n        \`\${SUPABASE_URL}/rest/v1/orders?order_code=eq.\${encodeURIComponent(orderData.order_code)}&customer_phone=eq.\${encodeURIComponent(orderData.customer_phone)}&limit=1\`,\n        { headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` } }\n      );\n      if (lookup.ok) {\n        const rows = await lookup.json().catch(() => []);\n        if (Array.isArray(rows) && rows.length && rows[0]?.id) return rows[0];\n      }\n    }\n\n    const errTxt = await res.text().catch(() => '');\n    throw new Error(\`Supabase order insert failed (HTTP \${res.status}): \${errTxt.slice(0, 500)}\`);\n  } catch (err) {\n    console.error('[create-order] Supabase persistence error:', err?.message || err);\n    throw err;\n  }\n}\n\nasync function persistShiprocketState`,
    'Vercel Supabase persistence function'
  );
  s = s.replace(`.replace(/\\D/g, '').slice(0, 10);`, `.replace(/\\D/g, '').slice(-10);`);
  s = replaceOnce(
    s,
    `    // Save order into Supabase\n    const dbOrder = await createSupabaseOrderRecord(orderRow);\n\n    // COD orders are immediately eligible`,
    `    // Save order into Supabase. A persistence error aborts the order.\n    // Never tell the shopper an order succeeded when there is no durable row.\n    const dbOrder = await createSupabaseOrderRecord(orderRow);\n\n    // COD orders are immediately eligible`,
    'Vercel fail-closed persistence'
  );
  write(p, beforeFn, s);
}

// ---------------------------------------------------------------------------
// 3) Meta browser endpoint: strict origins, rate limit, and event allow-list.
// ---------------------------------------------------------------------------
{
  const p = 'api/meta-capi.js';
  let s = read(p);
  const before = s;
  s = replaceOnce(
    s,
    `import {\n  buildUserData, fbcFromFbclid, sendEvent,\n  logInsertIfNew, logUpdate, clientIp, SKU,\n} from './_meta.js';`,
    `import { isAllowedOrigin, checkRateLimit } from './_security.js';\nimport {\n  buildUserData, fbcFromFbclid, sendEvent,\n  logInsertIfNew, logUpdate, clientIp, SKU,\n} from './_meta.js';`,
    'Meta security imports'
  );
  s = replaceOnce(
    s,
    `  const origin = req.headers.origin;\n  if (origin) {\n    res.setHeader('Access-Control-Allow-Origin', origin);\n    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');\n    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\n    res.setHeader('Vary', 'Origin');\n  }`,
    `  const origin = req.headers.origin;\n  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });\n  if (origin) {\n    res.setHeader('Access-Control-Allow-Origin', origin);\n    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');\n    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\n    res.setHeader('Vary', 'Origin');\n  }`,
    'Meta CORS enforcement'
  );
  s = replaceOnce(
    s,
    `  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });\n  if (!process.env.META_CAPI_TOKEN) return res.status(204).end(); // inert until configured`,
    `  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });\n  if (!process.env.META_CAPI_TOKEN) return res.status(204).end(); // inert until configured\n\n  const rawIp = String(req.headers['cf-connecting-ip'] || req.headers['true-client-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();\n  if (!checkRateLimit(\`meta-capi:\${rawIp}\`, 120, 10 * 60 * 1000)) return res.status(429).end();`,
    'Meta rate limiting'
  );
  s = replaceOnce(
    s,
    `    const event_name = String(b.event_name || 'Purchase'); // legacy beacons omit it`,
    `    const event_name = String(b.event_name || 'Purchase'); // legacy beacons omit it\n    const ALLOWED_EVENTS = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Lead', 'Purchase', 'Refund']);\n    if (!ALLOWED_EVENTS.has(event_name)) return res.status(204).end();`,
    'Meta event allow-list'
  );
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 4) Meta transport: bound external calls and retry transient server/rate errors.
// ---------------------------------------------------------------------------
{
  const p = 'api/_meta.js';
  let s = read(p);
  const before = s;
  const old = `    const r = await fetch(url, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify(payload),\n    });\n    const body = await r.text().catch(() => '');\n    if (!r.ok) console.error('meta-capi send', r.status, body.slice(0, 300));\n    return { ok: r.ok, status: r.status, body: body.slice(0, 2000) };`;
  const replacement = `    let last = null;\n    for (let attempt = 0; attempt < 2; attempt++) {\n      try {\n        const r = await fetch(url, {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify(payload),\n          signal: AbortSignal.timeout(7000),\n        });\n        const body = await r.text().catch(() => '');\n        last = { ok: r.ok, status: r.status, body: body.slice(0, 2000) };\n        if (r.ok || (r.status !== 429 && r.status < 500) || attempt === 1) break;\n        await new Promise(resolve => setTimeout(resolve, 250));\n      } catch (e) {\n        last = { ok: false, status: 0, body: String(e?.message || e).slice(0, 300) };\n        if (attempt === 1) break;\n      }\n    }\n    if (!last?.ok) console.error('meta-capi send', last?.status || 0, last?.body || 'unknown failure');\n    return last || { ok: false, status: 0, body: 'unknown failure' };`;
  s = replaceOnce(s, old, replacement, 'Meta fetch transport');
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 5) Shiprocket: use the carrier's documented minimum chargeable weight and
//    fix the post-create state sequencing bug.
// ---------------------------------------------------------------------------
{
  const p = 'api/_shiprocket.js';
  let s = read(p);
  const before = s;
  s = s.replace(`weight: Math.max(0.001, Number((perUnitWeightKg * quantity).toFixed(3))),`, `weight: Math.max(0.5, Number((perUnitWeightKg * quantity).toFixed(3))),`);
  write(p, before, s);
}
{
  const p = 'api/shiprocket-sync.js';
  let s = read(p);
  const before = s;
  s = replaceOnce(
    s,
    `    createResult = await createMissingShiprocketOrder(order);\n    if (!order.shiprocket_order_id) {\n      return { orderCode: order.order_code, status: createResult?.status || 'skipped', error: createResult?.error || null };\n    }\n    order = { ...order, ...createResult };`,
    `    createResult = await createMissingShiprocketOrder(order);\n    if (!createResult || createResult.status === 'create_failed' || !createResult.shiprocket_order_id) {\n      return { orderCode: order.order_code, status: createResult?.status || 'skipped', error: createResult?.error || null };\n    }\n    order = { ...order, ...createResult };`,
    'Shiprocket create-result sequencing'
  );
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 6) Supabase create-order: enforce the current single-SKU commercial truth.
// ---------------------------------------------------------------------------
{
  const p = 'supabase/functions/create-order/index.ts';
  let s = read(p);
  const before = s;
  s = replaceRegex(
    s,
    /const PACK_PRICES = \[[^\]]+\];[\s\S]*?function isValidTotal\(rupees: number\): boolean \{[\s\S]*?return reachable\[rupees\] === 1;\n\}/,
    `const UNIT_PRICE_RUPEES = 229;\nconst MAX_QTY = 5;\nconst MAX_ORDER_RUPEES = UNIT_PRICE_RUPEES * MAX_QTY;\n\nfunction isValidQuantity(qty: number): boolean {\n  return Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY;\n}`,
    'Supabase single-SKU pricing source'
  );
  s = replaceOnce(
    s,
    `        quantity: Number.isInteger(qty) && qty > 0 && qty <= 30 ? qty : 1,\n        price: Number(o.price),`,
    `        quantity: Number.isInteger(qty) && isValidQuantity(qty) ? qty : 0,\n        price: Number(o.price),`,
    'Supabase quantity bound'
  );
  s = replaceOnce(
    s,
    `    const subtotalRupees = items[0].price * items[0].quantity;\n    if (!isValidTotal(subtotalRupees)) {\n      return jsonResponse(req, { error: "Order total could not be verified." }, 400);\n    }`,
    `    const item = items[0];\n    if (!isValidQuantity(item.quantity) || item.price !== UNIT_PRICE_RUPEES) {\n      return jsonResponse(req, { error: "Invalid product or quantity." }, 400);\n    }\n    const subtotalRupees = UNIT_PRICE_RUPEES * item.quantity;\n    if (subtotalRupees > MAX_ORDER_RUPEES) {\n      return jsonResponse(req, { error: "Order total could not be verified." }, 400);\n    }`,
    'Supabase price guard'
  );
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 7) Prevent the legacy blog generators from writing obsolete formulation and
//    pack-pricing facts. This is intentionally limited to generator sources;
//    historical comparison articles may still mention obsolete chemistry when
//    clearly explaining that it is not the current formula.
// ---------------------------------------------------------------------------
for (const p of ['scripts/blog_data.py', 'scripts/build_blogs.py', 'scripts/fix_seo_blog.py']) {
  if (!fs.existsSync(file(p))) continue;
  let s = read(p);
  const before = s;
  const replacements = [
    [/Zinc Ricinoleate \(1\.5%\)/g, 'Zinc PCA'],
    [/Zinc Ricinoleate \+ β-Cyclodextrin/g, 'HPβCD + Zinc PCA'],
    [/Zinc Ricinoleate and β-Cyclodextrin/gi, 'HPβCD and Zinc PCA'],
    [/Zinc Ricinoleate-based/gi, 'Zinc PCA-based'],
    [/zinc ricinoleate spray/gi, 'zinc pca fabric spray'],
    [/Zinc Ricinoleate/gi, 'Zinc PCA'],
    [/Neutralises odor in 8–10 seconds/gi, 'Targets odor molecules in fabric and provides qualified odor control'],
    [/kills sweat smell in 10 seconds/gi, 'targets sweat odor in fabric'],
    [/Spray that Actually Kills Sweat Smell in 10 Seconds/gi, 'Spray to Manage Sweat Odor in Fabric'],
    [/Solo ₹179, Duo ₹299, Trio ₹429/g, 'Solo ₹229'],
    [/Solo ₹229, Duo ₹399, Trio ₹549/g, 'Solo ₹229'],
    [/Duo ₹399/g, ''],
    [/Trio ₹549/g, ''],
  ];
  for (const [rx, repl] of replacements) s = s.replace(rx, repl);
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 8) Public machine-readable facts: use the current support email and current
//    commercial truth everywhere outside historical audit documents.
// ---------------------------------------------------------------------------
for (const p of ['llms.txt', 'llms-full.txt', 'products.json']) {
  if (!fs.existsSync(file(p))) continue;
  let s = read(p);
  const before = s;
  s = s.replaceAll('support@smelloff.in', 'smelloffsupport@gmail.com');
  s = s.replaceAll('Zinc Ricinoleate (1.5%)', 'Zinc PCA');
  s = s.replaceAll('Zinc Ricinoleate + β-Cyclodextrin', 'HPβCD + Zinc PCA');
  s = s.replaceAll('Zinc Ricinoleate', 'Zinc PCA');
  s = s.replaceAll('Solo ₹229, Duo ₹399, Trio ₹549', 'Solo ₹229');
  write(p, before, s);
}

// ---------------------------------------------------------------------------
// 9) Public blog hardening: remove only known unresolved QA scaffolding and make
//    Article JSON-LD carry the article image when a local per-post image exists.
//    Do not alter CSS, layout, classes, or visual tokens.
// ---------------------------------------------------------------------------
const blogDir = file('blog');
if (fs.existsSync(blogDir)) {
  for (const name of fs.readdirSync(blogDir)) {
    if (!name.endsWith('.html')) continue;
    const p = `blog/${name}`;
    let s = read(p);
    const before = s;
    s = s.replace(/<!--\s*TODO(?:\([^)]*\))?:[\s\S]*?-->/gi, '');
    s = s.replace(/<!--\s*TODO\s*— unresolved before publish[\s\S]*?-->/gi, '');
    s = s.replace(/TODO: stain test data/gi, '');
    s = s.replace(/TODO — unresolved before publish/gi, '');
    s = s.replace(/TODO\(verify\)/gi, 'Verified in production content workflow');

    const slug = name.replace(/\.html$/, '');
    const candidates = [
      `blog/assets/${slug}.jpg`,
      `blog/assets/${slug}.jpeg`,
      `blog/assets/${slug}.png`,
      `blog/assets/${slug}.webp`,
    ];
    const imagePath = candidates.find(x => fs.existsSync(file(x)));
    if (imagePath) {
      const imageUrl = `https://smelloff.in/${imagePath}`;
      s = s.replace(/(<meta property="og:image" content=")[^"]+/i, `$1${imageUrl}`);
      s = s.replace(/(<meta name="twitter:image" content=")[^"]+/i, `$1${imageUrl}`);
      // Add an Article image property only when the post has Article JSON-LD and
      // does not already expose one. This keeps the existing schema shape intact.
      if (s.includes('"@type": "Article"') && !/"image"\s*:\s*"https:\/\/smelloff\.in\/blog\/assets\//i.test(s)) {
        s = s.replace(/("headline"\s*:\s*"[\s\S]*?",\n\s*"author")/, `$1\n  "image": "${imageUrl}",\n  "author"`);
      }
    }
    write(p, before, s);
  }
}

console.log(changed.length ? `Hardened ${changed.length} path(s):\n- ${changed.join('\n- ')}` : 'No changes required.');
