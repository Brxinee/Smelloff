import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Whole-site consistency pass (2026-10-11). The audit behind it found six H1
// sizes, 13 label styles and 21 button styles across 77 pages; chrome.css §12
// is now the one definition. These tests keep pages on it.
const read = (f) => fs.readFileSync(f, 'utf8');
const product = JSON.parse(read('config/product.json')).product;

const INNER = ['about.html', 'contact.html', 'reviews.html', 'track-order.html', 'faq.html', '404.html',
  'shipping.html', 'returns.html', 'refund.html', 'cancellation.html', 'payment-failed.html', 'privacy.html', 'terms.html'];
const POLICIES = ['shipping.html', 'returns.html', 'refund.html', 'cancellation.html', 'payment-failed.html', 'privacy.html', 'terms.html'];
const GLANCE = ['shipping.html', 'returns.html', 'refund.html', 'cancellation.html', 'payment-failed.html'];
const ENDCAP = [...INNER.filter((f) => f !== 'track-order.html'), 'solutions/index.html',
  'solutions/denim-outerwear-dry-care.html', 'solutions/monsoon-damp-fabric-care.html',
  'solutions/office-commute-fabric-refresher.html', 'solutions/post-gym-workout-sweat-spray.html'];

test('every inner page opens with the shared masthead: label, one H1, lede', () => {
  for (const f of INNER) {
    const html = read(f);
    const head = html.match(/<header class="p-head[^"]*">([\s\S]*?)<\/header>/);
    assert.ok(head, `${f}: .p-head masthead missing`);
    assert.match(head[1], /<div class="p-eyebrow">[^<]+<\/div>/, `${f}: section label missing`);
    assert.match(head[1], /<h1>[\s\S]+?<\/h1>/, `${f}: H1 must be in the masthead`);
    assert.match(head[1], /<p class="p-lede">/, `${f}: lede missing`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${f}: exactly one H1`);
  }
});

test('policy pages: plain summary first, and "On this page" matches the headings', () => {
  for (const f of POLICIES) {
    const html = read(f);
    const body = html.slice(html.indexOf('<div class="p-body">'), html.indexOf('</main>'));
    const heads = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => m[1]);
    const toc = [...html.matchAll(/<details class="p-toc"[\s\S]*?<\/details>/g)];
    assert.equal(toc.length, 1, `${f}: one contents list`);
    const links = [...toc[0][0].matchAll(/<a href="#([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(links, heads, `${f}: contents list must list every H2, in order (re-generate it after editing headings)`);
    assert.ok(html.includes('class="p-top" href="#sf-main"'), `${f}: back-to-top link missing`);
    if (GLANCE.includes(f)) assert.match(html, /<section class="p-glance"[\s\S]*?<li>[\s\S]*?<\/section>/, `${f}: "At a glance" missing`);
  }
  // Returns and cancellation may not state the COD amount (see cod-checkout-regression).
  for (const f of ['returns.html', 'cancellation.html']) assert.doesNotMatch(read(f), /₹\s*(89|318)\b/);
});

test('the closing product card is generated, priced from config, and only where it belongs', () => {
  for (const f of ENDCAP) {
    const html = read(f);
    const cap = html.match(/<!-- SF-CHROME:ENDCAP[\s\S]*?<!-- \/SF-CHROME:ENDCAP -->/);
    assert.ok(cap, `${f}: closing card missing (apply-chrome endcap:true)`);
    assert.ok(cap[0].includes(`Buy now — ₹${product.price}`) && cap[0].includes(`M.R.P. ₹${product.mrp}`), `${f}: card price must come from config`);
    assert.doesNotMatch(cap[0], /₹\s*(89|318)\b/, `${f}: no COD amount outside checkout/policies`);
    assert.ok(html.indexOf('SF-CHROME:ENDCAP') < html.indexOf('SF-CHROME:FOOTER'), `${f}: card sits above the footer`);
  }
  for (const f of ['index.html', 'odorstrike.html', 'track-order.html', 'blog/why-i-built-odorstrike.html']) {
    assert.ok(!read(f).includes('SF-CHROME:ENDCAP'), `${f}: no closing card here`);
  }
});

test('buttons say the same thing the same way across the site', () => {
  for (const f of fs.readdirSync('blog').filter((x) => x.endsWith('.html'))) {
    const html = read(`blog/${f}`);
    assert.doesNotMatch(html, />\s*BUY (NOW|ODORSTRIKE)\b/, `blog/${f}: buttons are sentence case ("Buy now — ₹${product.price}")`);
    for (const m of html.matchAll(/class="buy-btn"[^>]*>([^<]*)</g)) assert.equal(m[1], `Buy now — ₹${product.price}`, `blog/${f}`);
  }
  assert.ok(!read('faq.html').includes('class="faq-cta"'), 'FAQ ends with the shared card, not its own lime bar');
  assert.ok(!read('reviews.html').includes('class="buy-band"'), 'Reviews ends with the shared card');
  assert.ok(!read('reviews.html').includes('★ Write a Review'), 'secondary buttons are sentence case, no decorative star');
  const nf = read('404.html');
  assert.match(nf, /<h1>This page aired out and left/, '404: the H1 is the message, not a tiny label');
  assert.match(nf, /class="sf-btn" href="\/"/);
});

test('chrome.css §12 defines the shared components and the one type scale', () => {
  const css = read('assets/css/chrome.css');
  for (const sel of ['.sf-btn{', '.p-head{', '.p-grid{', '.p-glance', '.p-toc', '.sf-endcap{', '--fs-page-h1:', '--fs-prose-h2:']) {
    assert.ok(css.includes(sel), `chrome.css missing ${sel}`);
  }
});

// /assets/* is served immutable for a year, so a page that still points at an
// old ?v= never gets the edit. Every page must carry the current content hash.
test('shared CSS/JS stamps match the files (run scripts/apply-chrome.mjs after editing)', async () => {
  const { createHash } = await import('node:crypto');
  const h = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
  const want = { 'chrome.css': h('assets/css/chrome.css'), 'soft.css': h('assets/css/soft.css'),
    'chrome.js': h('assets/js/chrome.js'), 'blog.css': h('assets/css/blog.css') };
  const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
    .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of pages) {
    const html = read(f);
    for (const [name, v] of Object.entries(want)) {
      for (const m of html.matchAll(new RegExp(`/${name.replace('.', '\\.')}\\?v=([0-9a-f]+)`, 'g'))) {
        assert.equal(m[1], v, `${f}: ${name}?v=${m[1]} is stale (current ${v})`);
      }
    }
  }
});
