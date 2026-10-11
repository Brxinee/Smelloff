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

// ---- Pass 2 (2026-10-11) ----------------------------------------------------

test('no page styles bare form/label/input elements (they leak into the shared footer form)', () => {
  const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
    .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of pages) {
    const css = [...read(f).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const line of css.split('\n')) {
      assert.doesNotMatch(line, /^\s*(form|label|input|select|textarea)\s*(\{|,|::?placeholder|:focus)/, `${f}: scope "${line.trim().slice(0, 60)}" to its own form id`);
    }
  }
});

test('link previews: one on-brand share image, never the retired banners', () => {
  const img = fs.readFileSync('assets/og/smelloff-share.jpg');
  assert.ok(img.length < 300 * 1024, 'share image must stay under 300KB (WhatsApp may skip larger previews)');
  // JPEG SOF0/SOF2 marker carries the size: 1200x630.
  let i = 2, w = 0, h = 0;
  while (i < img.length) { const m = img[i + 1]; const len = img.readUInt16BE(i + 2); if (m === 0xc0 || m === 0xc2) { h = img.readUInt16BE(i + 5); w = img.readUInt16BE(i + 7); break; } i += 2 + len; }
  assert.deepEqual([w, h], [1200, 630]);
  const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html') && !f.startsWith('google'))
    .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of pages) {
    const html = read(f);
    assert.doesNotMatch(html, /assets\/og-(image|brand)\.jpg/, `${f}: retired preview banner (it listed shoes/helmets/gear)`);
    const og = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (og && og[1].includes('smelloff-share')) assert.match(html, /<meta property="og:image:width" content="1200">/, `${f}: share image needs its size`);
  }
  const cfg = read('config/product.json');
  assert.ok(cfg.includes('"image": "https://smelloff.in/assets/og/smelloff-share.jpg"'));
  assert.ok(!/og-(image|brand)\.jpg/.test(cfg), 'product images must be product photos, not the text banner');
});

test('FAQ "How to pay" matches checkout: online payment is the default and listed first', () => {
  const faq = read('faq.html');
  const block = faq.slice(faq.indexOf('<summary>How to pay</summary>'), faq.indexOf('</details>', faq.indexOf('<summary>How to pay</summary>')));
  assert.ok(block.indexOf('Pay online') !== -1 && block.indexOf('Pay online') < block.indexOf('Cash on Delivery'), 'Pay online first');
  assert.doesNotMatch(block, /already selected|Cash on Delivery \(default\)/, 'COD is not pre-selected at checkout');
  assert.match(read('odorstrike.html'), /let payMethod = 'prepaid';/, 'checkout default changed: update the FAQ with it');
});

test('policies end with related policies, contact leads with real channels, 404 can search', () => {
  for (const f of POLICIES) {
    const html = read(f);
    const rel = html.match(/<h2 class="p-sublabel p-related">Related policies<\/h2>\s*<ul class="p-links">([\s\S]*?)<\/ul>/);
    assert.ok(rel, `${f}: related policies missing`);
    for (const [, href] of rel[1].matchAll(/href="\/([a-z-]+)"/g)) assert.ok(fs.existsSync(`${href}.html`), `${f}: /${href} does not exist`);
  }
  const c = read('contact.html');
  const iChan = c.indexOf('class="c-primary"'), iForm = c.indexOf('<form id="contactForm"'), iLegal = c.indexOf('class="callout c-legal"');
  assert.ok(iChan > 0 && iChan < iForm && iForm < iLegal, 'contact: channels, then the form, then the grievance notice');
  assert.match(c, /usually a reply within hours/); assert.match(c, /A reply within 24–48 hours/);
  const nf = read('404.html');
  assert.match(nf, /<form class="p-search" action="\/blog" method="get" role="search">[\s\S]*?name="q"/);
  assert.match(read('blog/index.html'), /new URLSearchParams\(window\.location\.search\)\.get\('q'\)/, 'blog search must read ?q=');
});

test('tracked capitals are for short labels, not for sentences or buttons', () => {
  const home = read('index.html'), pdp = read('odorstrike.html');
  assert.ok(!home.includes('UPI · CARDS · CASH ON DELIVERY'));
  assert.ok(!/hm-btn--ghost" href="\/odorstrike">(See full product details|View product)</.test(home), 'secondary route is the "View product details" text link');
  assert.ok(!read('assets/js/reviews-system.js').includes('Write a Verified Review'));
  assert.ok(!read('blog/index.html').includes('>All Articles<'));
  const css = read('assets/css/chrome.css');
  for (const sel of ['.final-reassurance', '.pay-modes', '.pd-pay', '#trackForm label', '.rv-field label']) assert.ok(css.includes(sel), `chrome.css §13 must cover ${sel}`);
  assert.ok(pdp.indexOf('id="finalBuyBtn"') < pdp.indexOf('class="final-reassurance"'), 'closing band: button, then the trust line (same order as /)');
});
