import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const ORIGIN = 'https://smelloff.in';

// List of skipped dirs
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase',
  '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel'
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function urlPathFor(file) {
  let rel = path.relative(REPO, file).split(path.sep).join('/').replace(/\.html$/, '');
  if (rel === 'index') return '/';
  rel = rel.replace(/\/index$/, '');
  return `/${rel}`;
}

const htmlFiles = walk(REPO);
const pageData = new Map(); // urlPath -> details

// Read sitemap
const sitemapXml = fs.existsSync(path.join(REPO, 'sitemap.xml')) ? fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8') : '';
const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');
  const urlPath = urlPathFor(file);
  const fullUrl = ORIGIN + (urlPath === '/' ? '/' : urlPath);

  const title = (html.match(/<title>([^<]+)<\/title>/i) || [null, ''])[1].trim();
  const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const ogUrl = (html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const ogImg = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [null, ''])[1].trim();
  const isNoIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  
  // Extract JSON-LD blocks
  const jsonLdBlocks = [];
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      jsonLdBlocks.push(JSON.parse(m[1]));
    } catch (e) {
      jsonLdBlocks.push({ parseError: e.message, raw: m[1] });
    }
  }

  pageData.set(urlPath, {
    file: rel,
    urlPath,
    fullUrl,
    title,
    metaDesc,
    canonical,
    ogTitle,
    ogDesc,
    ogUrl,
    ogImg,
    isNoIndex,
    jsonLdBlocks,
    inSitemap: sitemapUrls.has(fullUrl),
    incomingLinks: 0
  });
}

// Map incoming links
for (const [srcPath, srcInfo] of pageData.entries()) {
  const file = path.join(REPO, srcInfo.file);
  const html = fs.readFileSync(file, 'utf8');

  for (const [targetPath, targetInfo] of pageData.entries()) {
    if (srcPath === targetPath) continue;
    
    // Search for link to targetPath in src html
    const targetUrl = targetInfo.fullUrl;
    const targetRel = targetPath;
    
    if (html.includes(`href="${targetUrl}"`) || html.includes(`href="${targetRel}"`) || html.includes(`href="${targetRel}.html"`)) {
      targetInfo.incomingLinks++;
    }
  }
}

console.log(`=== FULL SITE SEO AUDIT (${pageData.size} pages) ===\n`);

const titles = new Map();
const descriptions = new Map();
let indexableCount = 0;
let errors = [];

for (const [urlPath, p] of pageData.entries()) {
  if (p.isNoIndex || urlPath === '/404' || urlPath.startsWith('/google')) {
    console.log(`[NOINDEX/EXCLUDED] ${urlPath} (${p.file})`);
    continue;
  }

  indexableCount++;

  // 1. Check title
  if (!p.title) errors.push(`${urlPath}: MISSING <title>`);
  else {
    if (titles.has(p.title)) errors.push(`${urlPath}: DUPLICATE <title> with ${titles.get(p.title)}`);
    else titles.set(p.title, urlPath);
  }

  // 2. Check description
  if (!p.metaDesc) errors.push(`${urlPath}: MISSING meta description`);
  else {
    if (descriptions.has(p.metaDesc)) errors.push(`${urlPath}: DUPLICATE meta description with ${descriptions.get(p.metaDesc)}`);
    else descriptions.set(p.metaDesc, urlPath);
  }

  // 3. Check canonical
  if (!p.canonical) errors.push(`${urlPath}: MISSING canonical tag`);
  else if (p.canonical !== p.fullUrl) errors.push(`${urlPath}: CANONICAL MISMATCH (got ${p.canonical}, expected ${p.fullUrl})`);

  // 4. Check og:url
  if (p.ogUrl && p.ogUrl !== p.fullUrl) errors.push(`${urlPath}: og:url MISMATCH (got ${p.ogUrl}, expected ${p.fullUrl})`);

  // 5. Check in sitemap
  if (!p.inSitemap) errors.push(`${urlPath}: NOT IN SITEMAP`);

  // 6. Check incoming links
  if (p.incomingLinks === 0 && urlPath !== '/') errors.push(`${urlPath}: ORPHAN PAGE (0 internal incoming links)`);

  // 7. Check JSON-LD
  for (const block of p.jsonLdBlocks) {
    if (block.parseError) errors.push(`${urlPath}: INVALID JSON-LD (${block.parseError})`);
  }
}

console.log(`Indexable pages: ${indexableCount}`);
if (errors.length === 0) {
  console.log('\nPASSED: Zero SEO / Indexing errors found across all pages!');
} else {
  console.log(`\nFAILED: Found ${errors.length} SEO issue(s):\n`);
  for (const err of errors) {
    console.log(`- ${err}`);
  }
}
