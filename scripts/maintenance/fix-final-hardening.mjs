import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
function abs(p) { return path.join(ROOT, p); }
function load(p) { return fs.readFileSync(abs(p), 'utf8'); }
function save(p, before, after) { if (before !== after) fs.writeFileSync(abs(p), after); }
function need(p) { if (!fs.existsSync(abs(p))) throw new Error(`Missing ${p}`); }

// Retired legacy webhook: remain explicit without advertising a non-existent endpoint.
{
  const p = 'api/webhook.js';
  need(p);
  const before = load(p);
  const after = `export default async function handler(req, res) {\n  res.setHeader('X-Powered-By', 'Smelloff');\n  res.setHeader('Cache-Control', 'no-store');\n  return res.status(410).json({\n    error: 'Legacy payment webhook is retired.'\n  });\n}\n`;
  save(p, before, after);
}

// Inject each blog's canonical OG/Twitter image using blog-image-manifest.json.
// This deliberately does not touch page layout or CSS.
{
  const manifestPath = abs('blog-image-manifest.json');
  const blogDir = abs('blog');
  if (fs.existsSync(manifestPath) && fs.existsSync(blogDir)) {
    let manifest = null;
    try { manifest = JSON.parse(load('blog-image-manifest.json')); } catch { manifest = null; }
    const entries = Array.isArray(manifest?.posts)
      ? manifest.posts
      : (Array.isArray(manifest) ? manifest : Object.values(manifest || {}));
    const bySlug = new Map();
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue;
      const slug = String(item.slug || '').trim();
      const filename = String(item.filename || '').trim().replace(/^\//, '');
      if (slug && filename) bySlug.set(slug, filename);
    }

    for (const name of fs.readdirSync(blogDir)) {
      if (!name.endsWith('.html') || name === 'index.html') continue;
      const p = path.join('blog', name);
      const before = load(p);
      const slug = name.slice(0, -5);
      const asset = bySlug.get(slug) || (fs.existsSync(abs(`blog/assets/${slug}.jpg`)) ? `blog/assets/${slug}.jpg` : null);
      if (!asset) continue;

      const url = `https://smelloff.in/${asset}`;
      let html = before;
      if (/<meta[^>]+property=["']og:image["']/i.test(html)) {
        html = html.replace(/(<meta[^>]+property=["']og:image["'][^>]*content=["'])[^"']*/i, `$1${url}`);
      } else if (/<meta[^>]+content=["'][^"']*["'][^>]+property=["']og:image["']/i.test(html)) {
        html = html.replace(/(<meta[^>]+content=["'])[^"']*(["'][^>]+property=["']og:image["'][^>]*>)/i, `$1${url}$2`);
      } else {
        html = html.replace(/<\/head>/i, `  <meta property="og:image" content="${url}">\n</head>`);
      }

      if (/<meta[^>]+name=["']twitter:image["']/i.test(html)) {
        html = html.replace(/(<meta[^>]+name=["']twitter:image["'][^>]*content=["'])[^"']*/i, `$1${url}`);
      } else if (/<meta[^>]+content=["'][^"']*["'][^>]+name=["']twitter:image["']/i.test(html)) {
        html = html.replace(/(<meta[^>]+content=["'])[^"']*(["'][^>]+name=["']twitter:image["'][^>]*>)/i, `$1${url}$2`);
      } else {
        html = html.replace(/<\/head>/i, `  <meta name="twitter:image" content="${url}">\n</head>`);
      }

      save(p, before, html);
    }
  }
}

// Server-generate an order code in the Supabase order pipeline when the client
// does not provide one. Existing client-supplied codes are preserved.
{
  const p = 'supabase/functions/create-order/index.ts';
  need(p);
  const before = load(p);
  let html = before;

  if (!html.includes('function generateOrderCode()')) {
    const marker = 'const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n';
    const helper = `${marker}\nfunction generateOrderCode(): string {\n  const now = new Date();\n  const y = now.getUTCFullYear();\n  const m = String(now.getUTCMonth() + 1).padStart(2, "0");\n  const d = String(now.getUTCDate()).padStart(2, "0");\n  const r = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;\n  return \`SMF-\${y}\${m}\${d}-\${String(r).padStart(4, "0")}\`;\n}\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate order-code helper insertion point');
    html = html.replace(marker, helper);
  }

  if (!html.includes('const generatedOrderCode = generateOrderCode();')) {
    const marker = '    const order_code = ORDER_CODE_RE.test(codeRaw) ? codeRaw : null;\n';
    const repl = `    const requestedOrderCode = ORDER_CODE_RE.test(codeRaw) ? codeRaw : null;\n    const generatedOrderCode = generateOrderCode();\n    let order_code = requestedOrderCode || generatedOrderCode;\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate order_code assignment');
    html = html.replace(marker, repl);
  }

  if (!html.includes('let insertAttempts = 0;')) {
    if (html.includes('.select("id")')) html = html.replace('.select("id")', '.select("id,order_code")');
    const marker = '    const { data, error } = await supabase\n      .from("orders")\n      .insert({\n';
    const repl = `    let insertAttempts = 0;\n    let data = null;\n    let error = null;\n    while (insertAttempts < 3) {\n      insertAttempts++;\n      const result = await supabase\n        .from("orders")\n        .insert({\n`;
    if (!html.includes(marker)) throw new Error('Unable to locate Supabase insert');
    html = html.replace(marker, repl);
    const end = `      .select("id,order_code")\n      .single();\n\n    if (error) throw error;\n`;
    const endRepl = `        .select("id,order_code")\n        .single();\n      data = result.data;\n      error = result.error;\n      if (!error) break;\n      if (String(error.code) === "23505" && !requestedOrderCode && insertAttempts < 3) {\n        order_code = generateOrderCode();\n        continue;\n      }\n      break;\n    }\n\n    if (error) throw error;\n`;
    if (!html.includes(end)) throw new Error('Unable to locate Supabase insert terminator');
    html = html.replace(end, endRepl);
  }

  save(p, before, html);
}

console.log('Final production hardening pass prepared.');
