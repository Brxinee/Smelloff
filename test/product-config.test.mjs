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

test('index.html homepage how-it-works science and formula UX hierarchy and claims', () => {
  const html = readFileSync('index.html', 'utf8');

  // Section exists and has proper anchor / ARIA linkage
  assert.ok(html.includes('id="how-it-works"'), 'How it works anchor id must exist');
  assert.ok(html.includes('id="proofTitle"'), 'Proof title id must exist');

  // Category & Positioning: Fabric odor control vs Perfume
  assert.ok(html.includes('FABRIC ODOR CONTROL · THE SCIENCE'), 'Eyebrow must state fabric odor control and science');
  assert.ok(html.includes('Not perfume. Not deodorant.'), 'Title must establish odor control vs perfume');
  assert.ok(html.includes('Sweat and daily odors get trapped inside the weave of your clothes'), 'Must explain trapped odor in fabric weave');
  assert.ok(html.includes('neutralizing it at the source instead of masking'), 'Must explain neutralization at source vs masking');

  // 4-layer functional actives with accurate canonical roles
  assert.ok(html.includes('01 — TRAP'), 'Layer 1 must be TRAP');
  assert.ok(html.includes('HPβCD'), 'Must feature HPβCD active');
  assert.ok(html.includes('02 — NEUTRALIZE'), 'Layer 2 must be NEUTRALIZE');
  assert.ok(html.includes('Zinc PCA'), 'Must feature Zinc PCA active');
  assert.ok(html.includes('03 — PREVENT'), 'Layer 3 must be PREVENT');
  assert.ok(html.includes('Triethyl Citrate'), 'Must feature Triethyl Citrate active');
  assert.ok(html.includes('04 — ANTI-REGROWTH'), 'Layer 4 must be ANTI-REGROWTH');
  assert.ok(html.includes('Zinc Gluconate'), 'Must feature Zinc Gluconate active');

  // Progressive disclosure: INCI details
  assert.ok(html.includes('Formula v3.1 — full 11-ingredient INCI list'), 'Must provide progressive disclosure for full INCI list');
  assert.ok(html.includes('hydroxypropyl-β-cyclodextrin'), 'INCI list must include chemical name');

  // Prohibited claims
  assert.equal(/kills bacteria|antimicrobial drug|instant miracle|100% odor-proof|guaranteed odor cure/i.test(html), false, 'Must not contain prohibited claims');
});

test('index.html homepage founder trust section UX hierarchy, identity and claim discipline', () => {
  const html = readFileSync('index.html', 'utf8');

  // Section exists and has proper ARIA linkage
  assert.ok(html.includes('class="founder"'), 'Founder section class must exist');
  assert.ok(html.includes('aria-labelledby="founderTitle"'), 'Founder section must be labeled by founderTitle');
  assert.ok(html.includes('id="founderTitle"'), 'Founder title id must exist');

  // Hierarchy 1: Founder Identity
  assert.ok(html.includes('FOUNDER · HYDERABAD'), 'Eyebrow must state founder and location');
  assert.ok(html.includes('Jogdhande Nikhil Patil'), 'Must state authoritative founder name');
  assert.ok(html.includes('Founder, Smelloff · Hyderabad'), 'Must state canonical founder role and city');

  // Hierarchy 2: Why Smelloff exists
  assert.ok(html.includes('41°C Hyderabad heat'), 'Must ground story in documented 41C Hyderabad commute');
  assert.ok(html.includes('morning deodorant had worked on skin, but the shirt had trapped the sweat'), 'Must state core insight: skin vs fabric gap');
  assert.ok(html.includes('layering perfume over it only makes it worse'), 'Must reject fragrance masking');

  // Hierarchy 3: What was built
  assert.ok(html.includes('ODORSTRIKE'), 'Must name product built');
  assert.ok(html.includes('neutralize trapped odor compounds inside clothing fibres rather than masking'), 'Must state neutralizer mechanism over perfume');

  // Hierarchy 4: Real-world credibility & Link
  assert.ok(html.includes('Built and tested in Hyderabad'), 'Must carry documented built & tested in Hyderabad copy');
  assert.ok(html.includes('Made in India'), 'Must carry Made in India truth');
  assert.ok(html.includes('href="/about"'), 'Must link to /about page');
  assert.ok(html.includes('class="founder-link"'), 'Must have accessible thumb-friendly founder link class');

  // Prohibited founder claims and false authority guardrails
  assert.equal(/chemist|scientist|expert|dermatologist tested|clinically tested|lab certified|India's #1|India's first|award-winning|venture backed|patented breakthrough/i.test(html.slice(html.indexOf('class="founder"'), html.indexOf('class="proof"'))), false, 'Founder section must not contain prohibited false authority claims');
});

test('index.html homepage testimonial and beta tester voices section UX hierarchy and claims discipline', () => {
  const html = readFileSync('index.html', 'utf8');

  // Section exists and has proper ARIA linkage
  assert.ok(html.includes('class="voices"'), 'Voices section class must exist');
  assert.ok(html.includes('aria-labelledby="voicesTitle"'), 'Voices section must be labeled by voicesTitle');
  assert.ok(html.includes('id="voicesTitle"'), 'Voices title id must exist');

  // Honest labelling: Early testers / Beta tester, never fake "verified buyer"
  assert.ok(html.includes('Early testers'), 'Eyebrow must state Early testers');
  assert.ok(html.includes('What it\'s like to carry one'), 'Title must be What it\'s like to carry one');
  assert.equal((html.match(/class="v-tag">Beta tester<\/span>/g) || []).length, 3, 'Must have 3 Beta tester tags');

  // Card 1: Rohit (Bengaluru)
  assert.ok(html.includes('Rohit, 26 · Bengaluru'), 'Card 1 must identify Rohit, 26 · Bengaluru');
  assert.ok(html.includes('2-hour bike ride → client meeting'), 'Card 1 must describe 2-hour bike ride context');
  assert.ok(html.includes('Sprayed it on my shirt before a client meeting after a 2hr bike ride. Nobody flinched.'), 'Card 1 quote must match authentic text');

  // Card 2: Aakash (Pune)
  assert.ok(html.includes('Aakash, 24 · Pune'), 'Card 2 must identify Aakash, 24 · Pune');
  assert.ok(html.includes('Gym bag · Post-workout to office'), 'Card 2 must describe gym bag context');
  assert.ok(html.includes('Lives in my gym bag now. Post-workout, pre-Uber, no more ‘should I shower at office’ anxiety.'), 'Card 2 quote must match authentic text');

  // Card 3: Karan (Delhi)
  assert.ok(html.includes('Karan, 29 · Delhi'), 'Card 3 must identify Karan, 29 · Delhi');
  assert.ok(html.includes('Dinner jacket · Biryani odor reset'), 'Card 3 must describe dinner jacket context');
  assert.ok(html.includes('Smell is gone in one spray. Biryani jacket — fixed. Only wish the bottle was a bit bigger.'), 'Card 3 quote must match authentic text');

  // Link to long version review
  assert.ok(html.includes('href="/blog/odorstrike-review-30-day-india-test"'), 'Must link to 30-day India test review');

  // Prohibited social proof fabrications
  const voicesBlock = html.slice(html.indexOf('class="voices"'), html.indexOf('class="founder"'));
  assert.equal(/verified buyer|verified purchase|4\.9\/5|5\.0\/5|1,000\+ customers|10,000\+ happy|★★★★★|ratingValue/i.test(voicesBlock), false, 'Voices section must not contain fabricated social proof or fake ratings');
});

test('index.html homepage FAQ objection-first hierarchy, schema parity and claims discipline', () => {
  const html = readFileSync('index.html', 'utf8');

  // Exactly one FAQPage JSON-LD block
  const faqPageMatches = html.match(/"@type"\s*:\s*"FAQPage"/g) || [];
  assert.equal(faqPageMatches.length, 1, 'index.html must have exactly one FAQPage schema block');

  // Extract FAQPage JSON-LD
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  let faqSchema = null;
  for (const block of scriptMatch) {
    if (block.includes('"FAQPage"')) {
      const jsonText = block.replace(/<script type="application\/ld\+json">|<\/script>/g, '').trim();
      faqSchema = JSON.parse(jsonText);
      break;
    }
  }
  assert.ok(faqSchema, 'Must parse FAQPage schema');
  assert.equal(faqSchema.mainEntity.length, 10, 'FAQPage schema must contain exactly 10 questions');

  // Extract visible FAQ items from <section class="faq"
  const faqSectionStart = html.indexOf('<section class="faq"');
  assert.ok(faqSectionStart !== -1, 'Must have <section class="faq"');
  const faqSectionEnd = html.indexOf('</section>', faqSectionStart);
  const faqSection = html.slice(faqSectionStart, faqSectionEnd);

  // Extract visible questions and answers
  const qMatches = [...faqSection.matchAll(/<summary><h3>([\s\S]*?)<\/h3><\/summary>/g)].map(m => m[1].trim());
  const aMatches = [...faqSection.matchAll(/<div class="faq-answer-wrap"><div><p>([\s\S]*?)<\/p><\/div><\/div>/g)].map(m => m[1].trim());

  assert.equal(qMatches.length, 10, 'Must have exactly 10 visible FAQ questions');
  assert.equal(aMatches.length, 10, 'Must have exactly 10 visible FAQ answers');

  // Expected 10 objection questions in order
  const expectedQuestions = [
    'Is ODORSTRIKE safe on skin?',
    'Will it stain my clothes?',
    'How do I use it?',
    'How long does the effect last?',
    'What fabrics can I use it on?',
    'Does it replace washing?',
    'Is the fragrance strong?',
    'Is COD available?',
    'How long does shipping take?',
    'What is the return policy?'
  ];

  for (let i = 0; i < expectedQuestions.length; i++) {
    assert.equal(qMatches[i], expectedQuestions[i], `Question ${i + 1} must match expected objection: ${expectedQuestions[i]}`);
    assert.equal(faqSchema.mainEntity[i].name, expectedQuestions[i], `Schema question ${i + 1} name must match expected question`);
    assert.equal(aMatches[i], faqSchema.mainEntity[i].acceptedAnswer.text, `Answer ${i + 1} in HTML must match schema text 1:1`);
  }

  // Claim discipline guardrails in FAQ section
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(faqSection), false, 'FAQ must not contain prohibited claims');
  assert.equal(/fragrance-free|unscented|scentless/i.test(faqSection), false, 'FAQ must not claim fragrance-free');

  // Commercial values match canonical configuration
  assert.ok(faqSection.includes('₹229'), 'FAQ must state ₹229 prepaid price');
  assert.ok(faqSection.includes('₹60'), 'FAQ must state ₹60 COD fee');
  assert.ok(faqSection.includes('₹289'), 'FAQ must state ₹289 COD total');
  assert.ok(faqSection.includes('7-day return window'), 'FAQ must state 7-day return window');
  assert.ok(faqSection.includes('80% full'), 'FAQ must state 80% full condition');
  assert.ok(faqSection.includes('48 hours'), 'FAQ must state 48-hour dispatch');
  assert.ok(faqSection.includes('3–5 business days'), 'FAQ must state 3–5 days metro delivery');

  // Fabric-only safety guardrail
  assert.ok(faqSection.includes('never skin, face, hair, or body'), 'FAQ must strictly prohibit skin, face, hair, or body application');
  assert.ok(faqSection.includes('zero residue'), 'FAQ must state zero residue');
  assert.ok(faqSection.includes('15–20 cm'), 'FAQ must state 15–20 cm spray distance');
  assert.ok(faqSection.includes('approximately 10 seconds'), 'FAQ must state approximately 10 seconds dry time');
  assert.ok(faqSection.includes('Up to 8 hours'), 'FAQ must state Up to 8 hours duration');
});

test('odorstrike.html PDP hero and primary buy area UX hierarchy, canonical pricing, and claims discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // Extract .product-info block
  const pInfoStart = html.indexOf('<div class="product-info">');
  assert.ok(pInfoStart !== -1, 'Must have <div class="product-info">');
  const pInfoEnd = html.indexOf('<div id="heroProofMount">', pInfoStart);
  const pInfo = html.slice(pInfoStart, pInfoEnd);

  // 1. Positioning & Product identity in eyebrow and H1
  assert.ok(pInfo.includes('FABRIC ODOR CONTROL · 50ML'), 'Eyebrow must prominently declare fabric odor control positioning');
  assert.ok(pInfo.includes('<h1>ODORSTRIKE</h1>'), 'Headline must be clear brand name ODORSTRIKE');

  // 2. Tagline what it is and core benefit
  assert.ok(pInfo.includes('A pocket-sized fabric odor mist for clothes'), 'Tagline must define product category');
  assert.ok(pInfo.includes('neutralizes them directly in fabric fibres'), 'Tagline must state neutralizes in fabric fibres');
  assert.ok(pInfo.includes('up to 8 hours of clean odor protection'), 'Tagline must state up to 8 hours');
  assert.ok(pInfo.includes('zero residue'), 'Tagline must state zero residue');

  // 3. Clear differentiator badges
  assert.ok(pInfo.includes('NOT PERFUME'), 'Must display NOT PERFUME badge');
  assert.ok(pInfo.includes('NOT BODY DEODORANT'), 'Must display NOT BODY DEODORANT badge');
  assert.ok(pInfo.includes('FABRIC ONLY'), 'Must display FABRIC ONLY badge');

  // 4. Authoritative commercial pricing hierarchy
  assert.ok(pInfo.includes('class="price">₹229</span>'), 'Price must display ₹229');
  assert.ok(pInfo.includes('1 × 50ml bottle'), 'Pack size must display 1 × 50ml bottle');
  assert.ok(pInfo.includes('MRP ₹499'), 'Struck price must be MRP ₹499');
  assert.ok(pInfo.includes('54% OFF'), 'Discount must be 54% OFF');
  assert.ok(pInfo.includes('FREE SHIPPING</strong> — PREPAID'), 'Prepaid shipping must be free');
  assert.ok(pInfo.includes('COD AVAILABLE</strong> (₹60 HANDLING · ₹289 TOTAL)'), 'COD fee must be ₹60 with ₹289 total');

  // 5. Purchase actions & controls
  assert.ok(pInfo.includes('id="pdpQtyDec"'), 'Qty decrement button must exist');
  assert.ok(pInfo.includes('id="pdpQtyVal"'), 'Qty output display must exist');
  assert.ok(pInfo.includes('id="pdpQtyInc"'), 'Qty increment button must exist');
  assert.ok(pInfo.includes('id="pdpBuyBtn"'), 'Primary buy button id must exist');
  assert.ok(pInfo.includes('GET ODORSTRIKE — ₹229'), 'Initial buy button text must match canonical price');
  assert.ok(pInfo.includes('id="pdpCartBtn"'), 'Secondary cart button id must exist');

  // 6. Buying reassurance strip
  assert.ok(pInfo.includes('Free Shipping Pan-India'), 'Reassurance: Free shipping pan-India');
  assert.ok(pInfo.includes('COD Available · ₹60 Handling'), 'Reassurance: COD with ₹60 handling');
  assert.ok(pInfo.includes('Delivers in 3–7 Days'), 'Reassurance: Delivers in 3–7 days');
  assert.ok(pInfo.includes('7-Day Returns'), 'Reassurance: 7-day returns');

  // 7. Strict visual reading order in DOM
  const idxEyebrow = pInfo.indexOf('class="ph-eyebrow"');
  const idxH1 = pInfo.indexOf('<h1>ODORSTRIKE</h1>');
  const idxTagline = pInfo.indexOf('class="ph-tagline"');
  const idxBadges = pInfo.indexOf('class="ph-badges"');
  const idxPrice = pInfo.indexOf('class="ph-price"');
  const idxBuyActions = pInfo.indexOf('class="buy-actions"');
  const idxTrust = pInfo.indexOf('class="hero-trust"');
  const idxScale = pInfo.indexOf('class="spec-scale"');

  assert.ok(idxEyebrow < idxH1, 'Eyebrow must precede H1');
  assert.ok(idxH1 < idxTagline, 'H1 must precede Tagline');
  assert.ok(idxTagline < idxBadges, 'Tagline must precede Badges');
  assert.ok(idxBadges < idxPrice, 'Badges must precede Price');
  assert.ok(idxPrice < idxBuyActions, 'Price must precede Buy Actions');
  assert.ok(idxBuyActions < idxTrust, 'Buy Actions must precede Trust');
  assert.ok(idxTrust < idxScale, 'Trust must precede Spec Scale');

  // 8. Mobile navigation & sticky bar
  assert.ok(html.includes('class="gal-mobile-indicator"'), 'Must have mobile gallery indicator');
  assert.ok(html.includes('id="galDots"'), 'Must have gallery dots navigation');
  assert.ok(html.includes('id="galCur"'), 'Must have gallery counter');
  assert.ok(html.includes('class="mobile-bar" id="mobileBar"'), 'Must have sticky mobile bar');
  assert.ok(html.includes('id="mobileBarBuyBtn"'), 'Sticky mobile bar must have buy button');

  // 9. Claim discipline guardrails in product-hero area
  const heroSectionStart = html.indexOf('<div class="product-hero"');
  const heroSectionEnd = html.indexOf('</section>', heroSectionStart);
  const heroSection = html.slice(heroSectionStart, heroSectionEnd);
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(heroSection), false, 'Hero section must not contain prohibited claims');
});

test('odorstrike.html PDP gallery information hierarchy, asset order, accessibility, and performance', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. Gallery stack container
  const galStart = html.indexOf('<div class="gallery-stack" id="gallery"');
  assert.ok(galStart !== -1, 'Must have <div class="gallery-stack" id="gallery">');
  const galEnd = html.indexOf('<!-- Mobile Gallery Slide Indicator -->', galStart);
  const galHtml = html.slice(galStart, galEnd);

  // 2. Exact 8-tile information hierarchy:
  // Tile 1: Product hero / bottle
  // Tile 2: Pocket size / portability & scale
  // Tile 3: 3-step fabric application
  // Tile 4: Zero residue / dark fabric proof
  // Tile 5: Fabric-only guideline (not skin)
  // Tile 6: Trapped garment odor problem
  // Tile 7: Science & molecular neutralizer
  // Tile 8: Product comparison vs deo & perfume
  const expectedOrder = [
    'pdp-01-hero.webp',
    'pdp-04-pocket-size.webp',
    'pdp-03-how-to-use.webp',
    'pdp-05-proof.webp',
    'pdp-07-fabric-only.webp',
    'pdp-02-problem.webp',
    'pdp-06-science.webp',
    'pdp-08-comparison.webp'
  ];

  let lastIndex = -1;
  expectedOrder.forEach((asset, idx) => {
    const pos = galHtml.indexOf(asset);
    assert.ok(pos !== -1, `Gallery must include ${asset}`);
    assert.ok(pos > lastIndex, `Asset ${asset} (position ${idx + 1}) must appear after previous asset in sequence`);
    lastIndex = pos;
  });

  // 3. Performance & LCP discipline:
  // Tile 1 must be preloaded in <head>, fetchpriority="high", decoding="async", no loading="lazy"
  assert.ok(html.includes('href="/assets/pdp-01-hero.webp"'), 'Tile 1 must be referenced in head preload');
  assert.ok(html.includes('<link rel="preload" as="image" type="image/webp"\n      href="/assets/pdp-01-hero.webp"'), 'Tile 1 must be preloaded in head');
  const heroImgTag = galHtml.slice(galHtml.indexOf('<img src="/assets/pdp-01-hero.webp"'), galHtml.indexOf('</button>', galHtml.indexOf('pdp-01-hero.webp')));
  assert.ok(heroImgTag.includes('fetchpriority="high"'), 'Tile 1 must have fetchpriority="high"');
  assert.ok(!heroImgTag.includes('loading="lazy"'), 'Tile 1 LCP image must not be lazy loaded');

  // Tiles 2-8 must have loading="lazy" and decoding="async"
  for (let i = 1; i < expectedOrder.length; i++) {
    const asset = expectedOrder[i];
    const imgStart = galHtml.indexOf(`<img src="/assets/${asset}"`);
    const imgTag = galHtml.slice(imgStart, galHtml.indexOf('>', imgStart));
    assert.ok(imgTag.includes('loading="lazy"'), `Asset ${asset} must have loading="lazy"`);
    assert.ok(imgTag.includes('decoding="async"'), `Asset ${asset} must have decoding="async"`);
  }

  // 4. Accessibility: zoom buttons with descriptive aria-label
  assert.ok(galHtml.includes('aria-label="Enlarge image 1 of 8: ODORSTRIKE 50ml bottle"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 2 of 8: Pocket size and portability"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 3 of 8: Three-step application on fabric"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 4 of 8: Fabric test showing zero residue and no white marks"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 5 of 8: Fabric only usage guidance"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 6 of 8: Why clothes trap odor"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 7 of 8: Molecular odor trap and neutralization science"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 8 of 8: ODORSTRIKE compared with deodorant and perfume"'));

  // 5. Alt text non-repetitive & descriptive
  const altMatches = [...galHtml.matchAll(/alt="([^"]+)"/g)].map(m => m[1]);
  assert.equal(altMatches.length, 8, 'Must have exactly 8 alt text entries');
  const uniqueAlts = new Set(altMatches);
  assert.equal(uniqueAlts.size, 8, 'All 8 alt texts must be uniquely descriptive');

  // 6. Mobile indicator dots and counter
  assert.ok(html.includes('id="galDots" role="tablist"'), 'Mobile indicator must have tablist role');
  assert.ok(html.includes('class="gal-dot active" role="tab" aria-selected="true" aria-current="true"'), 'First dot must be active and selected');
  assert.ok(html.includes('<span id="galCur">1</span> / 8'), 'Counter must display 1 / 8');

  // 7. Full-screen zoom viewer modal exists and is accessible
  assert.ok(html.includes('id="galViewer" role="dialog" aria-modal="true"'), 'Must have accessible gallery modal dialog');
  assert.ok(html.includes('class="gal-viewer-close" type="button" aria-label="Close image"'), 'Modal must have accessible close button');

  // 8. Strict claim discipline across gallery markup
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(galHtml), false, 'Gallery markup must not contain prohibited claims');
});

test('odorstrike.html PDP How to Use section UX hierarchy, canonical values, timer hookup, and HowTo schema parity', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. Container and section header
  const reset30Start = html.indexOf('id="reset30"');
  assert.ok(reset30Start > -1, 'Must contain #reset30 section');
  const reset30End = html.indexOf('</ol>', reset30Start) + 5;
  const reset30Html = html.slice(reset30Start, reset30End);

  assert.ok(reset30Html.includes('class="section-tag">How to use · Fabric only</div>'), 'Must have fabric-only section tag');
  assert.ok(reset30Html.includes('Hold. Spray. Wait. Wear.'), 'Must state concise 4-step heading');
  assert.ok(reset30Html.includes('class="htu-sub"'), 'Must have subtitle with fabric-only clarity');

  // 2. 4-step sequence inside ordered list <ol class="r30-steps">
  assert.ok(reset30Html.includes('<ol class="r30-steps">'), 'Must use semantic <ol class="r30-steps">');
  const stepMatches = [...reset30Html.matchAll(/<li class="r30-step/g)];
  assert.equal(stepMatches.length, 4, 'Must have exactly 4 sequential steps');

  // 3. Step 1: HOLD with 15–20 cm
  assert.ok(reset30Html.includes('01 · HOLD'), 'Step 1 must have action label HOLD');
  assert.ok(reset30Html.includes('15–20 cm away'), 'Step 1 must specify canonical 15–20 cm distance');
  assert.ok(reset30Html.includes('Keep the bottle about 15–20 cm from the fabric'), 'Step 1 body must instruct holding 15–20 cm from fabric');

  // 4. Step 2: SPRAY with 2–3 light sprays, fabric zones, and not for skin
  assert.ok(reset30Html.includes('02 · SPRAY'), 'Step 2 must have action label SPRAY');
  assert.ok(reset30Html.includes('2–3 light sprays'), 'Step 2 must specify canonical 2–3 light sprays');
  assert.ok(reset30Html.includes('collar, underarm fabric, or chest'), 'Step 2 must identify key garment zones');
  assert.ok(reset30Html.includes('Not for skin') || reset30Html.includes('never on skin'), 'Step 2 must reinforce fabric only / not for skin');

  // 5. Step 3: WAIT with ~10 seconds and timer ring
  assert.ok(reset30Html.includes('03 · WAIT'), 'Step 3 must have action label WAIT');
  assert.ok(reset30Html.includes('class="r30-step r30-step--timer"'), 'Step 3 must carry .r30-step--timer class for JS observer');
  assert.ok(reset30Html.includes('class="r30-ring"'), 'Step 3 must contain .r30-ring element');
  assert.ok(reset30Html.includes('class="r30-ring-num">10</span>'), 'Step 3 must contain .r30-ring-num displaying 10');
  assert.ok(reset30Html.includes('Wait ~10 seconds'), 'Step 3 heading must indicate ~10 seconds wait');
  assert.ok(reset30Html.includes('zero residue and no white marks'), 'Step 3 must note clean evaporation with no marks');

  // 6. Step 4: WEAR with up to 8 hours odor protection
  assert.ok(reset30Html.includes('04 · WEAR'), 'Step 4 must have action label WEAR');
  assert.ok(reset30Html.includes('Wear normally'), 'Step 4 heading must indicate wearing normally');
  assert.ok(reset30Html.includes('up to 8 hours of fabric odor protection'), 'Step 4 must cite canonical up to 8 hours protection');

  // 7. Timer JS hookup
  assert.ok(html.includes("var block = document.getElementById('reset30');"), 'JS must find #reset30');
  assert.ok(html.includes("block.querySelector('.r30-step--timer')"), 'JS must target .r30-step--timer');
  assert.ok(html.includes("block.querySelector('.r30-ring')"), 'JS must target .r30-ring');
  assert.ok(html.includes("block.querySelector('.r30-ring-num')"), 'JS must target .r30-ring-num');

  // 8. JSON-LD HowTo Schema parity
  const howToStart = html.indexOf('"@type": "HowTo"');
  assert.ok(howToStart > -1, 'Must contain JSON-LD HowTo schema');
  const scriptStart = html.lastIndexOf('<script', howToStart);
  const jsonStart = html.indexOf('{', scriptStart);
  const howToEnd = html.indexOf('</script>', howToStart);
  const howToScript = html.slice(jsonStart, howToEnd).trim();
  const howToObj = JSON.parse(howToScript);
  assert.equal(howToObj['@type'], 'HowTo');
  assert.equal(howToObj.step.length, 4, 'HowTo schema must define exactly 4 steps');
  assert.equal(howToObj.step[0].name, 'Hold 15–20 cm away');
  assert.equal(howToObj.step[1].name, 'Apply 2–3 light sprays');
  assert.equal(howToObj.step[2].name, 'Wait approximately 10 seconds');
  assert.equal(howToObj.step[3].name, 'Wear normally');

  // 9. Strict claim discipline in How-to section and schema
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(reset30Html), false, 'How to use HTML must not contain prohibited claims');
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(howToScript), false, 'How to use schema must not contain prohibited claims');
});

test('odorstrike.html PDP FAQ objection-first hierarchy, schema parity, and claims discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. Exactly one FAQPage JSON-LD block
  const faqPageMatches = html.match(/"@type"\s*:\s*"FAQPage"/g) || [];
  assert.equal(faqPageMatches.length, 1, 'odorstrike.html must have exactly one FAQPage schema block');

  // 2. Extract FAQPage JSON-LD
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  let faqSchema = null;
  for (const block of scriptMatch) {
    if (block.includes('"FAQPage"')) {
      const jsonText = block.replace(/<script type="application\/ld\+json">|<\/script>/g, '').trim();
      faqSchema = JSON.parse(jsonText);
      break;
    }
  }
  assert.ok(faqSchema, 'Must parse FAQPage schema');
  assert.equal(faqSchema.mainEntity.length, 10, 'FAQPage schema must contain exactly 10 questions');

  // 3. Extract visible FAQ items from <section class="faq"
  const faqSectionStart = html.indexOf('<section class="faq"');
  assert.ok(faqSectionStart !== -1, 'Must have <section class="faq"');
  const faqSectionEnd = html.indexOf('</section>', faqSectionStart);
  const faqSection = html.slice(faqSectionStart, faqSectionEnd);

  // 4. Extract visible questions and answers
  const qMatches = [...faqSection.matchAll(/<summary><h3>([\s\S]*?)<\/h3><\/summary>/g)].map(m => m[1].trim());
  const aMatches = [...faqSection.matchAll(/<p class="faq-answer">([\s\S]*?)<\/p>/g)].map(m => m[1].trim());

  assert.equal(qMatches.length, 10, 'Must have exactly 10 visible FAQ questions');
  assert.equal(aMatches.length, 10, 'Must have exactly 10 visible FAQ answers');

  // 5. Expected 10 objection questions in order
  const expectedQuestions = [
    'Is ODORSTRIKE safe on skin?',
    'Will it stain my clothes?',
    'How do I use it?',
    'What fabrics can I use it on?',
    'How long does the effect last?',
    'Does it replace washing?',
    'Is the fragrance strong?',
    'Is COD available?',
    'How long does shipping take?',
    'What is the return policy?'
  ];

  for (let i = 0; i < expectedQuestions.length; i++) {
    assert.equal(qMatches[i], expectedQuestions[i], `Question ${i + 1} must match expected objection: ${expectedQuestions[i]}`);
    assert.equal(faqSchema.mainEntity[i].name, expectedQuestions[i], `Schema question ${i + 1} name must match expected question`);
    assert.equal(aMatches[i], faqSchema.mainEntity[i].acceptedAnswer.text, `Answer ${i + 1} in HTML must match schema text 1:1`);
  }

  // 6. Claim discipline guardrails in FAQ section and schema
  const prohibitedPattern = /kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof|kills the smell/i;
  assert.equal(prohibitedPattern.test(faqSection), false, 'FAQ HTML must not contain prohibited claims');
  assert.equal(prohibitedPattern.test(JSON.stringify(faqSchema)), false, 'FAQ schema must not contain prohibited claims');
  assert.equal(/fragrance-free|unscented|scentless/i.test(faqSection), false, 'FAQ must not claim fragrance-free');
  assert.equal(/2–3 months|month-based/i.test(faqSection), false, 'FAQ must not encode month-based bottle life');

  // 7. Commercial values match canonical configuration
  assert.ok(faqSection.includes('₹229'), 'FAQ must state ₹229 prepaid price');
  assert.ok(faqSection.includes('₹60'), 'FAQ must state ₹60 COD fee');
  assert.ok(faqSection.includes('₹289'), 'FAQ must state ₹289 COD total');
  assert.ok(faqSection.includes('7-day return window'), 'FAQ must state 7-day return window');
  assert.ok(faqSection.includes('80% full'), 'FAQ must state 80% full condition');
  assert.ok(faqSection.includes('48 hours'), 'FAQ must state 48-hour dispatch');
  assert.ok(faqSection.includes('3–5 business days'), 'FAQ must state 3–5 days metro delivery');

  // 8. Safety and usage guardrails
  assert.ok(faqSection.includes('never skin, face, hair, or body'), 'FAQ must strictly prohibit skin, face, hair, or body application');
  assert.ok(faqSection.includes('zero residue'), 'FAQ must state zero residue');
  assert.ok(faqSection.includes('15–20 cm'), 'FAQ must state 15–20 cm spray distance');
  assert.ok(faqSection.includes('approximately 10 seconds'), 'FAQ must state approximately 10 seconds dry time');
  assert.ok(faqSection.includes('Up to 8 hours'), 'FAQ must state Up to 8 hours duration');
});






