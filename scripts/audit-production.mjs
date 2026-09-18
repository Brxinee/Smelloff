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
  return (relPath.endsWith('.html') || relPath.endsWith('.xml') || relPath.endsWith('.txt')) && !relPath.startsWith('_shared/');
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
  { name: 'Obsolete 8 seconds speed claim', regex: /\b(?:works|neutralizes[a-z\s]*|in)\s+8\s+seconds\b/i },
  { name: 'Obsolete manual UPI element', regex: /\b(?:upiInlineId|upiBlock|wa-utr-btn)\b/i },
  { name: 'Obsolete manual UPI transfer instructions', regex: /\bmanual\s+upi\s+transfer\b|\b12-digit\s+UTR\b|\bsubmit\s+utr\b|\bupload\s+screenshot\b|\bpay\s+manually\b/i },
  { name: 'Obsolete direct UPI ID', regex: /\b(?:mr\.brainy@ibl|smelloff@ybl)\b/i },
  { name: 'Stale free COD claim', regex: /\bfree\s+cod\b|\bfree\s+cash\s+on\s+delivery\b/i },
  { name: 'Fragrance-free false claim', regex: /\b(?:100%\s*fragrance[- ]free|entirely\s+unscented|completely\s+scentless)\b|\bODORSTRIKE\s+is\s+(?:fragrance-free|unscented|scentless)\b/i },
  { name: 'Formula percentage leak', regex: /\b(?:86%\s*(?:distilled\s+)?water|1\.5%\s*(?:Zinc|β|beta))\b/i },
  { name: 'Obsolete helmet liner usage claim', regex: /\bODORSTRIKE\s+on\s+the\s+helmet\s+liner\b/i }
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

  // Product JSON-LD check: exactly one Product schema node, matching authoritative specs
  const jsonLdBlocks = [...odorHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let productCount = 0;
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (parsed['@type'] === 'Product' || (Array.isArray(parsed) && parsed.some(x => x['@type'] === 'Product'))) {
        productCount++;
      }
    } catch (_e) {}
  }
  if (productCount !== 1) fail(`odorstrike.html must contain exactly 1 Product JSON-LD block, found ${productCount}`);
  if (odorHtml.includes('googleReviewWidgetMount')) fail('odorstrike.html must not contain googleReviewWidgetMount');
  if (odorHtml.includes('pData.aggregateRating') || odorHtml.includes('productScript.textContent = JSON.stringify')) {
    fail('odorstrike.html must not dynamically mutate Product JSON-LD schema at runtime');
  }
}

// Review system integrity checks
const reviewsSystemPath = path.join(ROOT, 'assets/js/reviews-system.js');
if (fs.existsSync(reviewsSystemPath)) {
  const code = read(reviewsSystemPath);
  if (code.includes('renderGoogleReviewWidget')) fail('reviews-system.js must not contain renderGoogleReviewWidget');
  if (code.includes('injectAggregateSchema')) fail('reviews-system.js must not dynamically inject or mutate Product JSON-LD');
  if (code.includes('google-review-aggregate-ld')) fail('reviews-system.js must not contain google-review-aggregate-ld');
  if (/\b(?:4\.9|128)\b/.test(code)) fail('reviews-system.js must not contain hardcoded fake rating fallbacks (4.9 / 128)');
  if (code.includes('100% Verified Customer Purchases')) fail('reviews-system.js must not claim 100% Verified Customer Purchases');
}

const reviewsPagePath = path.join(ROOT, 'reviews.html');
if (fs.existsSync(reviewsPagePath)) {
  const reviewsHtml = read(reviewsPagePath);
  if (reviewsHtml.includes('googleReviewWidgetMount')) fail('reviews.html must not contain googleReviewWidgetMount');
  if (/<span class="agg-num"[^>]*>4\.9<\/span>/.test(reviewsHtml)) fail('reviews.html initial HTML must not hardcode 4.9 rating');
}

// Supabase edge functions review authorization and eligibility checks
const submitReviewPath = path.join(ROOT, 'supabase/functions/submit-review/index.ts');
if (fs.existsSync(submitReviewPath)) {
  const code = read(submitReviewPath);
  if (!code.includes('verifyReviewToken')) fail('submit-review must verify review token');
  if (code.includes('orderPhone === phone')) fail('submit-review must not have a phone-only authorization bypass');
  if (!code.includes('isOrderReviewEligible')) fail('submit-review must enforce order review eligibility server-side');
}

const trackOrderPath = path.join(ROOT, 'supabase/functions/track-order/index.ts');
if (fs.existsSync(trackOrderPath)) {
  const code = read(trackOrderPath);
  if (!code.includes('isOrderReviewEligible')) fail('track-order must check order review eligibility before issuing token');
}

const securitySharedPath = path.join(ROOT, 'supabase/functions/_shared/security.ts');
if (fs.existsSync(securitySharedPath)) {
  const code = read(securitySharedPath);
  if (!code.includes('isOrderReviewEligible')) fail('_shared/security.ts must export isOrderReviewEligible');
  if (!code.includes('constantTimeEqual')) fail('_shared/security.ts must use constant-time equality for token verification');
}

// ===========================================================================
// SEO, CANONICAL, SITEMAP & REDIRECT ARCHITECTURE GUARDRAILS
// ===========================================================================

// 1. Canonical, Hreflang, and OpenGraph URL verification for all indexable pages
const htmlFiles = files.filter(p => p.endsWith('.html'));
const indexableHtmlFiles = [];

for (const p of htmlFiles) {
  const relPath = rel(p).replace(/\\/g, '/');
  if (relPath.startsWith('node_modules/') || relPath.startsWith('.git/') || relPath.startsWith('_shared/') || relPath.startsWith('api/') || relPath.startsWith('supabase/') || relPath.startsWith('emails/') || relPath.startsWith('admin/') || relPath.startsWith('outreach/')) continue;
  if (relPath === '404.html' || relPath === 'payment-failed.html' || /^google[0-9a-f]{16,}\.html$/i.test(relPath)) continue;

  const html = read(p);
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) continue;

  indexableHtmlFiles.push({ path: relPath, html });

  let urlSlug = relPath.replace(/\.html$/, '');
  if (urlSlug === 'index') urlSlug = '';
  urlSlug = urlSlug.replace(/\/index$/, '');
  const expectedCanonical = 'https://smelloff.in' + (urlSlug ? '/' + urlSlug : '/');

  // Check canonical tag
  const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                     html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonHref = canonMatch ? canonMatch[1] : null;

  if (!canonHref) {
    fail(`${relPath}: missing rel="canonical" tag`);
  } else {
    if (canonHref !== expectedCanonical) {
      fail(`${relPath}: canonical tag is "${canonHref}", expected "${expectedCanonical}"`);
    }
    if (canonHref.includes('www.smelloff.in')) {
      fail(`${relPath}: canonical tag contains www.smelloff.in`);
    }
    if (canonHref.endsWith('.html')) {
      fail(`${relPath}: canonical tag ends with .html`);
    }
    if (canonHref !== 'https://smelloff.in/' && canonHref.endsWith('/')) {
      fail(`${relPath}: canonical tag contains trailing slash ("${canonHref}")`);
    }
  }

  // Check reciprocal hreflang tags
  const enInMatch = html.match(/<link[^>]+hreflang=["']en-IN["'][^>]+href=["']([^"']+)["']/i);
  const xDefMatch = html.match(/<link[^>]+hreflang=["']x-default["'][^>]+href=["']([^"']+)["']/i);

  if (!enInMatch || enInMatch[1] !== expectedCanonical) {
    fail(`${relPath}: missing or mismatched hreflang="en-IN" tag (expected "${expectedCanonical}")`);
  }
  if (!xDefMatch || xDefMatch[1] !== expectedCanonical) {
    fail(`${relPath}: missing or mismatched hreflang="x-default" tag (expected "${expectedCanonical}")`);
  }

  // Check og:url
  const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  if (ogUrlMatch && ogUrlMatch[1] !== expectedCanonical) {
    fail(`${relPath}: og:url ("${ogUrlMatch[1]}") does not match canonical ("${expectedCanonical}")`);
  }
}

// 2. Sitemap integrity and XML entity escaping
const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml does not exist');
} else {
  const sitemapXml = read(sitemapPath);
  const sitemapLocs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const sitemapLastmods = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
  const today = new Date().toISOString().slice(0, 10);

  // Check count parity
  if (sitemapLocs.length !== indexableHtmlFiles.length) {
    fail(`sitemap.xml contains ${sitemapLocs.length} URLs, but repository has ${indexableHtmlFiles.length} indexable pages`);
  }

  // Check no double entity escaping
  if (/&amp;(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/i.test(sitemapXml)) {
    fail('sitemap.xml contains double-escaped XML entities (e.g. &amp;amp;)');
  }
  // Check no unescaped ampersands
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(sitemapXml)) {
    fail('sitemap.xml contains raw unescaped ampersands');
  }

  // Check lastmods
  for (const lm of sitemapLastmods) {
    if (lm > today) {
      fail(`sitemap.xml contains future lastmod: ${lm}`);
    }
  }

  // Check every sitemap URL is valid
  for (const loc of sitemapLocs) {
    if (!loc.startsWith('https://smelloff.in')) fail(`sitemap URL does not start with https://smelloff.in: ${loc}`);
    if (loc.includes('www.smelloff.in')) fail(`sitemap URL contains www: ${loc}`);
    if (loc.endsWith('.html')) fail(`sitemap URL ends with .html: ${loc}`);
    if (loc !== 'https://smelloff.in/' && loc.endsWith('/')) fail(`sitemap URL has trailing slash: ${loc}`);
  }
}

// 3. Vercel redirect rules integrity
const vercelPath = path.join(ROOT, 'vercel.json');
if (fs.existsSync(vercelPath)) {
  const vercelConfig = JSON.parse(read(vercelPath));
  const redirects = vercelConfig.redirects || [];

  const generalSources = new Set(redirects.filter(r => !r.has).map(r => r.source));

  for (const r of redirects) {
    let dest = r.destination;
    if (dest.startsWith('https://smelloff.in')) {
      dest = dest.replace('https://smelloff.in', '');
    }
    if (!dest) dest = '/';

    // Prevent redirect chains within configuration
    if (!dest.includes(':') && !dest.includes('$') && generalSources.has(dest)) {
      fail(`vercel.json redirect chain detected: ${r.source} -> ${r.destination} (which is another redirect source)`);
    }

    // Ensure www rules point to canonical domain
    if (r.has && r.has.some(h => h.value === 'www.smelloff.in')) {
      if (!r.destination.startsWith('https://smelloff.in')) {
        fail(`www redirect rule for "${r.source}" does not target https://smelloff.in (got "${r.destination}")`);
      }
    }
  }
}

if (failures.length) {
  console.error(`Production audit failed (${failures.length}):`);
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}
console.log(`Production audit passed: ${customerFacingFiles.length} customer-facing files checked (${blogFiles.length} blog pages).`);
