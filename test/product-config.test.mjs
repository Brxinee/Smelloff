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

