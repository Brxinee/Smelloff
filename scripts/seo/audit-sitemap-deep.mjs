import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const LIVE = process.argv.includes('--live');

const vercelConfig = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const redirects = vercelConfig.redirects || [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const htmlFiles = walk(REPO);
const expectedUrls = new Set();
const ORIGIN = 'https://smelloff.in';
const noindexUrls = new Set();

htmlFiles.forEach(file => {
  let rel = path.relative(REPO, file).split(path.sep).join('/');
  rel = rel.replace(/\.html$/, '');
  let urlPath = '/' + rel;
  if (urlPath === '/index') urlPath = '/';
  else urlPath = urlPath.replace(/\/index$/, '');

  const html = fs.readFileSync(file, 'utf8');
  const isNoindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html) || /^\/google[0-9a-f]{16,}$/.test(urlPath) || urlPath === '/404' || urlPath === '/payment-failed';
  
  if (isNoindex) {
    noindexUrls.add(ORIGIN + urlPath);
  } else {
    expectedUrls.add(ORIGIN + urlPath);
  }
});

const sitemapXml = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
const sitemapUrls = new Set();
let errors = [];

// Parse XML basic stuff manually
const locMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)];
const lastmodMatches = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];

if (locMatches.length !== lastmodMatches.length) {
  errors.push(`Malformed XML: loc count (${locMatches.length}) != lastmod count (${lastmodMatches.length})`);
}

const seenUrls = new Set();
locMatches.forEach((m, i) => {
  const url = m[1];
  if (seenUrls.has(url)) {
    errors.push(`Duplicate URL in sitemap: ${url}`);
  }
  seenUrls.add(url);
  sitemapUrls.add(url);

  const lastmod = lastmodMatches[i][1];
  const today = new Date().toISOString().split('T')[0];
  if (lastmod > today) {
    errors.push(`Future lastmod date: ${lastmod} for URL ${url}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
    errors.push(`Invalid lastmod format: ${lastmod} for URL ${url}. Must be YYYY-MM-DD.`);
  }
  if (url !== ORIGIN + '/' && url.endsWith('/')) {
    errors.push(`Invalid trailing slash on canonical URL: ${url}`);
  }
  if (!url.startsWith('https://')) {
    errors.push(`Sitemap URL must be HTTPS: ${url}`);
  }
});

// Check Image sitemap URLs
const imageLocMatches = [...sitemapXml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)];
for (const m of imageLocMatches) {
  const imgUrl = m[1];
  if (!imgUrl.startsWith('https://')) {
    errors.push(`Image URL must be absolute HTTPS: ${imgUrl}`);
  }
  if (!imgUrl.startsWith(ORIGIN)) {
    errors.push(`Image URL must be on canonical host: ${imgUrl}`);
  }
  // Remove ORIGIN from imgUrl and check if file exists
  const imgPath = imgUrl.replace(ORIGIN, '').split('?')[0];
  if (!fs.existsSync(path.join(REPO, imgPath))) {
    errors.push(`Image in sitemap does not actually exist: ${imgUrl}`);
  }
}

// Compare Expected vs Sitemap
for (const url of expectedUrls) {
  if (!sitemapUrls.has(url)) {
    errors.push(`Missing indexable URL from sitemap: ${url}`);
  }
}

for (const url of sitemapUrls) {
  if (!expectedUrls.has(url)) {
    errors.push(`Extra URL in sitemap: ${url}`);
  }
  if (noindexUrls.has(url)) {
    errors.push(`Sitemap contains noindex URL: ${url}`);
  }
}

// Check Canonical tags
for (const file of htmlFiles) {
  let rel = path.relative(REPO, file).split(path.sep).join('/');
  rel = rel.replace(/\.html$/, '');
  let urlPath = '/' + rel;
  if (urlPath === '/index') urlPath = '/';
  else urlPath = urlPath.replace(/\/index$/, '');
  const url = ORIGIN + urlPath;

  if (sitemapUrls.has(url)) {
    const html = fs.readFileSync(file, 'utf8');
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
    if (!canonicalMatch) {
      errors.push(`Missing canonical tag in ${file}`);
    } else {
      const canonicalUrl = canonicalMatch[1];
      if (canonicalUrl !== url) {
        errors.push(`Canonical mismatch: ${url} has canonical ${canonicalUrl}`);
      }
    }
  }
}

// Check against redirects
for (const r of redirects) {
  if (r.source && !r.source.includes(':') && !r.source.includes('(')) {
     // match simple paths
     const srcUrl = ORIGIN + r.source;
     if (sitemapUrls.has(srcUrl)) {
       errors.push(`Sitemap URL is a redirect source: ${srcUrl}`);
     }
  }
}

// Check robots.txt
const robotsTxt = fs.readFileSync(path.join(REPO, 'robots.txt'), 'utf8');
if (!robotsTxt.includes('Sitemap: https://smelloff.in/sitemap.xml')) {
  errors.push('robots.txt is missing exactly "Sitemap: https://smelloff.in/sitemap.xml"');
}
if (!robotsTxt.includes('Disallow: /api/') || !robotsTxt.includes('Disallow: /admin') || !robotsTxt.includes('Disallow: /outreach/')) {
  errors.push('robots.txt is missing Disallow rules for /api/, /admin, or /outreach/');
}
// Validate that GPTBot and others don't reopen private routes
const agents = ['GPTBot', 'Googlebot', 'Bingbot'];
for (const agent of agents) {
  const agentBlockRegex = new RegExp(`User-agent: ${agent}[\\s\\S]*?(?=User-agent:|$)`, 'g');
  const blocks = robotsTxt.match(agentBlockRegex);
  if (blocks) {
    for (const block of blocks) {
      if (block.includes('Allow: /') && !block.includes('Disallow: /api/')) {
        errors.push(`robots.txt: Agent ${agent} overrides global rules and reopens /api/`);
      }
    }
  }
}

console.log(`Total expected indexable pages: ${expectedUrls.size}`);
console.log(`Total sitemap URLs: ${sitemapUrls.size}`);

async function runLiveChecks() {
  console.log('\nRunning live checks...');
  let hasLiveError = false;
  
  try {
    const robotsRes = await fetch(ORIGIN + '/robots.txt');
    if (robotsRes.status !== 200) {
      console.error(`Live robots.txt check failed: status ${robotsRes.status}`);
      hasLiveError = true;
    } else {
      const robotsTxt = await robotsRes.text();
      if (!robotsTxt.includes('Sitemap: https://smelloff.in/sitemap.xml')) {
        console.error('Live robots.txt is missing Sitemap declaration.');
        hasLiveError = true;
      }
    }
  } catch (e) {
    console.error('Failed to fetch live robots.txt:', e.message);
    hasLiveError = true;
  }
  
  // Sample a few URLs
  const samples = Array.from(sitemapUrls).slice(0, 5);
  for (const url of samples) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 300) {
        console.error(`Live check failed for ${url}: status ${res.status}`);
        hasLiveError = true;
      }
    } catch(e) {
       console.error(`Failed to fetch ${url}:`, e.message);
       hasLiveError = true;
    }
  }
  
  if (hasLiveError) {
    console.error("Live checks failed.");
    process.exit(1);
  } else {
    console.log("Live checks passed.");
  }
}

if (errors.length > 0) {
  console.error("\nDeep audit failed with errors:\n" + errors.join('\n'));
  process.exit(1);
} else {
  console.log("\nDeep audit passed! No missing, extra, or redirecting URLs found in sitemap.");
  console.log("Robots.txt rules and XML format are completely valid.");
  if (LIVE) {
    runLiveChecks();
  }
}
