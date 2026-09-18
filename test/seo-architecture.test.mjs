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
        description: 'www with clean URL redirects directly to canonical in 1 hop',
        url: 'https://www.smelloff.in/odorstrike',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'www with trailing slash redirects directly to canonical in 1 hop',
        url: 'https://www.smelloff.in/odorstrike/',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'www with .html redirects directly to canonical in 1 hop',
        url: 'https://www.smelloff.in/odorstrike.html',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'non-www trailing slash redirects to canonical in 1 hop',
        url: 'https://smelloff.in/odorstrike/',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'non-www .html redirects to canonical in 1 hop',
        url: 'https://smelloff.in/odorstrike.html',
        expectedFinal: 'https://smelloff.in/odorstrike',
        maxHops: 1,
      },
      {
        description: 'legacy blog post redirects to target canonical in 1 hop',
        url: 'https://smelloff.in/blog/clothes-smell-after-washing',
        expectedFinal: 'https://smelloff.in/blog/gym-clothes-smell-after-washing',
        maxHops: 1,
      },
      {
        description: 'www legacy blog post redirects to target canonical in 1 hop',
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
    ];

    for (const t of testMatrix) {
      it(t.description, () => {
        const trace = traceSimulatedHops(t.url);
        assert.equal(trace.isLoop, false, `Must not be a redirect loop for ${t.url}`);
        assert.equal(trace.finalUrl, t.expectedFinal, `Final destination must be ${t.expectedFinal}`);
        assert.ok(trace.hopCount <= t.maxHops, `Hop count must be <= ${t.maxHops}, got ${trace.hopCount}`);
      });
    }
  });
});
