// SEO / AEO / GEO pass (2026-11-02) from the owner's Search Console export
// (12 months: brand queries 36% CTR, non-brand 0.2–1.2%) and the research in
// docs/audits/seo-aeo-geo-2026-11.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const cfg = JSON.parse(read('config/product.json'));
const ld = (html, id) => JSON.parse(html.match(new RegExp(`<script type="application/ld\\+json" id="${id}">([\\s\\S]*?)</script>`))[1]);

test('/shipping carries organization-level shipping policy markup (Google, Nov 2025) from config', () => {
  const org = ld(read('shipping.html'), 'shipping-policy-jsonld');
  assert.equal(org['@id'], 'https://smelloff.in/#organization');
  const svc = org.hasShippingService;
  assert.equal(svc['@type'], 'ShippingService');
  const c = svc.shippingConditions[0];
  assert.equal(c.shippingDestination.addressCountry, 'IN');
  assert.equal(c.shippingRate.value, cfg.shipping.prepaid.rate, 'prepaid ships free, as on the PDP offer');
  assert.deepEqual([c.transitTime.duration.minValue, c.transitTime.duration.maxValue], [cfg.shipping.transitTimeDays.min, cfg.shipping.transitTimeDays.max]);
  assert.deepEqual([svc.handlingTime.duration.minValue, svc.handlingTime.duration.maxValue], [cfg.shipping.handlingTimeDays.min, cfg.shipping.handlingTimeDays.max]);
  assert.match(svc.description, /Cash on Delivery/, 'COD charges are named, not hidden');
  assert.doesNotMatch(JSON.stringify(org), /₹/, 'no amount: prices only on / and /odorstrike');
  assert.ok(org.hasMerchantReturnPolicy, 'returns sit with shipping');
});

test('the product answers to the spellings people search', () => {
  const names = cfg.product.alternateNames;
  for (const n of ['ODORSTRIKE', 'Odor Strike']) assert.ok(names.includes(n), n);
  assert.ok(ld(read('odorstrike.html'), 'product-jsonld').alternateName.includes('Odor Strike'));
});

test('high-impression guides use the words people search, title = H1 territory', () => {
  const want = {
    'remove-cooking-smell-from-clothes': 'How to Get Curry Smell Out of Clothes',
    'gym-clothes-smell-after-washing': 'Dri-Fit',
    'why-clothes-smell-musty-after-being-stored': 'Why Do Clothes Smell After Being Stored?',
    'deodorant-vs-fabric-mist': 'Can You Use Deodorant on Clothes?',
    'best-fabric-odor-spray-india-2026-body-odor': 'Best Fabric Freshener for Clothes in India',
    'best-deodorant-spray-for-clothes-not-skin': 'Cloth Deodorant',
  };
  for (const [slug, phrase] of Object.entries(want)) {
    const html = read(`blog/${slug}.html`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
    assert.ok(title.includes(phrase) && h1.includes(phrase), `${slug}: "${phrase}" in title and H1`);
    assert.ok(title.length <= 60, `${slug}: ${title.length} chars`);
  }
});

test('the PDP snippet names the searched category and the trust facts', () => {
  const d = read('odorstrike.html').match(/<meta name="description" content="([^"]*)"/)[1];
  assert.match(d, /clothing deodorant/);
  assert.match(d, /smell remover spray for clothes/);
  assert.match(d, /COD/);
  assert.ok(d.length <= 160);
});
