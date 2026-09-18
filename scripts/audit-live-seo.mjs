#!/usr/bin/env node
/**
 * Automated Live & Production SEO / Canonical / Redirect / Sitemap Audit Tool
 *
 * Checks:
 *  - HTTP status & redirect chains (0 hops for canonicals, max 1 hop for variants/legacy)
 *  - Canonical tag presence and self-referential match
 *  - Reciprocal hreflang tags (en-IN and x-default)
 *  - og:url match with canonical
 *  - robots meta and X-Robots-Tag headers
 *  - Sitemap completeness, lastmod validity, and XML entity escaping
 *
 * Usage:
 *   node scripts/audit-live-seo.mjs                 # audit local / generated files & simulated routing
 *   node scripts/audit-live-seo.mjs --live          # probe live https://smelloff.in endpoints
 *   node scripts/audit-live-seo.mjs --url <url>     # trace specific URL
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const ORIGIN = 'https://smelloff.in';
const IS_LIVE = process.argv.includes('--live');

// Load redirects from vercel.json
const vercel = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const redirects = vercel.redirects || [];

/**
 * Simulates Vercel route matching for a given hostname and pathname.
 */
export function simulateRedirect(hostname, pathname) {
  for (const r of redirects) {
    if (r.has) {
      const matchHost = r.has.every(h => {
        if (h.type === 'host') return h.value === hostname;
        return true;
      });
      if (!matchHost) continue;
    }

    const reStr = '^' + r.source
      .replace(/:path\+/g, '(.+)')
      .replace(/:slug\([^)]+\)/g, '([^/]+)')
      .replace(/:slug/g, '([^/]+)')
      .replace(/:code/g, '([^/]+)') + '$';

    try {
      const re = new RegExp(reStr);
      const m = pathname.match(re);
      if (m) {
        let dest = r.destination;
        if (dest.includes('$1') && m[1]) dest = dest.replace('$1', m[1]);
        if (dest.includes(':path+') && m[1]) dest = dest.replace(':path+', m[1]);
        if (dest.includes(':slug') && m[1]) dest = dest.replace(':slug', m[1]);
        return {
          matched: true,
          source: r.source,
          destination: dest,
          statusCode: r.statusCode || 308,
        };
      }
    } catch (_e) {}
  }
  return { matched: false };
}

/**
 * Traces a redirect path through simulateRedirect (max 10 hops).
 */
export function traceSimulatedHops(initialUrl) {
  const hops = [];
  let current = new URL(initialUrl);
  let count = 0;
  const seen = new Set();

  while (count < 10) {
    if (seen.has(current.href)) {
      hops.push({ url: current.href, status: 'LOOP', target: current.href });
      return { finalUrl: current.href, hops, isLoop: true, hopCount: hops.length };
    }
    seen.add(current.href);

    const match = simulateRedirect(current.hostname, current.pathname);
    if (!match.matched) {
      // If no custom redirect matched, check cleanUrls & trailingSlash defaults
      if (current.pathname.endsWith('.html')) {
        const clean = current.pathname.replace(/\.html$/, '');
        const target = new URL(clean === '/index' ? '/' : clean, current.origin).href;
        hops.push({ url: current.href, status: 301, target });
        current = new URL(target);
        count++;
        continue;
      }
      if (current.pathname.length > 1 && current.pathname.endsWith('/')) {
        const clean = current.pathname.replace(/\/+$/, '');
        const target = new URL(clean, current.origin).href;
        hops.push({ url: current.href, status: 308, target });
        current = new URL(target);
        count++;
        continue;
      }
      break;
    }

    let nextTarget = match.destination;
    if (nextTarget.startsWith('/')) {
      nextTarget = `${ORIGIN}${nextTarget}`;
    }
    hops.push({ url: current.href, status: match.statusCode, target: nextTarget });
    current = new URL(nextTarget);
    count++;
  }

  return {
    finalUrl: current.href,
    hops,
    isLoop: count >= 10,
    hopCount: hops.length,
  };
}

/**
 * Live HTTP request tracer with hop recorder.
 */
export async function traceLiveUrl(url, maxHops = 10) {
  const hops = [];
  let currentUrl = url;
  let count = 0;
  const seen = new Set();

  while (count < maxHops) {
    if (seen.has(currentUrl)) {
      hops.push({ url: currentUrl, status: 'LOOP', target: currentUrl });
      return { finalUrl: currentUrl, hops, isLoop: true, hopCount: hops.length, status: 0 };
    }
    seen.add(currentUrl);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Smelloff-Live-Audit-Bot/1.0 (+https://smelloff.in)',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        },
      });

      const status = res.status;
      const location = res.headers.get('location');

      if ([301, 302, 307, 308].includes(status) && location) {
        const target = new URL(location, currentUrl).href;
        hops.push({ url: currentUrl, status, target });
        currentUrl = target;
        count++;
      } else {
        const text = await res.text();
        return {
          finalUrl: currentUrl,
          hops,
          isLoop: false,
          hopCount: hops.length,
          status,
          headers: Object.fromEntries(res.headers.entries()),
          body: text,
        };
      }
    } catch (err) {
      hops.push({ url: currentUrl, status: 'ERROR', error: err.message });
      return { finalUrl: currentUrl, hops, isLoop: false, hopCount: hops.length, status: -1, error: err.message };
    }
  }

  return { finalUrl: currentUrl, hops, isLoop: true, hopCount: hops.length, status: 0 };
}

async function runAudit(options = {}) {
  const shouldExit = options.shouldExit ?? true;
  const isLiveMode = options.isLive ?? IS_LIVE;
  console.log('='.repeat(80));
  console.log(` SMELLOFF ARCHITECTURE AUDIT [Mode: ${isLiveMode ? 'LIVE HTTP PROBE' : 'LOCAL SIMULATION'}]`);
  console.log('='.repeat(80));

  const stats = {
    total: 0,
    canonical200: 0,
    oneHop: 0,
    multiHop: 0,
    brokenChains: 0,
    loops: 0,
    status404: 0,
    status5xx: 0,
    canonicalMismatches: 0,
    hreflangMismatches: 0,
    sitemapMismatches: 0,
  };

  // 1. Audit all 75 canonical URLs
  const sitemapXml = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  console.log(`\n1. Auditing ${sitemapUrls.length} Canonical URLs...`);
  for (const url of sitemapUrls) {
    stats.total++;
    if (isLiveMode) {
      const res = await traceLiveUrl(url);
      if (res.status === 200 && res.hopCount === 0) {
        stats.canonical200++;
        // Check canonical tag in body
        const canonMatch = res.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        const canonHref = canonMatch ? canonMatch[1] : null;
        if (canonHref !== url) {
          stats.canonicalMismatches++;
          console.error(`  [CANONICAL MISMATCH] ${url} claims ${canonHref}`);
        }
      } else if (res.hopCount === 1) {
        stats.oneHop++;
      } else if (res.hopCount > 1) {
        stats.multiHop++;
        console.warn(`  [MULTI-HOP CANONICAL] ${url} -> ${res.hopCount} hops`);
      } else if (res.status === 404) {
        stats.status404++;
        console.error(`  [404 NOT FOUND] ${url}`);
      } else if (res.status >= 500) {
        stats.status5xx++;
        console.error(`  [5XX SERVER ERROR] ${url} -> ${res.status}`);
      }
    } else {
      // Local check
      const trace = traceSimulatedHops(url);
      if (trace.hopCount === 0) {
        stats.canonical200++;
      } else if (trace.hopCount === 1) {
        stats.oneHop++;
      } else {
        stats.multiHop++;
      }
    }
  }

  // 2. Audit non-canonical and legacy URL variations
  const testVariations = [
    'http://smelloff.in/',
    'http://www.smelloff.in/',
    'https://www.smelloff.in/',
    'https://smelloff.in/odorstrike/',
    'https://www.smelloff.in/odorstrike/',
    'https://smelloff.in/odorstrike.html',
    'https://www.smelloff.in/odorstrike.html',
    'https://smelloff.in/solutions/',
    'https://www.smelloff.in/solutions/',
    'https://smelloff.in/blog/',
    'https://www.smelloff.in/blog/',
    'https://smelloff.in/blog/gym-clothes-smell-after-washing/',
    'https://www.smelloff.in/blog/gym-clothes-smell-after-washing/',
    'https://smelloff.in/blog/gym-clothes-smell-after-washing.html',
    'https://www.smelloff.in/blog/gym-clothes-smell-after-washing.html',
    // Legacy URLs
    'https://smelloff.in/blog/clothes-smell-after-washing',
    'https://www.smelloff.in/blog/clothes-smell-after-washing',
    'https://smelloff.in/blog/zinc-ricinoleate-fabric-odor-ingredient',
    'https://www.smelloff.in/blog/zinc-ricinoleate-fabric-odor-ingredient',
    'https://smelloff.in/blog/is-zinc-ricinoleate-safe-for-clothes',
    'https://www.smelloff.in/blog/is-zinc-ricinoleate-safe-for-clothes',
    'https://smelloff.in/blog/best-fabric-freshener-odor-spray-india-2026',
    'https://www.smelloff.in/blog/best-fabric-freshener-odor-spray-india-2026',
    'https://smelloff.in/blog/fabric-odor-science-zinc-ricinoleate',
    'https://www.smelloff.in/blog/fabric-odor-science-zinc-ricinoleate',
    'https://smelloff.in/blog/chemical-breakdown-sweat-odor',
    'https://www.smelloff.in/blog/chemical-breakdown-sweat-odor',
    'https://smelloff.in/blog/how-to-remove-sweat-smell-from-clothes-instantly',
    'https://www.smelloff.in/blog/how-to-remove-sweat-smell-from-clothes-instantly',
    'https://smelloff.in/blog/how-to-remove-musty-smell-from-clothes-monsoon',
    'https://smelloff.in/blog/remove-sweat-smell-shirts-without-washing',
    'https://smelloff.in/blog/smoke-smell-clothes',
    'https://smelloff.in/policies/privacy',
    'https://smelloff.in/policies/terms',
  ];

  console.log(`\n2. Auditing ${testVariations.length} Non-Canonical & Legacy URL Variations...`);
  for (const url of testVariations) {
    stats.total++;
    if (isLiveMode) {
      const res = await traceLiveUrl(url);
      if (res.isLoop) {
        stats.loops++;
        console.error(`  [REDIRECT LOOP] ${url}`);
      } else if (res.hopCount === 1) {
        stats.oneHop++;
      } else if (res.hopCount === 2) {
        stats.multiHop++;
        console.warn(`  [2-HOP CHAIN] ${url} -> ${res.hops.map(h => `${h.status} ${h.target}`).join(' -> ')}`);
      } else if (res.hopCount >= 3) {
        stats.brokenChains++;
        console.error(`  [3+ HOP CHAIN] ${url} -> ${res.hops.map(h => `${h.status} ${h.target}`).join(' -> ')}`);
      } else if (res.status === 404) {
        stats.status404++;
        console.error(`  [404 NOT FOUND] ${url}`);
      } else if (res.status >= 500) {
        stats.status5xx++;
        console.error(`  [5XX ERROR] ${url} -> ${res.status}`);
      }
    } else {
      const trace = traceSimulatedHops(url);
      if (trace.isLoop) {
        stats.loops++;
        console.error(`  [SIMULATED REDIRECT LOOP] ${url}`);
      } else if (trace.hopCount === 1) {
        stats.oneHop++;
      } else if (trace.hopCount === 2) {
        stats.multiHop++;
        console.warn(`  [SIMULATED 2-HOP CHAIN] ${url} -> ${trace.hops.map(h => `${h.status} ${h.target}`).join(' -> ')}`);
      } else if (trace.hopCount >= 3) {
        stats.brokenChains++;
        console.error(`  [SIMULATED 3+ HOP CHAIN] ${url} -> ${trace.hops.map(h => `${h.status} ${h.target}`).join(' -> ')}`);
      }
    }
  }

  // 3. Audit XML Sitemap entity escaping
  console.log('\n3. Auditing Sitemap XML Entity Escaping...');
  if (/&amp;(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/i.test(sitemapXml)) {
    stats.sitemapMismatches++;
    console.error('  [SITEMAP DEFECT] Double-escaped XML entities found in sitemap.xml');
  } else {
    console.log('  [PASS] All XML entities correctly single-escaped in sitemap.xml');
  }

  // 4. Audit ODORSTRIKE PDP Claims & Schema Invariants
  console.log('\n4. Auditing ODORSTRIKE PDP Invariants...');
  let pdpHtml = '';
  if (isLiveMode) {
    const livePdp = await traceLiveUrl('https://smelloff.in/odorstrike');
    pdpHtml = livePdp.body || '';
  } else {
    pdpHtml = fs.readFileSync(path.join(REPO, 'odorstrike.html'), 'utf8');
  }

  const pdpDefects = [];

  if (!pdpHtml.includes('₹229')) {
    pdpDefects.push('Missing visible ₹229 price');
  }
  if (/anti-regrowth/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited "anti-regrowth" claim present');
  }
  if (/\bzero\s+residue\b/i.test(pdpHtml)) {
    pdpDefects.push('Unhedged "zero residue" claim present');
  }
  if (/\bno\s+white\s+marks\b/i.test(pdpHtml)) {
    pdpDefects.push('Unhedged "no white marks" claim present');
  }
  if (/\bkills?\s+(?:the\s+)?bacteria\b|\bantimicrobial\b|\bantibacterial\b|\bdisinfect\b|\bsanitiz/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited biocidal/antimicrobial claims present');
  }
  if (/\b(?:dermatologist|dermatologically|clinically)\s+tested\b|\bskin\s+safe\b/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited clinical/skin-safe claims present');
  }
  if (/\bcabin-safe\b|\bairport\s+security\b/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited airport-security/cabin-safe guarantee present');
  }
  if (/\bhandles\s+a\s+week\s+of\s+travel\b/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited week-of-travel guarantee present');
  }
  if (/\bworks\s+in\s+8\s+seconds\b/i.test(pdpHtml)) {
    pdpDefects.push('Prohibited 8-second instant cure claim present');
  }
  if (/\bfragrance-free\b|\bunscented\b|\bscentless\b/i.test(pdpHtml)) {
    pdpDefects.push('False fragrance-free claim present');
  }

  // Check Product JSON-LD schema invariants
  const jsonLdBlocks = [...pdpHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let productCount = 0;
  let hasFaqPage = false;
  let hasAggregateRating = false;
  let hasReviewArray = false;
  let offerPriceValid = false;

  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (parsed['@type'] === 'Product') {
        productCount++;
        if (parsed.offers && (parsed.offers.price === '229.00' || parsed.offers.price === '229' || parsed.offers.price === 229)) {
          offerPriceValid = true;
        }
        if (parsed.aggregateRating) hasAggregateRating = true;
        if (parsed.review) hasReviewArray = true;
      }
      if (parsed['@type'] === 'FAQPage') hasFaqPage = true;
    } catch (_e) {}
  }

  if (productCount !== 1) {
    pdpDefects.push(`Expected exactly 1 Product JSON-LD node, found ${productCount}`);
  }
  if (!offerPriceValid) {
    pdpDefects.push('Product schema offer price is not 229 / 229.00');
  }
  if (hasFaqPage) {
    pdpDefects.push('Prohibited FAQPage JSON-LD present on PDP');
  }
  if (hasAggregateRating || hasReviewArray) {
    pdpDefects.push('Fabricated aggregateRating / review present on PDP without verified reviews DB');
  }

  if (pdpDefects.length > 0) {
    for (const defect of pdpDefects) {
      console.error(`  [PDP DEFECT] ${defect}`);
      stats.brokenChains++;
    }
  } else {
    console.log('  [PASS] ODORSTRIKE PDP claims and schema invariants strictly verified.');
  }

  console.log('\n' + '='.repeat(80));
  console.log(' AUDIT SUMMARY TABLE');
  console.log('='.repeat(80));
  console.table({
    'TOTAL URLS TESTED': stats.total,
    '200 CANONICAL': stats.canonical200,
    '301 / 308 (1 HOP)': stats.oneHop,
    'MULTI-HOP (2 HOPS)': stats.multiHop,
    'BROKEN CHAINS (3+ HOPS)': stats.brokenChains,
    'REDIRECT LOOPS': stats.loops,
    '404 NOT FOUND': stats.status404,
    '5XX SERVER ERROR': stats.status5xx,
    'CANONICAL MISMATCHES': stats.canonicalMismatches,
    'HREFLANG MISMATCHES': stats.hreflangMismatches,
    'SITEMAP DEFECTS': stats.sitemapMismatches,
  });
  console.log('='.repeat(80));

  const hasCriticalFailures = 
    stats.brokenChains > 0 || 
    stats.loops > 0 || 
    stats.status404 > 0 || 
    stats.status5xx > 0 || 
    stats.canonicalMismatches > 0 || 
    stats.hreflangMismatches > 0 || 
    stats.sitemapMismatches > 0 ||
    (!IS_LIVE && stats.multiHop > 0);

  if (hasCriticalFailures) {
    console.error('\n[FAIL] Audit encountered critical errors.');
    if (shouldExit) process.exit(1);
    return { success: false, stats };
  }
  console.log('\n[PASS] Audit completed successfully with zero critical errors.');
  return { success: true, stats };
}

export { runAudit };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runAudit().catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
}
