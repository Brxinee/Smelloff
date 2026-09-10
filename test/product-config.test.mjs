import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCT_CONFIG,
  PRODUCT,
  BRAND,
  SHIPPING,
  FORMULA,
  calculateOrderTotal,
  buildProductJsonLd,
  buildProductsCatalogFeed
} from '../scripts/product-config.mjs';
import { SMELLOFF_PRODUCT_TRUTH } from '../shared/product-truth.js';
import { BASE_PRODUCT } from '../shared/products-config.js';

test('product.json schema and authoritative values', () => {
  assert.equal(PRODUCT.title, 'Smelloff ODORSTRIKE Fabric Odor Eliminator Spray (50ml)');
  assert.equal(PRODUCT.price, 229);
  assert.equal(PRODUCT.mrp, 499);
  assert.equal(PRODUCT.codFee, 60);
  assert.equal(PRODUCT.size, '50ml');
  assert.equal(PRODUCT.spraysApprox, 250);
  assert.equal(PRODUCT.sku, 'OS-001-50ML');
  assert.equal(BRAND.name, 'Smelloff');
  assert.equal(BRAND.city, 'Hyderabad');
  assert.equal(BRAND.country, 'India');
  assert.equal(FORMULA.version, 'v3.1');
  assert.ok(FORMULA.heroActives.includes('HPβCD'));
  assert.ok(FORMULA.heroActives.includes('Zinc PCA'));
});

test('commercial pricing math via calculateOrderTotal()', () => {
  // 1 unit prepaid
  const p1 = calculateOrderTotal(1, 'upi');
  assert.equal(p1.subtotal, 229);
  assert.equal(p1.shipping, 0);
  assert.equal(p1.codFee, 0);
  assert.equal(p1.total, 229);
  assert.equal(p1.totalPaise, 22900);

  // 1 unit COD
  const c1 = calculateOrderTotal(1, 'cod');
  assert.equal(c1.subtotal, 229);
  assert.equal(c1.shipping, 0);
  assert.equal(c1.codFee, 60);
  assert.equal(c1.total, 289);
  assert.equal(c1.totalPaise, 28900);

  // 2 units prepaid
  const p2 = calculateOrderTotal(2, 'prepaid');
  assert.equal(p2.subtotal, 458);
  assert.equal(p2.shipping, 0);
  assert.equal(p2.codFee, 0);
  assert.equal(p2.total, 458);
  assert.equal(p2.totalPaise, 45800);

  // 2 units COD
  const c2 = calculateOrderTotal(2, 'cod');
  assert.equal(c2.subtotal, 458);
  assert.equal(c2.codFee, 60);
  assert.equal(c2.total, 518);
  assert.equal(c2.totalPaise, 51800);
});

test('shared/product-truth.js is synchronized with product.json', () => {
  assert.equal(SMELLOFF_PRODUCT_TRUTH.pricePrepaid, 229);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.mrp, 499);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.codFee, 60);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.size, '50ml');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.formulaVersion, 'v3.1');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.sku, 'OS-001-50ML');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.brand, 'Smelloff');
});

test('shared/products-config.js BASE_PRODUCT is synchronized with product.json', () => {
  assert.equal(BASE_PRODUCT.price, 229);
  assert.equal(BASE_PRODUCT.mrp, 499);
  assert.equal(BASE_PRODUCT.codFee, 60);
  assert.equal(BASE_PRODUCT.sku, 'OS-001-50ML');
  assert.equal(BASE_PRODUCT.minQuantity, 1);
  assert.equal(BASE_PRODUCT.maxQuantity, 10);
});

test('buildProductJsonLd generates valid Schema.org Product object', () => {
  const jsonLd = buildProductJsonLd();
  assert.equal(jsonLd['@context'], 'https://schema.org');
  assert.equal(jsonLd['@type'], 'Product');
  assert.equal(jsonLd.name, PRODUCT.name);
  assert.equal(jsonLd.sku, PRODUCT.sku);
  assert.equal(jsonLd.offers.price, '229.00');
  assert.equal(jsonLd.offers.priceCurrency, 'INR');
});

test('buildProductsCatalogFeed produces valid Feed matching products.json', () => {
  const feed = buildProductsCatalogFeed();
  const fileFeed = JSON.parse(readFileSync('products.json', 'utf8'));
  assert.equal(feed.items[0].sku, fileFeed.items[0].sku);
  assert.equal(feed.items[0].price, fileFeed.items[0].price);
  assert.equal(feed.items[0].currency, fileFeed.items[0].currency);
});

test('claims guardrails: forbidden claims are flagged and not in approved list', () => {
  const claims = PRODUCT_CONFIG.claims;
  assert.ok(Array.isArray(claims.forbidden));
  assert.ok(claims.forbidden.some(c => c.toLowerCase().includes('zinc-ricinoleate')));
  assert.ok(claims.forbidden.some(c => c.toLowerCase().includes('skin')));
  assert.ok(claims.forbidden.some(c => c.toLowerCase().includes('bacteria')));
});

test('supabase/functions/create-order/index.ts derives from product.json without independent hardcodes', () => {
  const code = readFileSync('supabase/functions/create-order/index.ts', 'utf8');
  assert.ok(code.includes('config/product.json'));
  assert.ok(code.includes('UNIT_PRICE_RUPEES = productConfig.product.price'));
  assert.ok(code.includes('COD_FEE_RUPEES = productConfig.product.codFee'));
  assert.ok(code.includes('MAX_QTY = productConfig.product.maxQuantity'));
  assert.equal(code.includes('UNIT_PRICE_RUPEES = 229'), false);
  assert.equal(code.includes('COD_FEE_RUPEES = 60'), false);
  assert.equal(code.includes('MAX_QTY = 5'), false);
});

test('production backend endpoints derive from canonical BASE_PRODUCT without fallback 229 literals', () => {
  const shiprocketCode = readFileSync('api/_shiprocket.js', 'utf8');
  assert.ok(shiprocketCode.includes('BASE_PRODUCT.price'));
  assert.equal(shiprocketCode.includes('?? 229'), false);

  const paymentStatusCode = readFileSync('api/payment-status.js', 'utf8');
  assert.ok(paymentStatusCode.includes('BASE_PRODUCT.price'));
  assert.equal(paymentStatusCode.includes(': 229'), false);
  assert.equal(paymentStatusCode.includes("'229.00'"), false);
});

test('index.html homepage hero UX hierarchy and claim integrity', () => {
  const html = readFileSync('index.html', 'utf8');
  
  // Single semantic H1
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gis)];
  assert.equal(h1Matches.length, 1, 'Homepage must contain exactly one <h1>');
  assert.ok(h1Matches[0][1].includes('Your shirt smells'), 'H1 must lead with "Your shirt smells"');
  assert.ok(h1Matches[0][1].includes('Fix it.'), 'H1 must include "Fix it."');

  // Eyebrow and core positioning
  assert.ok(html.includes('FABRIC ODOR CONTROL · FOR CLOTHES'), 'Eyebrow must communicate fabric odor control for clothes');
  assert.ok(html.includes('ODORSTRIKE neutralizes odor trapped in your clothes — not on your skin.'), 'Explanation must communicate fabric vs skin');

  // Category clarification
  assert.ok(html.includes('NOT PERFUME'), 'Hero must clarify NOT PERFUME');
  assert.ok(html.includes('NOT BODY DEODORANT'), 'Hero must clarify NOT BODY DEODORANT');
  assert.ok(html.includes('FABRIC ONLY'), 'Hero must clarify FABRIC ONLY');

  // CTAs and Canonical Pricing
  assert.ok(html.includes('FIX MY SHIRT — ₹229'), 'Primary CTA must be FIX MY SHIRT — ₹229');
  assert.ok(html.includes('href="/odorstrike?buy=1"'), 'Primary CTA must link to /odorstrike?buy=1');
  assert.ok(html.includes('See how it works'), 'Secondary action must be present');

  // Usage microcopy
  assert.ok(html.includes('2–3 sprays'), 'Usage microcopy must state 2–3 sprays');
  assert.ok(html.includes('wait ~10 sec'), 'Usage microcopy must state ~10 sec wait');
  assert.ok(html.includes('wear'), 'Usage microcopy must state wear');

  // Visual & Demo Slot
  assert.ok(html.includes('id="heroDemoSlot"'), 'Isolated demo slot must exist');
  assert.ok(html.includes('/assets/odorstrike-bottle-cutout.webp'), 'Preloaded bottle cutout must be present');
  assert.ok(html.includes('WAIT ~10 SEC'), 'Demo slot must clearly state WAIT ~10 SEC');
  assert.ok(html.includes('WEAR FRESH'), 'Demo slot must clearly state WEAR FRESH end state');
  assert.ok(html.includes('class="hero-demo-steps"'), 'Demo slot must contain structured steps');

  // Negative Guardrails
  assert.equal(/579|60%\s*OFF/i.test(html), false, 'Hero must not contain obsolete pricing or discount hype');
  assert.equal(/instantly kills smell|miracle cure|guaranteed odor cure/i.test(html), false, 'Hero must not contain prohibited claims');
});

test('index.html homepage problem story section UX hierarchy and claims', () => {
  const html = readFileSync('index.html', 'utf8');

  // Eyebrow and Section H2
  assert.ok(html.includes('THE CLOTHING ODOR PROBLEM'), 'Eyebrow must state clothing odor problem');
  assert.ok(html.includes('id="remembersTitle"'), 'Remembers section H2 id must exist');
  assert.ok(html.includes('Your shirt remembers'), 'H2 must state "Your shirt remembers"');

  // Clear Problem Differentiation (Skin vs Fabric)
  assert.ok(html.includes('Deodorant works on your skin'), 'Intro must explain deodorant on skin');
  assert.ok(html.includes('trapped inside the weave of your clothes'), 'Intro must clarify trapped in fabric weave');

  // Narrative Timeline Moments (no fabricated lab testing claims)
  assert.ok(html.includes('07:30'), 'Timeline must start with morning moment');
  assert.ok(html.includes('19:45'), 'Timeline must transition to evening moment');
  assert.ok(html.includes('Reset with ODORSTRIKE'), 'Timeline axis must point to ODORSTRIKE reset');
  assert.ok(html.includes('These are everyday moments, not lab tests.'), 'Footnote must ground timeline as everyday moments');
  assert.ok(html.includes('Fix your shirt — ₹229'), 'CTA must provide clear action');
});

test('index.html homepage .zones garment cards structure and fabric positioning', () => {
  const html = readFileSync('index.html', 'utf8');

  // Exactly 3 garment zone cards
  const zoneMatches = html.match(/class="zone"/g) || [];
  assert.equal(zoneMatches.length, 3, 'Must contain exactly 3 garment zone cards');

  // Garment titles & semantic H3 headings
  assert.ok(html.includes('<h3 class="z-title">Shirt collar</h3>'), 'Card 1 must be Shirt collar');
  assert.ok(html.includes('<h3 class="z-title">Hoodie &amp; tees</h3>'), 'Card 2 must be Hoodie & tees');
  assert.ok(html.includes('<h3 class="z-title">Blazer &amp; jacket</h3>'), 'Card 3 must be Blazer & jacket');

  // Problem situation tags
  assert.ok(html.includes('HEAT &amp; SWEAT'), 'Card 1 must include HEAT & SWEAT tag');
  assert.ok(html.includes('REPEAT WEAR'), 'Card 2 must include REPEAT WEAR tag');
  assert.ok(html.includes('BETWEEN WASHES'), 'Card 3 must include BETWEEN WASHES tag');

  // Guardrails
  assert.equal(/kills bacteria in shirts|odor-proof guarantee/i.test(html), false, 'Cards must not contain prohibited claims');
});

test('index.html homepage featured product section UX hierarchy, pricing and claims', () => {
  const html = readFileSync('index.html', 'utf8');

  // Section exists and has proper ARIA linkage
  assert.ok(html.includes('id="odorstrike-featured"'), 'Featured product section id must exist');
  assert.ok(html.includes('id="productTitle"'), 'Product title id must exist');

  // Category & Skin differentiation
  assert.ok(html.includes('FABRIC ODOR CONTROL · 50ML'), 'Eyebrow must state fabric category and size');
  assert.ok(html.includes('FABRIC ONLY'), 'Must include FABRIC ONLY badge');
  assert.ok(html.includes('NOT FOR SKIN'), 'Must include NOT FOR SKIN badge');

  // Core benefits & specs
  assert.ok(html.includes('50ml Pocket Mist (~250 sprays)'), 'Must state 50ml and sprays');
  assert.ok(html.includes('HPβCD &amp; Zinc PCA active formula'), 'Must state active formula');
  assert.ok(html.includes('Dries clear in ~10s · Zero residue'), 'Must state dry time and zero residue');

  // Canonical pricing, terms & CTAs
  assert.ok(html.includes('₹229'), 'Must state canonical price ₹229');
  assert.ok(html.includes('for 1 × 50ml ODORSTRIKE'), 'Must state unit volume and product name');
  assert.ok(html.includes('MRP ₹499'), 'Must state MRP ₹499');
  assert.ok(html.includes('FREE SHIPPING — PREPAID'), 'Must state free shipping prepaid');
  assert.ok(html.includes('COD AVAILABLE · ₹60 HANDLING'), 'Must state COD handling fee');
  assert.ok(html.includes('7-DAY RETURNS'), 'Must state 7-day returns');
  assert.ok(html.includes('GET ODORSTRIKE — ₹229'), 'Must include prominent primary buy CTA');

  // Prohibited claims
  assert.equal(/instant miracle|kills bacteria on contact|100% odor-proof/i.test(html), false, 'Must not contain prohibited claims');
});



