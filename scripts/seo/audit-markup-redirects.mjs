import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const vercelJson = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));

const redirects = new Map();
if (vercelJson.redirects) {
  for (const r of vercelJson.redirects) {
    if (r.source && r.destination) redirects.set(r.source, r.destination);
  }
}

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(REPO);

console.log(`Auditing ${htmlFiles.length} HTML files for redirecting URLs in markup...\n`);

let issues = 0;

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');

  // Find all attributes with URLs: href, src, content (for og:url, canonical, JSON-LD, etc)
  const matches = html.matchAll(/(href|src|content|url)=["']([^"']+)["']/gi);
  for (const m of matches) {
    const attr = m[1];
    const val = m[2];

    // Ignore non-site URLs
    if (val.startsWith('#') || val.startsWith('mailto:') || val.startsWith('tel:') || val.startsWith('data:')) continue;
    
    // Check if it's an internal path or smelloff.in URL
    if (val.startsWith('/') || val.includes('smelloff.in')) {
      const urlObj = val.startsWith('http') ? new URL(val) : new URL(val, 'https://smelloff.in');
      let pathname = urlObj.pathname;

      // Check 1: Trailing slash (except root '/')
      if (pathname.length > 1 && pathname.endsWith('/')) {
        console.log(`[${rel}] ${attr}="${val}" has trailing slash -> redirects under trailingSlash:false`);
        issues++;
      }

      // Check 2: .html extension in internal page link/canonical/og
      if (pathname.endsWith('.html') && !pathname.includes('google163974d1a8d940cf89b0ec712246c779')) {
        console.log(`[${rel}] ${attr}="${val}" ends with .html -> 308 redirects under cleanUrls:true`);
        issues++;
      }

      // Check 3: Matches vercel.json redirect source
      const cleanPath = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      if (redirects.has(pathname) || redirects.has(cleanPath)) {
        const dest = redirects.get(pathname) || redirects.get(cleanPath);
        console.log(`[${rel}] ${attr}="${val}" matches redirect rule -> 301/308 redirects to ${dest}`);
        issues++;
      }
    }
  }
}

console.log(`\nAudit finished. Total issues in HTML attributes: ${issues}`);
