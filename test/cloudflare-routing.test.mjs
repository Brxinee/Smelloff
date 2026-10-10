import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHeaders, buildRedirects } from '../scripts/cloudflare-routing.mjs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

test('vercel.json redirects translate to Cloudflare _redirects', () => {
  const lines = buildRedirects(vercel).trim().split('\n');
  const rules = new Map(lines.map((l) => { const [from, to, status] = l.split(' '); return [from, { to, status }]; }));

  for (const r of vercel.redirects.filter((r) => !r.has && !/[(:*]/.test(r.source))) {
    assert.equal(rules.get(r.source)?.to, r.destination, `missing redirect ${r.source}`);
  }
  assert.deepEqual(rules.get('/policies/terms'), { to: '/terms', status: '301' });
  assert.deepEqual(rules.get('/.well-known/llms.txt'), { to: '/llms.txt', status: '200' });

  // Cloudflare counts every line after the first dynamic rule as dynamic (cap 100).
  const firstDynamic = lines.findIndex((l) => /[:*]/.test(l.split(' ')[0]));
  assert.ok(lines.length - firstDynamic <= 100, 'dynamic rules must come last');
  assert.ok(lines.length <= 2000, 'Cloudflare caps _redirects at 2000 static rules');
});

test('vercel.json headers translate to Cloudflare _headers', () => {
  const headers = buildHeaders(vercel);
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
