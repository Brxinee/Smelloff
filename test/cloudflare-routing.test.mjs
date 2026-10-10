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
  assert.deepEqual(rules.get('/.well-known/llms.txt'), { to: '/llms.txt', status: '200' });

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

  const temp = new Response(null, { status: 307, headers: { location: '/privacy' } });
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/privacy.html', temp).status, 301);
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/faq/', temp).status, 301);
  assert.equal(upgradeTemporaryRedirect('https://smelloff.in/assets/a@640.webp', temp).status, 307);

  const cfg = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(cfg, /"run_worker_first": \[\s*"\/\*",\s*"!\/assets\/\*"\s*\]/, 'pages must reach the Worker or www is never redirected');
});
