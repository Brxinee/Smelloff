import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PDP_PATH = path.join(ROOT, 'odorstrike.html');

describe('ODORSTRIKE PDP Claims & Architectural Guardrails', () => {
  const html = fs.readFileSync(PDP_PATH, 'utf8');

  it('contains canonical pricing (₹229) and single SKU invariants', () => {
    assert.ok(html.includes('₹229'), 'Must contain price ₹229');
    assert.ok(html.includes('MRP ₹499') || html.includes('M.R.P. ₹499'), 'Must contain MRP ₹499');
    assert.ok(html.includes('54% OFF'), 'Must state 54% discount');
    assert.ok(!/Duo\s*₹?\s*399|Trio\s*₹?\s*549|Solo\s*₹?\s*179/i.test(html), 'Must not contain retired bundle pricing');
    assert.ok(!/₹\s*579/i.test(html), 'Must not contain obsolete ₹579 price');
  });

  it('validates Product JSON-LD node integrity (price, currency, canonical url, shipping, returns, review status)', () => {
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let productNode = null;
    let productCount = 0;

    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block[1]);
        if (parsed['@type'] === 'Product') {
          productCount++;
          productNode = parsed;
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item['@type'] === 'Product') {
              productCount++;
              productNode = item;
            }
          }
        }
      } catch (_e) {}
    }

    assert.equal(productCount, 1, 'PDP must contain exactly 1 Product JSON-LD node');
    assert.ok(productNode, 'Product node must exist');
    assert.ok(productNode.offers, 'Product must have offers');
    
    // Validate price & currency
    const offerPrice = String(productNode.offers.price);
    assert.ok(offerPrice === '229' || offerPrice === '229.00', `Product offer price must be 229 or 229.00, got ${offerPrice}`);
    assert.equal(productNode.offers.priceCurrency, 'INR', 'Product offer currency must be INR');
    assert.equal(productNode.offers.url, 'https://smelloff.in/odorstrike#buy', 'Product offer URL must target canonical #buy');

    // Validate shipping details
    assert.ok(productNode.offers.shippingDetails, 'Product offers must include shippingDetails');
    assert.ok(Number(productNode.offers.shippingDetails.shippingRate.value) === 0, 'Prepaid shipping rate must be 0 (Free)');
    assert.equal(productNode.offers.shippingDetails.shippingDestination.addressCountry, 'IN', 'Shipping destination must be IN');

    // Validate returns policy
    assert.ok(productNode.offers.hasMerchantReturnPolicy, 'Product offers must include hasMerchantReturnPolicy');
    assert.equal(productNode.offers.hasMerchantReturnPolicy.merchantReturnDays, 7, 'Return policy must specify 7 days');
    assert.equal(productNode.offers.hasMerchantReturnPolicy.applicableCountry, 'IN', 'Return applicableCountry must be IN');

    // Validate no fabricated ratings/reviews
    assert.equal(productNode.aggregateRating, undefined, 'Must not fabricate aggregateRating in JSON-LD');
    assert.equal(productNode.review, undefined, 'Must not fabricate review array in JSON-LD');
  });

  it('contains zero FAQPage JSON-LD schemas (deprecated on PDPs per Google guidelines)', () => {
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let faqPageCount = 0;
    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block[1]);
        if (parsed['@type'] === 'FAQPage' || (Array.isArray(parsed) && parsed.some(x => x['@type'] === 'FAQPage'))) {
          faqPageCount++;
        }
      } catch (_e) {}
    }
    assert.equal(faqPageCount, 0, 'PDP must NOT emit FAQPage schema (reserved for dedicated /faq)');
  });

  it('verifies product config and shared sources cannot reintroduce prohibited terms', () => {
    const configPath = path.join(ROOT, 'config', 'product.json');
    const sharedConfigPath = path.join(ROOT, 'shared', 'products-config.js');
    const catalogPath = path.join(ROOT, 'products.json');

    const configContent = fs.readFileSync(configPath, 'utf8');
    const sharedContent = fs.readFileSync(sharedConfigPath, 'utf8');
    const catalogContent = fs.readFileSync(catalogPath, 'utf8');

    const prohibitedPatterns = [
      /\banti-regrowth\b/i,
      /\bzero\s+residue\b/i,
      /\bno\s+white\s+marks\b/i,
      /\bkills?\s+bacteria\b/i,
      /\bantimicrobial\b/i,
      /\bantibacterial\b/i,
      /\bskin\s+safe\b/i,
      /\bclears?\s+airport\s+security\b/i,
      /\bhandles\s+a\s+week\s+of\s+travel\b/i
    ];

    // Check config description
    const configObj = JSON.parse(configContent);
    for (const pat of prohibitedPatterns) {
      assert.ok(!pat.test(configObj.product.description), `config/product.json description contains prohibited pattern: ${pat}`);
    }

    // Check fourLayerSystem and INCI roles
    for (const layer of configObj.formula.fourLayerSystem) {
      assert.ok(!/anti-regrowth/i.test(layer.role), `fourLayerSystem layer role contains anti-regrowth: ${layer.role}`);
    }
    for (const item of configObj.formula.inci) {
      assert.ok(!/anti-regrowth/i.test(item.role), `INCI role contains anti-regrowth: ${item.role}`);
    }

    // Check shared product config approved claims
    assert.ok(!/zero\s+residue/i.test(sharedContent.split('APPROVED_CLAIMS')[1]?.split('PROHIBITED_CLAIMS')[0] || ''), 'shared APPROVED_CLAIMS must not contain zero residue');

    // Check products.json catalog description
    assert.ok(!/anti-regrowth|zero residue|kills bacteria/i.test(catalogContent), 'products.json must not contain prohibited claims');
  });

  it('does not contain prohibited "anti-regrowth" claims', () => {
    assert.ok(!/anti-regrowth/i.test(html), 'Must not contain "anti-regrowth" claims in text, schema, or tags');
  });

  it('does not contain unsupported antimicrobial, biocidal, or medical claims', () => {
    assert.ok(!/\bkills?\s+(?:the\s+)?bacteria\b/i.test(html), 'Must not claim to kill bacteria');
    assert.ok(!/\bantimicrobial\b/i.test(html), 'Must not claim antimicrobial action');
    assert.ok(!/\bantibacterial\b/i.test(html), 'Must not claim antibacterial action');
    assert.ok(!/\bdisinfect(?:s|ing|ant)?\b/i.test(html), 'Must not claim disinfection');
    assert.ok(!/\bsanitiz(?:es|ing|er)?\b/i.test(html), 'Must not claim sanitization');
    assert.ok(!/\b(?:dermatologist|dermatologically|clinically)\s+tested\b/i.test(html), 'Must not claim clinical/dermatological testing');
    assert.ok(!/\bskin\s+safe\b/i.test(html), 'Must not claim skin safe (product is fabric-only)');
  });

  it('strictly enforces Fabric-Only distinction throughout UI', () => {
    assert.ok(html.includes('NOT PERFUME'), 'Must include NOT PERFUME badge');
    assert.ok(html.includes('NOT BODY DEODORANT'), 'Must include NOT BODY DEODORANT badge');
    assert.ok(html.includes('FABRIC ONLY'), 'Must include FABRIC ONLY badge');
    assert.ok(/never\s+(?:spray\s+directly\s+onto\s+skin|on\s+skin|for\s+skin)/i.test(html), 'Must explicitly state not for skin');
  });

  it('hedges duration / longevity claims with context and wear conditions', () => {
    assert.ok(!/works\s+in\s+8\s+seconds/i.test(html), 'Must not claim 8-second action');
    assert.ok(!/roughly\s+four\s+months/i.test(html), 'Must not claim 4-month lifespan');
    assert.ok(!/handles\s+a\s+week\s+of\s+travel/i.test(html), 'Must not claim handles a week of travel unconditionally');
    
    // Check that 'up to 8 hours' in specifications/tagline is hedged
    const unhedged8hr = html.match(/up to 8 hours of (?:clean )?odor protection on fabric(?!\s*(?:under normal office|\*))/i);
    assert.ok(!unhedged8hr, '8 hour protection claim must be qualified with office/commute testing or asterisk');
  });

  it('avoids absolute residue and universal fabric claims', () => {
    assert.ok(!/\bzero\s+residue\b/i.test(html), 'Must not make absolute "zero residue" claim without context');
    assert.ok(!/\bno\s+white\s+marks\b/i.test(html), 'Must not make absolute "no white marks" claim without tested context');
    assert.ok(!/\bnever\s+stains\b/i.test(html), 'Must not make absolute "never stains" claim');
    assert.ok(!/\ball\s+fabrics\b/i.test(html), 'Must not claim universal compatibility on all fabrics');
    assert.ok(html.includes('Spot-test') || html.includes('Patch-test') || html.includes('patch-test'), 'Must advise spot/patch testing for delicates');
  });

  it('verifies that all gallery image alt-attributes are present and claim-compliant', () => {
    const galleryBlock = html.match(/<div class="gallery-stack"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*Mobile Gallery Slide Indicator/i);
    assert.ok(galleryBlock, 'Gallery stack must be present in HTML');
    
    const imgTags = [...galleryBlock[1].matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
    assert.equal(imgTags.length, 8, 'Must have 8 gallery images');

    for (const tag of imgTags) {
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      assert.ok(altMatch && altMatch[1].length > 10, `Gallery image missing descriptive alt text: ${tag}`);
      const alt = altMatch[1];
      assert.ok(!/anti-regrowth/i.test(alt), `Alt text contains anti-regrowth: ${alt}`);
      assert.ok(!/zero\s+residue/i.test(alt), `Alt text contains zero residue: ${alt}`);
      assert.ok(!/no\s+white\s+marks/i.test(alt), `Alt text contains no white marks: ${alt}`);
      assert.ok(!/kills?\s+bacteria/i.test(alt), `Alt text contains kills bacteria: ${alt}`);
      assert.ok(!/airport security/i.test(alt), `Alt text contains airport security: ${alt}`);
    }
  });

  it('ensures accurate spray count and refresh cost metrics', () => {
    assert.ok(!/₹\s*2\.29\b/i.test(html), 'Must not claim ₹2.29 per refresh without math breakdown');
    assert.ok(html.includes('~250 sprays'), 'Must state ~250 sprays per 50ml bottle');
    assert.ok(html.includes('83–125') || html.includes('80–125'), 'Must state realistic refresh count (2–3 sprays/refresh)');
  });

  it('ensures HowTo schema steps are claim-compliant', () => {
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let howTo = null;
    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block[1]);
        if (parsed['@type'] === 'HowTo') {
          howTo = parsed;
          break;
        }
      } catch (_e) {}
    }
    assert.ok(howTo, 'HowTo schema must be present and valid JSON');
    assert.equal(howTo.step.length, 4, 'HowTo must have 4 steps');
    
    const allStepText = howTo.step.map(s => s.text).join(' ');
    assert.ok(!/zero\s+residue/i.test(allStepText), 'HowTo steps must not contain zero residue');
    assert.ok(!/no\s+white\s+marks/i.test(allStepText), 'HowTo steps must not contain no white marks');
    assert.ok(!/anti-regrowth/i.test(allStepText), 'HowTo steps must not contain anti-regrowth');
  });
});
