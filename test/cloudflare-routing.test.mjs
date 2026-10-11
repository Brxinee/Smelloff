import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHeaders, buildRedirects } from '../scripts/cloudflare-routing.mjs';

const routing = JSON.parse(fs.readFileSync('config/routing.json', 'utf8'));

test('config/routing.json redirects translate to Cloudflare _redirects', () => {
  const lines = buildRedirects(routing).trim().split('\n');
  const rules = new Map(lines.map((l) => { const [from, to, status] = l.split(' '); return [from, { to, status }]; }));

  for (const r of routing.redirects.filter((r) => !r.has && !/[(:*]/.test(r.source))) {
    assert.equal(rules.get(r.source)?.to, r.destination, `missing redirect ${r.source}`);
  }
  assert.deepEqual(rules.get('/policies/terms'), { to: '/terms', status: '301' });
  // An alias is a 301, not a 200 copy (identical indexable files, 2026-10-11).
  assert.deepEqual(rules.get('/.well-known/llms.txt'), { to: '/llms.txt', status: '301' });

  // Cloudflare counts every line after the first dynamic rule as dynamic (cap 100).
  const firstDynamic = lines.findIndex((l) => /[:*]/.test(l.split(' ')[0]));
  assert.ok(lines.length - firstDynamic <= 100, 'dynamic rules must come last');
  assert.ok(lines.length <= 2000, 'Cloudflare caps _redirects at 2000 static rules');
});

test('config/routing.json headers translate to Cloudflare _headers', () => {
  const headers = buildHeaders(routing);
  assert.match(headers, /^\/\*\n(  .+\n)*  Content-Security-Policy: default-src 'self'/m);
  assert.match(headers, /^\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable$/m);
  assert.match(headers, /^\/sw\.js\n  Cache-Control: public, max-age=0, must-revalidate$/m);
  assert.doesNotMatch(headers, /Content-Type:/, 'duplicate Content-Type headers would be comma-joined');
});

test('Cloudflare Worker exports a fetch function and keeps webhook raw bodies', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.match(src, /const \{ fetch: fetchHandler \} = httpServerHandler\(/,
    'httpServerHandler() returns { fetch }; exporting the object itself throws "worker.fetch is not a function"');
  assert.match(src, /express\.json\(\{[^}]*verify: keepRawBody/, 'webhook HMACs need the exact request bytes');
});

test('static output includes the service worker every page registers', () => {
  assert.match(fs.readFileSync('scripts/prepare-public.mjs', 'utf8'), /'sw\.js'/);
});

test('Worker owns the apex and www as custom domains', () => {
  const cfg = fs.readFileSync('wrangler.jsonc', 'utf8');
  for (const host of ['smelloff.in', 'www.smelloff.in']) {
    assert.ok(cfg.includes(`{ "pattern": "${host}", "custom_domain": true }`),
      `${host} must be a Worker custom domain, or the zone DNS answers it with error 1000`);
  }
});

test('www and http are 301d to https://smelloff.in in one hop; /api is never redirected', async () => {
  const { canonicalRedirect, upgradeTemporaryRedirect } = await import('../src/canonical.js');
  assert.equal(canonicalRedirect('https://www.smelloff.in/'), 'https://smelloff.in/');
  assert.equal(canonicalRedirect('https://www.smelloff.in/blog/deodorant-vs-fabric-mist/'), 'https://smelloff.in/blog/deodorant-vs-fabric-mist');
  assert.equal(canonicalRedirect('https://www.smelloff.in/privacy.html?x=1'), 'https://smelloff.in/privacy?x=1');
  assert.equal(canonicalRedirect('https://www.smelloff.in/blog/index.html'), 'https://smelloff.in/blog');
  assert.equal(canonicalRedirect('http://smelloff.in/odorstrike'), 'https://smelloff.in/odorstrike');
  assert.equal(canonicalRedirect('https://smelloff.in/odorstrike'), null);
  assert.equal(canonicalRedirect('https://www.smelloff.in/api/webhook'), null, 'a 301 would turn webhook POSTs into GETs');
  assert.equal(canonicalRedirect('https://smelloff.example.workers.dev/'), null);
  // A retired www slug lands on its final post in one hop, not www → apex → post.
  assert.equal(canonicalRedirect('https://www.smelloff.in/blog/dri-fit-shirts-smell'), 'https://smelloff.in/blog/gym-clothes-smell-after-washing');
  assert.equal(canonicalRedirect('https://www.smelloff.in/blog/beta-cyclodextrin-odor-removal-science/'), 'https://smelloff.in/blog/hpbcd-cyclodextrin-fabric-odor');
  for (const r of routing.redirects.filter((r) => !r.has && !/[(:*]/.test(r.source) && (r.statusCode ?? 301) === 301)) {
    const once = canonicalRedirect(`https://www.smelloff.in${r.source}`).replace('https://smelloff.in', '');
    assert.ok(!routing.redirects.some((x) => !x.has && x.source === once), `${r.source} → ${once} still redirects (a chain)`);
  }

  const temp = new Response(null, { status: 307, headers: { location: '/privacy' } });
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/privacy.html', temp).status, 301);
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/faq/', temp).status, 301);
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/assets/a@640.webp', temp).status, 307);

  const cfg = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(cfg, /"run_worker_first": \[\s*"\/\*",\s*"!\/assets\/\*"\s*\]/, 'pages must reach the Worker or www is never redirected');
});

// 2026-10-11 compliance audit (Search Console "Not found", soft 404s, thin
// orphaned pages, duplicate text files, conflicting robots headers).
test('retired and stray URLs 301 to one live page; /404 is a real 404; the verification file needs no redirect', async () => {
  const out = buildRedirects(routing);
  const has = (line) => assert.ok(out.split('\n').includes(line), `missing _redirects line: ${line}`);
  // /solutions were 126–344-word city pages nothing linked to (0 clicks in six months).
  has('/solutions /blog 301');
  has('/solutions/post-gym-workout-sweat-spray /blog/gym-clothes-smell-after-washing 301');
  has('/solutions/denim-outerwear-dry-care /blog/remove-smell-from-blazer-without-dry-cleaning 301');
  assert.ok(!fs.existsSync('solutions'), 'the /solutions pages are retired');
  // The three Not found URLs in the export, and the 75 /public/… URLs a bad sitemap listed.
  for (const p of ['/smelloff', '/index-2', '/Index']) has(`${p} / 301`);
  has('/public/* /:splat 301');
  // One URL per text file: the aliases were byte-identical indexable copies.
  has('/ai.txt /llms.txt 301');
  has('/.well-known/llms.txt /llms.txt 301');
  assert.ok(!(routing.rewrites || []).some((r) => /llms|ai\.txt/.test(r.source)));

  const headers = buildHeaders(routing);
  assert.ok(!/^\/\*\n(?:  .*\n)*  X-Robots-Tag/m.test(headers), 'pages carry meta robots; a global header only collided with the noindex paths');
  assert.match(headers, /^\/admin\n  X-Robots-Tag: noindex, nofollow$/m);

  const { notFoundStatus, verificationAssetPath } = await import('../src/canonical.js');
  assert.equal(notFoundStatus('https://smelloff.in/404', new Response('x', { status: 200 })).status, 404);
  assert.equal(notFoundStatus('https://smelloff.in/faq', new Response('x', { status: 200 })).status, 200);
  assert.equal(verificationAssetPath('https://smelloff.in/google163974d1a8d940cf89b0ec712246c779.html'), '/google163974d1a8d940cf89b0ec712246c779');
  assert.equal(verificationAssetPath('https://smelloff.in/odorstrike.html'), null);
});
