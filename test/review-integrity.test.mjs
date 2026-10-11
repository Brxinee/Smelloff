import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

describe('Review System & Product Schema Integrity', () => {
  it('reviews-system.js does not contain fake review fallbacks or fake google claims', () => {
    const code = fs.readFileSync(path.join(ROOT, 'assets/js/reviews-system.js'), 'utf8');
    assert.ok(!code.includes('renderGoogleReviewWidget'), 'Should not have renderGoogleReviewWidget');
    assert.ok(!code.includes('injectAggregateSchema'), 'Should not have injectAggregateSchema');
    assert.ok(!code.includes('google-review-aggregate-ld'), 'Should not inject dynamic schema node');
    assert.ok(!code.includes('100% Verified Customer Purchases'), 'Should not have fake claims');
    assert.ok(!/\b4\.9\b/.test(code), 'Should not have fake 4.9 fallback');
    assert.ok(!/\b128\b/.test(code), 'Should not have fake 128 review count fallback');
  });

  it('reviews-system.js isolates beta testers and calculates aggregate from verified buyers only', () => {
    const code = fs.readFileSync(path.join(ROOT, 'assets/js/reviews-system.js'), 'utf8');
    assert.ok(!code.includes('SEED_TESTERS.reduce'), 'Beta testers must not contribute to aggregate calculation');
    assert.ok(code.includes('BETA_TESTER_TESTIMONIALS') || code.includes('BETA_TESTERS'), 'Beta testers must be explicitly defined');
  });

  it('reviews.html does not hardcode fake initial ratings', () => {
    const html = fs.readFileSync(path.join(ROOT, 'reviews.html'), 'utf8');
    assert.ok(!/<span class="agg-num"[^>]*>4\.9<\/span>/.test(html), 'Initial HTML must not contain hardcoded 4.9');
    assert.ok(!html.includes('googleReviewWidgetMount'), 'Should not contain googleReviewWidgetMount');
  });

  it('odorstrike.html contains exactly ONE authoritative Product JSON-LD block with correct fields', () => {
    const html = fs.readFileSync(path.join(ROOT, 'odorstrike.html'), 'utf8');
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const productBlocks = [];

    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block[1]);
        if (parsed['@type'] === 'Product') {
          productBlocks.push(parsed);
        }
      } catch (_e) {}
    }

    assert.equal(productBlocks.length, 1, 'Must have exactly 1 Product JSON-LD block');
    const prod = productBlocks[0];
    assert.equal(prod['@id'], 'https://smelloff.in/#odorstrike');
    assert.equal(prod.name, 'ODORSTRIKE Fabric Odor Remover Spray');
    assert.equal(prod.sku, 'OS-001-50ML');
    assert.equal(prod.offers?.price, '229.00');
    assert.equal(prod.offers?.priceCurrency, 'INR');
    assert.ok(prod.offers?.shippingDetails, 'Must include shippingDetails');
    assert.ok(prod.offers?.hasMerchantReturnPolicy, 'Must include hasMerchantReturnPolicy');
  });

  it('odorstrike.html does not contain runtime Product schema mutations', () => {
    const html = fs.readFileSync(path.join(ROOT, 'odorstrike.html'), 'utf8');
    assert.ok(!html.includes('pData.aggregateRating'), 'Must not mutate pData.aggregateRating');
    assert.ok(!html.includes('productScript.textContent = JSON.stringify'), 'Must not rewrite product-jsonld textContent');
  });

  it('submit-review strictly enforces review token and excludes phone fallback', () => {
    const code = fs.readFileSync(path.join(ROOT, 'supabase/functions/submit-review/index.ts'), 'utf8');
    assert.ok(code.includes('verifyReviewToken'), 'Must call verifyReviewToken');
    assert.ok(!code.includes('orderPhone === phone'), 'Must not permit phone fallback bypass');
    assert.ok(code.includes('isOrderReviewEligible'), 'Must enforce isOrderReviewEligible');
  });

  it('track-order and security module gate review token issuance by order eligibility', () => {
    const trackCode = fs.readFileSync(path.join(ROOT, 'supabase/functions/track-order/index.ts'), 'utf8');
    assert.ok(trackCode.includes('isOrderReviewEligible'), 'track-order must check isOrderReviewEligible');

    const secCode = fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/security.ts'), 'utf8');
    assert.ok(secCode.includes('isOrderReviewEligible'), 'security.ts must export isOrderReviewEligible');
    assert.ok(secCode.includes('constantTimeEqual'), 'security.ts must use constant-time equality');
  });

  it('html files reference the updated cache-busted reviews-system.js?v=3', () => {
    const odor = fs.readFileSync(path.join(ROOT, 'odorstrike.html'), 'utf8');
    const rev = fs.readFileSync(path.join(ROOT, 'reviews.html'), 'utf8');
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const trk = fs.readFileSync(path.join(ROOT, 'track-order.html'), 'utf8');

    assert.ok(odor.includes('/assets/js/reviews-system.js?v=3'), 'odorstrike.html must use ?v=3');
    assert.ok(rev.includes('/assets/js/reviews-system.js?v=3'), 'reviews.html must use ?v=3');
    assert.ok(idx.includes('/assets/js/reviews-system.js?v=3'), 'index.html must use ?v=3');
    assert.ok(trk.includes('/assets/js/reviews-system.js?v=3'), 'track-order.html must use ?v=3');
  });

  it('index.html does not contain googleReviewWidgetMount', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(!html.includes('googleReviewWidgetMount'), 'index.html must not contain googleReviewWidgetMount');
  });
});
