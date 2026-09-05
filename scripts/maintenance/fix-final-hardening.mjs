import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
function abs(p) { return path.join(ROOT, p); }
function load(p) { return fs.readFileSync(abs(p), 'utf8'); }
function save(p, before, after) { if (before !== after) fs.writeFileSync(abs(p), after); }
function need(p) { if (!fs.existsSync(abs(p))) throw new Error(`Missing ${p}`); }

// Fix the retired webhook so it no longer advertises a non-existent replacement.
{
  const p = 'api/webhook.js';
  need(p);
  const before = load(p);
  const after = `export default async function handler(req, res) {\n  res.setHeader('X-Powered-By', 'Smelloff');\n  res.setHeader('Cache-Control', 'no-store');\n  return res.status(410).json({\n    error: 'Legacy payment webhook is retired.'\n  });\n}\n`;
  save(p, before, after);
}

// Inject per-post social image metadata from the canonical image manifest. The
// manifest is text and is therefore reliable even if a branch's binary asset
// checkout is incomplete. No layout/CSS is changed.
{
  const manifestPath = abs('blog-image-manifest.json');
  const blogDir = abs('blog');
  if (fs.existsSync(manifestPath) && fs.existsSync(blogDir)) {
    const manifestText = load('blog-image-manifest.json');
    let manifest = null;
    try { manifest = JSON.parse(manifestText); } catch { manifest = null; }
    if (manifest) {
      const entries = Array.isArray(manifest) ? manifest : Object.values(manifest);
      const bySlug = new Map();
      for (const item of entries) {
        if (!item || typeof item !== 'object') continue;
        const slug = String(item.slug || '').trim();
        const filename = String(item.filename || '').trim();
        if (slug && filename) bySlug.set(slug, filename.replace(/^\//, ''));
        const hero = String(item.hero || '').trim();
        if (!slug && hero) {
          const m = hero.match(/\/blog\/assets\/([^?]+)/);
          if (m) bySlug.set(path.basename(m[1]).replace(/\.(?:jpg|jpeg|png|webp|avif)$/i, ''), m[1]);
        }
      }
      for (const name of fs.readdirSync(blogDir)) {
        if (!name.endsWith('.html') || name === 'index.html') continue;
        const p = path.join('blog', name);
        let html = load(p);
        const before = html;
        const slug = name.slice(0, -5);
        let asset = bySlug.get(slug);
        if (!asset) {
          const candidate = `blog/assets/${slug}.jpg`;
          if (fs.existsSync(abs(candidate))) asset = candidate;
        }
        if (!asset) continue;
        const url = `https://smelloff.in/${asset}`;
        if (/<meta[^>]+property=["']og:image["']/i.test(html)) {
          html = html.replace(/(<meta[^>]+property=["']og:image["'][^>]+content=["'])[^"']+/i, `$1${url}`);
        } else {
          html = html.replace(/(<meta[^>]+property=["']og:site_name["'][^>]*>)/i, `$1\n<meta property="og:image" content="${url}">`);
        }
        if (/<meta[^>]+name=["']twitter:image["']/i.test(html)) {
          html = html.replace(/(<meta[^>]+name=["']twitter:image["'][^>]+content=["'])[^"']+/i, `$1${url}`);
        } else {
          html = html.replace(/(<meta[^>]+name=["']twitter:card["'][^>]*>)/i, `$1\n<meta name="twitter:image" content="${url}">`);
        }
        save(p, before, html);
      }
    }
  }
}

// Server-generate an order code in the Supabase order pipeline when the client
// does not provide one. This makes Track Order work regardless of which trusted
// frontend generated the order and keeps the unique DB index useful.
{
  const p = 'supabase/functions/create-order/index.ts';
  need(p);
  const before = load(p);
  let html = before;
  if (!html.includes('function generateOrderCode()')) {
    const marker = 'const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n';
    const helper = `${marker}\nfunction generateOrderCode(): string {\n  const now = new Date();\n  const y = now.getUTCFullYear();\n  const m = String(now.getUTCMonth() + 1).padStart(2, \"0\");\n  const d = String(now.getUTCDate()).padStart(2, \"0\");\n  const r = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;\n  return \`SMF-\${y}\${m}\${d}-\${String(r).padStart(4, \"0\")}\`;\n}\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate order-code helper insertion point');
    html = html.replace(marker, helper);
  }
  if (!html.includes('const generatedOrderCode = generateOrderCode();')) {
    const marker = '    const order_code = ORDER_CODE_RE.test(codeRaw) ? codeRaw : null;\n';
    const repl = `    const requestedOrderCode = ORDER_CODE_RE.test(codeRaw) ? codeRaw : null;\n    const generatedOrderCode = generateOrderCode();\n    const order_code = requestedOrderCode || generatedOrderCode;\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate order_code assignment');
    html = html.replace(marker, repl);
  }
  if (!html.includes('select("id,order_code")')) {
    html = html.replace('.select("id")', '.select("id,order_code")');
  }
  if (!html.includes('let insertAttempts = 0;')) {
    const marker = '    const { data, error } = await supabase\n      .from("orders")\n      .insert({\n';
    const repl = `    let insertAttempts = 0;\n    let data = null;\n    let error = null;\n    while (insertAttempts < 3) {\n      insertAttempts++;\n      const result = await supabase\n        .from("orders")\n        .insert({\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate Supabase insert');
    html = html.replace(marker, repl);
    const end = `      .select("id,order_code")\n      .single();\n\n    if (error) throw error;\n`;
    const endRepl = `        .select("id,order_code")\n        .single();\n      data = result.data;\n      error = result.error;\n      if (!error) break;\n      if (String(error.code) === "23505" && !requestedOrderCode && insertAttempts < 3) {\n        order_code = generateOrderCode();\n        continue;\n      }\n      break;\n    }\n\n    if (error) throw error;\n`;
    // order_code was declared const above; change it to let for retry semantics.
    html = html.replace('    const order_code = requestedOrderCode || generatedOrderCode;\n', '    let order_code = requestedOrderCode || generatedOrderCode;\n');
    if (!html.includes(end)) throw new Error('Unable to locate Supabase insert terminator');
    html = html.replace(end, endRepl);
  }
  save(p, before, html);
}

console.log('Final production hardening pass prepared.');
