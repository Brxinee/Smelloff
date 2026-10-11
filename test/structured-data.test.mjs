import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getProductConfig } from '../scripts/product-config.mjs';

const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
  .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));

function nodes(file) {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(m[1]);
    out.push(...(j['@graph'] || [].concat(j)));
  }
  return out;
}

/** Every typed node, nested ones included (an ItemPage.mainEntity Product counts). */
function allNodes(file) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      if (v['@type']) out.push(v);
      Object.values(v).forEach(walk);
    }
  };
  walk(nodes(file));
  return out;
}
const typeOf = (n) => [].concat(n['@type']).join('+');

test('generated JSON-LD, products.json and merchant-feed.xml match config/product.json', () => {
  const r = spawnSync(process.execPath, ['scripts/seo/apply-structured-data.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('only /odorstrike carries a Product with an Offer (one merchant listing, one URL)', () => {
  const withProduct = pages.filter((f) => allNodes(f).some((n) => typeOf(n) === 'Product'));
  assert.deepEqual(withProduct, ['odorstrike.html']);
});

test('no page marks up a first-party Review or rating of our own product', () => {
  for (const f of pages) {
    for (const n of allNodes(f)) {
      assert.notEqual(typeOf(n), 'Review', `${f}: a founder-written review is not a review snippet Google may show`);
      assert.equal(n.aggregateRating, undefined, `${f}: no aggregateRating without real verified reviews`);
    }
  }
});

test('the organization is one entity: same block on / and /odorstrike, defined once per page', () => {
  const org = (f) => nodes(f).filter((n) => n['@id'] === 'https://smelloff.in/#organization');
  assert.equal(org('index.html').length, 1);
  assert.equal(org('odorstrike.html').length, 1);
  assert.deepEqual(org('index.html')[0], org('odorstrike.html')[0]);
  assert.equal(org('index.html')[0]['@type'], 'OnlineStore');
});

test('Product offer states the shipping and returns the policy pages state', () => {
  const { shipping, returns, product } = getProductConfig();
  const p = nodes('odorstrike.html').find((n) => typeOf(n) === 'Product');
  const time = p.offers.shippingDetails.deliveryTime;
  assert.equal(p.url, product.url);
  assert.equal(time.handlingTime.maxValue, 2, '/shipping: dispatched within 48 hours');
  assert.equal(time.transitTime.maxValue, 10, '/shipping: remote / North-East 7–10 business days');
  assert.match(fs.readFileSync('shipping.html', 'utf8'), new RegExp(`within <strong>${shipping.handlingTimeDays.max * 24} hours`));
  assert.equal(p.offers.hasMerchantReturnPolicy.merchantReturnDays, returns.windowDays);
  assert.equal(p.offers.hasMerchantReturnPolicy.merchantReturnLink, 'https://smelloff.in/returns');
});

test('merchant feed lists the PDP at the on-page price', () => {
  const feed = fs.readFileSync('merchant-feed.xml', 'utf8');
  const { product } = getProductConfig();
  assert.match(feed, /<g:link>https:\/\/smelloff\.in\/odorstrike<\/g:link>/);
  assert.match(feed, new RegExp(`<g:price>${product.price}\\.00 INR</g:price>`));
  assert.match(fs.readFileSync('odorstrike.html', 'utf8'), new RegExp(`₹${product.price}`));
  assert.ok(fs.readFileSync('scripts/prepare-public.mjs', 'utf8').includes("'merchant-feed.xml'"), 'feed must ship');
});

test('every blog post has a complete Article and a BreadcrumbList', () => {
  for (const f of pages.filter((p) => p.startsWith('blog/') && p !== 'blog/index.html')) {
    const ns = nodes(f);
    const a = ns.find((n) => typeOf(n) === 'Article' || typeOf(n) === 'BlogPosting');
    assert.ok(a, `${f}: Article`);
    for (const k of ['headline', 'image', 'datePublished', 'dateModified']) assert.ok(a[k], `${f}: Article.${k}`);
    assert.ok(a.author?.url, `${f}: Article.author.url`);
    assert.ok(ns.some((n) => typeOf(n) === 'BreadcrumbList'), `${f}: BreadcrumbList`);
  }
});

test('the Offer carries the MRP as a ListPrice (strikethrough in results), from config', () => {
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const block = JSON.parse(pdp.match(/<script type="application\/ld\+json" id="product-jsonld">([\s\S]*?)<\/script>/)[1]);
  const cfg = JSON.parse(fs.readFileSync('config/product.json', 'utf8')).product;
  const spec = block.offers.priceSpecification;
  assert.equal(spec.priceType, 'https://schema.org/ListPrice');
  assert.equal(Number(spec.price), cfg.mrp);
  assert.equal(Number(block.offers.price), cfg.price);
  assert.ok(cfg.mrp > cfg.price, 'a list price only makes sense above the offer price');
});

// GSC export (2026-10-12): pages at position 5–10 with ~0.3% CTR, many with
// titles Google cut mid-word or descriptions it rewrote. Keep every indexable
// page's snippet inside what Google shows.
test('every indexable page: title ≤ 60 characters, description 70–160', () => {
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  const files = fs.readdirSync('.').filter((f) => f.endsWith('.html') && !f.startsWith('google'))
    .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
    const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
    assert.ok(title.length > 0 && title.length <= 60, `${f}: title is ${title.length} characters`);
    assert.ok(desc.length >= 70 && desc.length <= 160, `${f}: description is ${desc.length} characters`);
  }
});
