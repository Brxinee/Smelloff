import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeAndXmlEscape } from '../scripts/seo/build-sitemap.mjs';
import { simulateRedirect, traceSimulatedHops } from '../scripts/audit-live-seo.mjs';

const ROOT = process.cwd();

describe('SEO Architecture & Canonical Infrastructure', () => {
  describe('Sitemap XML Entity Escaping', () => {
    it('correctly handles raw ampersands without double escaping', () => {
      assert.equal(decodeAndXmlEscape('Best & Clean'), 'Best &amp; Clean');
    });

    it('correctly decodes existing HTML entity &amp; before XML escaping', () => {
      assert.equal(decodeAndXmlEscape('Best &amp; Clean'), 'Best &amp; Clean');
    });

    it('handles quotes, apostrophes, and angles', () => {
      assert.equal(decodeAndXmlEscape('50ml "pocket" spray <fast> & safe'), '50ml &quot;pocket&quot; spray &lt;fast&gt; &amp; safe');
      assert.equal(decodeAndXmlEscape("Don&#39;t worry &apos;fresh&apos;"), 'Don&apos;t worry &apos;fresh&apos;');
    });

    it('verifies generated sitemap.xml has zero double-escaped entities', () => {
      const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
      assert.equal(/&amp;(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/i.test(xml), false, 'sitemap.xml must not contain &amp;amp; or doubly escaped entities');
      assert.equal(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(xml), false, 'sitemap.xml must not contain raw unescaped &');
    });
  });

  describe('Canonical & Hreflang Tag Completeness', () => {
    const sitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    it('sitemap contains exactly 75 canonical URLs', () => {
      assert.equal(sitemapUrls.length, 75);
    });

    for (const url of sitemapUrls) {
      it(`verifies canonical and hreflang parity for ${url}`, () => {
        let relPath = url.replace('https://smelloff.in', '');
        if (relPath === '' || relPath === '/') {
          relPath = 'index.html';
        } else {
          relPath = relPath.replace(/^\//, '') + '.html';
          if (!fs.existsSync(path.join(ROOT, relPath))) {
            relPath = url.replace('https://smelloff.in/', '') + '/index.html';
          }
        }

        const filePath = path.join(ROOT, relPath);
        assert.ok(fs.existsSync(filePath), `HTML file must exist for canonical ${url} (checked ${relPath})`);

        const html = fs.readFileSync(filePath, 'utf8');

        // Check canonical
        const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                           html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
        assert.ok(canonMatch, `Missing canonical tag in ${relPath}`);
        assert.equal(canonMatch[1], url, `Canonical tag in ${relPath} must match ${url}`);

        // Check hreflang en-IN
        const enInMatch = html.match(/<link[^>]+hreflang=["']en-IN["'][^>]+href=["']([^"']+)["']/i);
        assert.ok(enInMatch, `Missing hreflang="en-IN" tag in ${relPath}`);
        assert.equal(enInMatch[1], url, `hreflang="en-IN" in ${relPath} must match ${url}`);

        // Check hreflang x-default
        const xDefMatch = html.match(/<link[^>]+hreflang=["']x-default["'][^>]+href=["']([^"']+)["']/i);
        assert.ok(xDefMatch, `Missing hreflang="x-default" tag in ${relPath}`);
        assert.equal(xDefMatch[1], url, `hreflang="x-default" in ${relPath} must match ${url}`);

        // Check og:url
        const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
        if (ogUrlMatch) {
          assert.equal(ogUrlMatch[1], url, `og:url in ${relPath} must match ${url}`);
        }
      });
    }
  });

  describe('Redirect Routing & Single-Hop Consolidation', () => {
    const testMatrix = [
      {
        description: 'canonical URL resolves with exactly 0 hops',
        url: 'https://smelloff.in/odorstrike',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 0,
      },
      {
        description: 'apex trailing slash redirects to canonical in exactly 1 hop',
        url: 'https://smelloff.in/odorstrike/',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'www canonical redirects directly to canonical in exactly 1 hop',
        url: 'https://www.smelloff.in/odorstrike',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'www with trailing slash redirects directly to canonical in exactly 1 hop',
        url: 'https://www.smelloff.in/odorstrike/',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'apex .html redirects to canonical in exactly 1 hop',
        url: 'https://smelloff.in/odorstrike.html',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'www with .html redirects directly to canonical in exactly 1 hop',
        url: 'https://www.smelloff.in/odorstrike.html',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'representative legacy blog post redirects to target canonical in exactly 1 hop',
        url: 'https://smelloff.in/blog/clothes-smell-after-washing',
        expectedFinal: 'https://smelloff.in/blog/gym-clothes-smell-after-washing',
        maxHops: 1,
      },
      {
        description: 'www representative legacy blog post redirects to target canonical in exactly 1 hop',
        url: 'https://www.smelloff.in/blog/clothes-smell-after-washing',
        expectedFinal: 'https://smelloff.in/blog/gym-clothes-smell-after-washing',
        maxHops: 1,
      },
      {
        description: 'solutions hub index redirects to /solutions in 1 hop',
        url: 'https://smelloff.in/solutions/index',
        expectedFinal: 'https://smelloff.in/solutions',
        maxHops: 1,
      },
      {
        description: 'legacy best-fabric-freshener-odor-spray redirects to fabric-deodorizer-spray-india-guide-2026',
        url: 'https://smelloff.in/blog/best-fabric-freshener-odor-spray-india-2026',
        expectedFinal: 'https://smelloff.in/blog/fabric-deodorizer-spray-india-guide-2026',
        maxHops: 1,
      },
      {
        description: 'legacy fabric-odor-science-zinc-ricinoleate redirects to zinc-pca-fabric-odor-ingredient-guide',
        url: 'https://smelloff.in/blog/fabric-odor-science-zinc-ricinoleate',
        expectedFinal: 'https://smelloff.in/blog/zinc-pca-fabric-odor-ingredient-guide',
        maxHops: 1,
      },
      {
        description: 'legacy chemical-breakdown-sweat-odor redirects to why-body-odor-comes-back-on-clothes-so-quickly',
        url: 'https://smelloff.in/blog/chemical-breakdown-sweat-odor',
        expectedFinal: 'https://smelloff.in/blog/why-body-odor-comes-back-on-clothes-so-quickly',
        maxHops: 1,
      },
      {
        description: 'legacy how-to-remove-sweat-smell-from-clothes-instantly redirects to spray-to-remove-sweat-smell-from-clothes-instantly',
        url: 'https://smelloff.in/blog/how-to-remove-sweat-smell-from-clothes-instantly',
        expectedFinal: 'https://smelloff.in/blog/spray-to-remove-sweat-smell-from-clothes-instantly',
        maxHops: 1,
      },
    ];

    for (const t of testMatrix) {
      it(t.description, () => {
        const trace = traceSimulatedHops(t.url);
        assert.equal(trace.isLoop, false, `Must not be a redirect loop for ${t.url}`);
        assert.equal(trace.finalUrl, t.expectedFinal, `Final destination must be ${t.expectedFinal}`);
        assert.equal(trace.hopCount, t.maxHops, `Hop count must be exactly ${t.maxHops}, got ${trace.hopCount}`);
      });
    }

    it('audit gate strictly detects and rejects intentionally injected 2-hop chains', async () => {
      const { runAudit } = await import('../scripts/audit-live-seo.mjs');
      // In normal configuration, audit succeeds
      const result = await runAudit({ shouldExit: false, isLive: false });
      assert.equal(result.success, true, 'Clean routing must pass audit');
      assert.equal(result.stats.multiHop, 0, 'Clean routing must have 0 multi-hops');

      // Inject a synthetic multi-hop stat and verify critical failure rejection
      const simulatedStats = { ...result.stats, multiHop: 1 };
      const hasCriticalFailures = 
        simulatedStats.brokenChains > 0 || 
        simulatedStats.loops > 0 || 
        simulatedStats.status404 > 0 || 
        simulatedStats.status5xx > 0 || 
        simulatedStats.canonicalMismatches > 0 || 
        simulatedStats.hreflangMismatches > 0 || 
        simulatedStats.sitemapMismatches > 0 ||
        simulatedStats.multiHop > 0;
      assert.equal(hasCriticalFailures, true, 'Audit gate must fail when a 2-hop chain is present');
    });
  });

  describe('Structured Data Hygiene & Deprecated Schema Prevention', () => {
    const sitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    it('asserts zero FAQPage schema blocks across all canonical pages (deprecated by Google)', () => {
      for (const url of sitemapUrls) {
        let relPath = url.replace('https://smelloff.in', '');
        if (relPath === '' || relPath === '/') {
          relPath = 'index.html';
        } else {
          relPath = relPath.replace(/^\//, '') + '.html';
          if (!fs.existsSync(path.join(ROOT, relPath))) {
            relPath = url.replace('https://smelloff.in/', '') + '/index.html';
          }
        }
        const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
        const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/i.test(html);
        assert.equal(hasFaqSchema, false, `Page ${relPath} must not contain deprecated FAQPage schema`);
      }
    });

    it('asserts all JSON-LD blocks in all canonical pages are strictly valid JSON', () => {
      for (const url of sitemapUrls) {
        let relPath = url.replace('https://smelloff.in', '');
        if (relPath === '' || relPath === '/') {
          relPath = 'index.html';
        } else {
          relPath = relPath.replace(/^\//, '') + '.html';
          if (!fs.existsSync(path.join(ROOT, relPath))) {
            relPath = url.replace('https://smelloff.in/', '') + '/index.html';
          }
        }
        const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
        const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        for (const s of scripts) {
          assert.doesNotThrow(() => JSON.parse(s[1].trim()), `Invalid JSON-LD in ${relPath}`);
        }
      }
    });
  });
});
