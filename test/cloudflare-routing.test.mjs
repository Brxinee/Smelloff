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

// 2026-10-14 Page indexing export (data to 9 Oct) + a live crawl of every URL
// Google could know: 222 history/redirect URLs and 288 www/http/slash/.html
// variants of the sitemap. Everything was one 301 to a 200 except these.
test('/public copies, capitalised paths and common guessed URLs reach a live page in one 301', async () => {
  const { canonicalRedirect, lowercaseCandidate } = await import('../src/canonical.js');
  // Bare /public answered 200 with the homepage: a duplicate of /.
  assert.equal(canonicalRedirect('https://smelloff.in/public'), 'https://smelloff.in/');
  assert.equal(canonicalRedirect('https://smelloff.in/public/'), 'https://smelloff.in/');
  assert.equal(canonicalRedirect('https://smelloff.in/public/odorstrike.html'), 'https://smelloff.in/odorstrike');
  // Was /public/solutions/x → /solutions/x → guide (two hops).
  assert.equal(canonicalRedirect('https://smelloff.in/public/solutions/monsoon-damp-fabric-care'), 'https://smelloff.in/blog/damp-clothes-musty-smell-monsoon-fix');
  assert.equal(canonicalRedirect('https://www.smelloff.in/public/blog/spray-to-remove-sweat-smell-from-clothes-instantly'), 'https://smelloff.in/blog/spray-to-remove-sweat-smell-from-clothes-quickly');
  assert.equal(canonicalRedirect('https://smelloff.in/publications'), null, 'only the /public folder, not every path that starts with it');

  // Capitals 404 on the case-sensitive asset server; the Worker tries lowercase.
  assert.equal(lowercaseCandidate('https://smelloff.in/Odorstrike'), '/odorstrike');
  assert.equal(lowercaseCandidate('https://smelloff.in/Blog/Why-I-Built-Odorstrike/'), '/blog/why-i-built-odorstrike');
  assert.equal(lowercaseCandidate('https://smelloff.in/Solutions'), '/blog');
  assert.equal(lowercaseCandidate('https://smelloff.in/odorstrike'), null);
  assert.equal(lowercaseCandidate('https://smelloff.in/r/ABC123'), null, 'referral codes keep their case');
  assert.equal(lowercaseCandidate('https://smelloff.in/api/Health'), null);
  const index = fs.readFileSync('src/index.js', 'utf8');
  assert.match(index, /asset\.status !== 404\)[^\n]*\n\s*const lower = await lowercaseRedirect/, 'lowercase is only tried after the real path 404s');

  // A query string on a redirect whose target already has one keeps both.
  assert.equal(canonicalRedirect('https://www.smelloff.in/cart?utm_source=ig'), 'https://smelloff.in/odorstrike?cart=open&utm_source=ig');

  const out = buildRedirects(routing).split('\n');
  for (const line of ['/shop /odorstrike 301', '/checkout /odorstrike?buy=1 301', '/about-us /about 301',
    '/privacy-policy /privacy 301', '/return-policy /returns 301', '/track /track-order 301', '/sitemap_index.xml /sitemap.xml 301']) {
    assert.ok(out.includes(line), `missing _redirects line: ${line}`);
  }
  for (const r of routing.redirects.filter((r) => !r.has && !/[(:*]/.test(r.source))) {
    const dest = r.destination.split('?')[0];
    if (!dest.startsWith('/') || dest === '/') continue;
    const file = dest.replace(/^\//, '');
    assert.ok([file, `${file}.html`, `${file}/index.html`].some((f) => fs.existsSync(f)), `${r.source} → ${r.destination}: no such page`);
  }
});

test('machine files say noindex so Search Console only lists pages', () => {
  const headers = buildHeaders(routing);
  for (const p of ['/products.json', '/manifest.json', '/sw.js', '/163974d1a8d940cf89b0ec712246c779.txt', '/merchant-feed.xml']) {
    assert.match(headers, new RegExp(`^${p.replace(/\./g, '\\.')}\\n(?:  .*\\n)*?  X-Robots-Tag: noindex`, 'm'), `${p} needs X-Robots-Tag: noindex`);
  }
  // The AI context files stay indexable on purpose.
  assert.match(headers, /^\/llms\.txt\n(?:  .*\n)*?  X-Robots-Tag: index, follow/m);
  assert.ok(!routing.headers.some((h) => h.source === '/shop'), '/shop is a redirect now, not a noindex page');
});

test('every page footer links the smell-by-smell hub guide', () => {
  const hub = '<li><a href="/blog/remove-smell-from-clothes-without-washing">Smell guide</a></li>';
  assert.ok(fs.readFileSync('scripts/apply-chrome.mjs', 'utf8').includes(hub), 'the footer template must carry the hub link');
  for (const f of ['index.html', 'odorstrike.html', 'blog/index.html', 'faq.html', 'blog/how-to-use-odorstrike.html']) {
    assert.ok(fs.readFileSync(f, 'utf8').includes(hub), `${f} footer is missing the hub link`);
  }
});
