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
  assert.equal(PRODUCT.codFee, 89);
  assert.equal(PRODUCT.size, '50ml');
  assert.equal(PRODUCT.spraysApprox, 250);
  assert.equal(PRODUCT.sku, 'OS-001-50ML');
  assert.equal(BRAND.name, 'Smelloff');
  assert.equal(BRAND.slogan, 'Traps and neutralizes clothing odor molecules on fabric');
  assert.equal(/smell[-\s]proof|odor[-\s]proof|zero\s+smell|always\b/i.test(BRAND.slogan), false, 'Brand slogan must not contain absolute claims');
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
  assert.equal(c1.codFee, 89);
  assert.equal(c1.total, 318);
  assert.equal(c1.totalPaise, 31800);

  // 2 units prepaid
  const p2 = calculateOrderTotal(2, 'prepaid');
  assert.equal(p2.subtotal, 419);
  assert.equal(p2.shipping, 0);
  assert.equal(p2.codFee, 0);
  assert.equal(p2.total, 419);
  assert.equal(p2.totalPaise, 41900);

  // 2 units COD
  const c2 = calculateOrderTotal(2, 'cod');
  assert.equal(c2.subtotal, 419);
  assert.equal(c2.codFee, 89);
  assert.equal(c2.total, 508);
  assert.equal(c2.totalPaise, 50800);

  // 3 units: one pair + one bottle
  assert.equal(calculateOrderTotal(3, 'prepaid').subtotal, 648);
  assert.equal(calculateOrderTotal(4, 'prepaid').subtotal, 838);
});

test('shared/product-truth.js is synchronized with product.json', () => {
  assert.equal(SMELLOFF_PRODUCT_TRUTH.pricePrepaid, 229);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.mrp, 499);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.codFee, 89);
  assert.equal(SMELLOFF_PRODUCT_TRUTH.size, '50ml');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.formulaVersion, 'v3.1');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.sku, 'OS-001-50ML');
  assert.equal(SMELLOFF_PRODUCT_TRUTH.brand, 'Smelloff');
});

test('shared/products-config.js BASE_PRODUCT is synchronized with product.json', () => {
  assert.equal(BASE_PRODUCT.price, 229);
  assert.equal(BASE_PRODUCT.mrp, 499);
  assert.equal(BASE_PRODUCT.codFee, 89);
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

  // Canonical product description checks
  const desc = PRODUCT_CONFIG.product.description.toLowerCase();
  assert.equal(desc.includes('kills'), false, 'Canonical description must not contain "kills"');
  assert.equal(desc.includes('in seconds'), false, 'Canonical description must not promise "in seconds"');
  assert.equal(desc.includes('stink in seconds'), false, 'Canonical description must not contain "stink in seconds"');
  assert.equal(desc.includes('permanent'), false, 'Canonical description must not promise "permanent"');
  assert.equal(desc.includes('miracle'), false, 'Canonical description must not claim "miracle"');
  assert.equal(desc.includes('100%'), false, 'Canonical description must not claim "100%"');
  assert.equal(desc.includes('antibacterial'), false, 'Canonical description must not claim "antibacterial"');

  // Surface consistency checks
  const emailTemplatesCode = readFileSync('api/_email-templates.js', 'utf8');
  assert.equal(/odor killer/i.test(emailTemplatesCode), false, '_email-templates.js must not contain "odor killer"');
  assert.equal(/kills odor/i.test(emailTemplatesCode), false, '_email-templates.js must not contain "kills odor"');

  const odorstrikeHtml = readFileSync('odorstrike.html', 'utf8');
  assert.equal(odorstrikeHtml.includes('10% off'), false, 'odorstrike.html must not contain fake 10% off discount');
  assert.equal(odorstrikeHtml.includes('Spray, shake'), false, 'odorstrike.html must not instruct users to shake');
  assert.equal(odorstrikeHtml.includes('towels, bedsheets'), false, 'odorstrike.html must not recommend household linens');
});

test('supabase/functions/create-order/index.ts derives from product.json without independent hardcodes', () => {
  const code = readFileSync('supabase/functions/create-order/index.ts', 'utf8');
  assert.ok(code.includes('config/product.json'));
  assert.ok(code.includes('UNIT_PRICE_RUPEES = productConfig.product.price'));
  assert.ok(code.includes('COD_FEE_RUPEES = productConfig.product.codFee'));
  assert.ok(code.includes('MAX_QTY = productConfig.product.maxQuantity'));
  assert.equal(code.includes('UNIT_PRICE_RUPEES = 229'), false);
  assert.equal(code.includes('COD_FEE_RUPEES = 89'), false);
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

// Homepage rebuilt 2026-10-10 as a conversion page (dudewipes-style: few
// sections, one claim each, a buy CTA under every one). These tests pin the
// guardrails rather than the old section-by-section copy.
test('index.html homepage hero: one H1, fabric positioning, price and COD disclosed before checkout', () => {
  const html = readFileSync('index.html', 'utf8');
  const h1 = [...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gis)];
  assert.equal(h1.length, 1, 'Homepage must contain exactly one <h1>');
  assert.ok(h1[0][1].includes('Your shirt smells') && h1[0][1].includes('Fix it.'), 'H1 must be "Your shirt smells. Fix it."');

  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('</section>', html.indexOf('<section class="hero"')));
  assert.ok(hero.includes('FABRIC ODOR CONTROL · FOR CLOTHES'));
  assert.ok(hero.includes('ODORSTRIKE neutralizes odor trapped in your clothes — not on your skin.'));
  for (const tag of ['Not perfume', 'Not body deodorant', 'Fabric only']) assert.ok(hero.includes(tag), `Hero must say ${tag}`);
  assert.ok(hero.includes('<b>₹229</b>'), 'Hero must show ₹229');
  assert.ok(hero.includes('M.R.P. ₹499') && hero.includes('54% OFF'), 'MRP and discount must agree with the PDP');
  assert.ok(hero.includes('Buy now — ₹229') && hero.includes('href="/odorstrike?buy=1"'), 'Primary CTA must open checkout');
  // Owner's call (2026-10-11): outside checkout, say COD exists; the amount is on the COD option in checkout.
  assert.ok(hero.includes('Cash on Delivery') && !/₹\s*(89|318)\b/.test(hero), 'Hero names COD availability without the COD amount');
  assert.ok(hero.includes('2–3 sprays') && hero.includes('15–30 sec'), 'Usage microcopy must match the PDP');
  assert.ok(hero.includes('/assets/photos/hero-spray-collar'), 'Hero must show the product in use (the collar spray photo)');
});

test('index.html homepage: every section ends in a route to checkout', () => {
  const html = readFileSync('index.html', 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const ctas = main.match(/href="\/odorstrike\?buy=1"/g) || [];
  assert.ok(ctas.length >= 6, `expected a buy CTA in most sections, found ${ctas.length}`);
  for (const id of ['how', 'why', 'reviews', 'buy', 'faq']) assert.ok(main.includes(`id="${id}"`), `section #${id} must exist`);
  assert.ok(html.includes('id="homeMobileBar"') && html.includes('id="offerBuyBtn"'), 'sticky bar must track the hero and offer CTAs');
});

test('index.html homepage offer box: canonical price, COD, shipping, returns', () => {
  const html = readFileSync('index.html', 'utf8');
  const offer = html.slice(html.indexOf('id="buy"'), html.indexOf('</section>', html.indexOf('id="buy"')));
  assert.ok(offer.includes('<b>₹229</b>'));
  assert.ok(offer.includes('Cash on Delivery') && !/₹\s*(89|318)\b/.test(offer), 'Offer box names COD availability without the COD amount');
  assert.ok(offer.includes('Free shipping') && offer.includes('7-day returns'));
  assert.ok(offer.includes('Up to 8 hours') && offer.includes('on fabric'), 'Protection claim must stay the locked one');
});

test('index.html homepage reviews: beta-tester quotes only, verbatim, labelled', () => {
  const html = readFileSync('index.html', 'utf8');
  const rv = html.slice(html.indexOf('id="reviews"'), html.indexOf('</section>', html.indexOf('id="reviews"')));
  assert.equal((rv.match(/Beta tester/g) || []).length, 3, 'all three quotes must be labelled as beta testers');
  assert.ok(rv.includes('Nobody flinched.'));
  assert.ok(rv.includes('Lives in my gym bag now.'));
  assert.ok(rv.includes('Biryani jacket — fixed.'));
  assert.equal(/★|\d\.\d\s*\/\s*5|\d[\d,]*\+\s*(customers|reviews)/i.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))), false, 'no ratings or customer counts until real verified reviews exist');
});

// Homepage redesign (2026-10-15, docs/audits/homepage-conversion-2026-10.md):
// the placeholder combos are gone; the offer box sells the real "2 for ₹419".
test('index.html homepage pack picker: the two real packs at checkout prices, one bottle by default', () => {
  const html = readFileSync('index.html', 'utf8');
  const cfg = JSON.parse(readFileSync('config/product.json', 'utf8')).product;
  assert.equal(html.includes('id="combos"'), false, 'placeholder combos must not come back');
  const offer = html.slice(html.indexOf('id="buy"'), html.indexOf('</section>', html.indexOf('id="buy"')));
  const opts = [...offer.matchAll(/<input type="radio" name="pack" value="(\d)"( checked)?>/g)];
  assert.deepEqual(opts.map((m) => m[1]), ['1', '2']);
  assert.equal(opts.filter((m) => m[2]).map((m) => m[1]).join(), '1', 'one bottle is pre-selected; the buyer opts in to two');
  assert.ok(offer.includes(`<b>₹${cfg.price}</b>`) && offer.includes(`<b>₹${cfg.pairPrice}</b>`));
  assert.ok(offer.includes(`Save ₹${cfg.pairSaving}`) && offer.includes(`<s>₹${cfg.price * 2}</s>`), 'pair saving is against two single bottles');
  assert.match(html, /'2': \{ href: '\/odorstrike\?buy=1&qty=2', label: 'Buy 2 — ₹419' \}/);
  assert.ok(/\/odorstrike\?buy=1&amp;qty=2/.test(html.slice(html.indexOf('<section class="hero"'), html.indexOf('</section>', html.indexOf('<section class="hero"')))), 'hero names the pair offer');
  assert.equal(/Duo|Trio|₹399|₹549/.test(html), false, 'retired bundle prices never return');
});

test('odorstrike.html ?buy=1&qty=N opens checkout on N bottles', () => {
  const pdp = readFileSync('odorstrike.html', 'utf8');
  assert.match(pdp, /parseInt\(_q\.get\('qty'\), 10\)/);
  assert.match(pdp, /if \(_n >= 1 && _n <= _max\) \{ pdpQty = _n; renderPdpQty\(\); \}\s*buyNow\(/);
});

test('index.html homepage: moments, an honest comparison and the verified buyer', () => {
  const html = readFileSync('index.html', 'utf8');
  const sec = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
  assert.equal((sec('moments').match(/class="mo reveal"/g) || []).length, 6);
  const cmp = sec('compare');
  for (const col of ['ODORSTRIKE', 'Deodorant', 'Clothes perfume spray', 'Washing again']) assert.ok(cmp.includes(`>${col}</th>`), `compare column ${col}`);
  assert.ok(cmp.includes('No, wash for that'), 'the table admits ODORSTRIKE does not remove dirt or stains');
  assert.ok(cmp.includes('15–30 sec') && cmp.includes('dries clear') === false && cmp.includes('Dries clear with no stiff residue'));
  const rv = sec('reviews');
  assert.equal((rv.match(/Verified buyer/g) || []).length, 1, 'only the one review tied to an order is labelled verified');
  assert.ok(rv.includes('tbh this product is amazing'), 'verified review is quoted as written');
});

test('index.html homepage claims discipline and formula secrecy', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('Jogdhande Nikhil Patil'), 'founder must be named');
  for (const a of ['HPβCD', 'Zinc PCA', 'Triethyl Citrate', 'Zinc Gluconate']) assert.ok(html.includes(a), `${a} must be named`);
  assert.equal(/Zinc Ricinoleate|Sodium Bicarbonate/i.test(html), false, 'banned ingredients must not appear');
  assert.equal(/\d+(\.\d+)?\s*%\s*(w\/w|w\/v|HPβCD|Zinc)/i.test(html), false, 'no formula concentrations');
  assert.equal(/kills (odor|bacteria)|antibacterial|instantly|miracle|guaranteed|clinically/i.test(html), false, 'no prohibited claims');
  assert.equal(/\b(shoes?|sneakers?|helmets?|car seats?|sofas?|curtains?)\b/i.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))), false, 'clothing-only positioning');
  assert.equal(/"@type"\s*:\s*"FAQPage"/.test(html), false, 'no deprecated FAQPage schema');
  const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('</section>', html.indexOf('id="faq"')));
  assert.ok(faq.includes('Does it replace washing?') && faq.includes('does not remove dirt, oils or stains'), 'honest limits must be stated');
  assert.ok(faq.includes('never skin, face, hair or body'), 'fabric-only limit must be stated');
});

// PDP redesigned 2026-10-10. These pin guardrails — positioning, price,
// COD disclosure before checkout, the buy controls the JS drives, and claim
// discipline — rather than the old markup line by line.
test('odorstrike.html PDP hero and primary buy area: positioning, canonical pricing, COD disclosure, claims discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');
  const pInfoStart = html.indexOf('<div class="product-info">');
  assert.ok(pInfoStart !== -1, 'Must have <div class="product-info">');
  const pInfo = html.slice(pInfoStart, html.indexOf('<div id="heroProofMount">', pInfoStart));

  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'PDP must have exactly one <h1>');
  assert.ok(/<h1[^>]*>ODORSTRIKE <span class="pd-title__cat">[^<]*fabric odor spray for clothes<\/span><\/h1>/.test(pInfo), 'H1 must be the product name plus its category');
  assert.ok(pInfo.includes('FABRIC ODOR CONTROL · 50ML'), 'Eyebrow must declare fabric odor control');
  assert.ok(pInfo.includes('up to 8 hours'), 'Tagline must carry the locked protection claim');
  for (const tag of ['Not perfume', 'Not body deodorant', 'Fabric only']) assert.ok(pInfo.includes(tag), `Must say ${tag}`);

  assert.ok(pInfo.includes('<span class="pd-amt">₹229</span>'), 'Price must display ₹229');
  assert.ok(pInfo.includes('MRP ₹499') && pInfo.includes('54% OFF'), 'MRP and discount must agree');
  assert.ok(pInfo.includes('1 × 50ml bottle'), 'Pack size must be stated');
  assert.ok(pInfo.includes('Cash on Delivery') && !/₹\s*(89|318)\b/.test(pInfo), 'PDP hero names COD availability without the COD amount');

  for (const id of ['pdpQtyDec', 'pdpQtyVal', 'pdpQtyInc', 'pdpBuyBtn', 'pdpBuyText', 'pdpCartBtn']) assert.ok(pInfo.includes(`id="${id}"`), `#${id} must exist`);
  assert.ok(/id="pdpBuyBtn" onclick="buyNow\(\)"/.test(pInfo), 'Primary CTA must go straight to checkout');
  assert.ok(/id="pdpCartBtn" onclick="addToCart\(\)"/.test(pInfo), 'Secondary CTA must add to cart');
  assert.ok(pInfo.includes('Buy now — ₹229'), 'Initial buy text must match canonical price');
  assert.ok(pInfo.indexOf('class="pd-price"') < pInfo.indexOf('class="buy-actions"'), 'Price must precede the buy controls');
  for (const t of ['Free shipping', 'Cash on Delivery', '3–5 days', '7-day returns']) assert.ok(pInfo.includes(t), `Reassurance must include ${t}`);

  assert.ok(html.includes('class="mobile-bar" id="mobileBar"') && html.includes('id="mobileBarBuyBtn"'), 'Must have the sticky mobile bar');
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(pInfo), false, 'Hero must not contain prohibited claims');
});

test('odorstrike.html PDP gallery information hierarchy, asset order, accessibility, and performance', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. Gallery stack container
  const galStart = html.indexOf('<div class="gallery-stack" id="gallery"');
  assert.ok(galStart !== -1, 'Must have <div class="gallery-stack" id="gallery">');
  const galEnd = html.indexOf('<!-- Mobile Gallery Slide Indicator -->', galStart);
  const galHtml = html.slice(galStart, galEnd);

  // 2. Exact 5-tile information hierarchy (owner removed the how-to-use,
  // fabric-only and comparison creatives on 2026-10-11; the page says all
  // three in markup: #how, the fabric-only chips and #compare):
  // Tile 1: Product hero / bottle
  // Tile 2: Size in the hand, next to a phone
  // Tile 3: Dark fabric, just sprayed → dried clear
  // Tile 4: Trapped garment odor problem
  // Tile 5: Science & molecular neutralizer
  const expectedOrder = [
    'pdp-01-hero.webp',
    'pdp-04-in-hand.webp',
    'pdp-05-dried-clear.webp',
    'pdp-02-problem.webp',
    'pdp-06-science.webp'
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
  assert.ok(galHtml.includes('aria-label="Enlarge image 1 of 5: ODORSTRIKE 50ml bottle"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 2 of 5: Size in the hand, next to a phone"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 3 of 5: Black collar just sprayed, then dried clear"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 4 of 5: Why clothes trap odor"'));
  assert.ok(galHtml.includes('aria-label="Enlarge image 5 of 5: Molecular odor trap and neutralization science"'));
  for (const gone of ['pdp-03-how-to-use', 'pdp-07-fabric-only', 'pdp-08-comparison']) {
    assert.ok(!html.includes(gone), `${gone} was removed from the PDP (owner, 2026-10-11)`);
  }

  // 5. Alt text non-repetitive & descriptive
  const altMatches = [...galHtml.matchAll(/alt="([^"]+)"/g)].map(m => m[1]);
  assert.equal(altMatches.length, 5, 'Must have exactly 5 alt text entries');
  const uniqueAlts = new Set(altMatches);
  assert.equal(uniqueAlts.size, 5, 'All 5 alt texts must be uniquely descriptive');

  // 6. Mobile indicator dots and counter
  assert.ok(html.includes('id="galDots" role="tablist"'), 'Mobile indicator must have tablist role');
  assert.ok(html.includes('class="gal-dot active" role="tab" aria-selected="true" aria-current="true"'), 'First dot must be active and selected');
  assert.ok(html.includes('<span id="galCur">1</span> / 5'), 'Counter must display 1 / 5');

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
  assert.ok(reset30Html.includes('htu-sub') && reset30Html.includes('never spray directly onto skin'), 'Must have subtitle with fabric-only clarity');

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

  // 5. Step 3: WAIT with 15–30 seconds and timer ring
  assert.ok(reset30Html.includes('03 · WAIT'), 'Step 3 must have action label WAIT');
  assert.ok(reset30Html.includes('class="r30-step r30-step--timer"'), 'Step 3 must carry .r30-step--timer class for JS observer');
  assert.ok(reset30Html.includes('class="r30-ring"'), 'Step 3 must contain .r30-ring element');
  assert.ok(reset30Html.includes('class="r30-ring-num">30</span>'), 'Step 3 must contain .r30-ring-num displaying 30');
  assert.ok(reset30Html.includes('Wait 15–30 seconds'), 'Step 3 heading must indicate 15–30 seconds wait');
  assert.ok(reset30Html.includes('no stiff residue') || reset30Html.includes('zero residue'), 'Step 3 must note clean evaporation with no marks');

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
  assert.equal(howToObj.step[2].name, 'Wait 15–30 seconds');
  assert.equal(howToObj.step[3].name, 'Wear normally');

  // 9. Strict claim discipline in How-to section and schema
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(reset30Html), false, 'How to use HTML must not contain prohibited claims');
  assert.equal(/kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof/i.test(howToScript), false, 'How to use schema must not contain prohibited claims');
});

test('odorstrike.html PDP FAQ objection-first hierarchy, schema deprecation, and claims discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. FAQPage JSON-LD block must be deprecated/removed to prevent search penalty
  const faqPageMatches = html.match(/"@type"\s*:\s*"FAQPage"/g) || [];
  assert.equal(faqPageMatches.length, 0, 'odorstrike.html must have 0 FAQPage schema blocks (deprecated)');

  // 2. Extract visible FAQ items from <section class="faq"
  const faqSectionStart = html.indexOf('<section class="faq"');
  assert.ok(faqSectionStart !== -1, 'Must have <section class="faq"');
  const faqSectionEnd = html.indexOf('</section>', faqSectionStart);
  const faqSection = html.slice(faqSectionStart, faqSectionEnd);

  // 3. Extract visible questions and answers
  const qMatches = [...faqSection.matchAll(/<summary><h3>([\s\S]*?)<\/h3><\/summary>/g)].map(m => m[1].trim());
  const aMatches = [...faqSection.matchAll(/<p class="faq-answer">([\s\S]*?)<\/p>/g)].map(m => m[1].trim());

  assert.equal(qMatches.length, 11, 'Must have exactly 11 visible FAQ questions');
  assert.equal(aMatches.length, 11, 'Must have exactly 11 visible FAQ answers');

  // 4. The definition first (the passage answer engines quote), then the objections in order
  const expectedQuestions = [
    'What is ODORSTRIKE?',
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
    assert.ok(aMatches[i].length > 20, `Answer ${i + 1} in HTML must have non-empty substantive answer text`);
  }

  // 5. Claim discipline guardrails in FAQ section
  const prohibitedPattern = /kills bacteria|antimicrobial|antibacterial|miracle|100% effective|clinically tested|dermatologist tested|permanent|instant |instantly |odor-proof|kills the smell/i;
  assert.equal(prohibitedPattern.test(faqSection), false, 'FAQ HTML must not contain prohibited claims');
  assert.equal(/fragrance-free|unscented|scentless/i.test(faqSection), false, 'FAQ must not claim fragrance-free');
  assert.equal(/2–3 months|month-based/i.test(faqSection), false, 'FAQ must not encode month-based bottle life');

  // 6. Commercial values match canonical configuration
  assert.ok(faqSection.includes('₹229'), 'FAQ must state ₹229 prepaid price');
  assert.ok(/Cash on Delivery is available/.test(faqSection) && !/₹\s*(89|318)\b/.test(faqSection), 'PDP FAQ names COD; the amount lives on the COD option in checkout and on /faq');
  assert.ok(faqSection.includes('7-day return window'), 'FAQ must state 7-day return window');
  assert.ok(faqSection.includes('80% full'), 'FAQ must state 80% full condition');
  assert.ok(faqSection.includes('48 hours'), 'FAQ must state 48-hour dispatch');
  assert.ok(faqSection.includes('3–5 business days'), 'FAQ must state 3–5 days metro delivery');

  // 8. Safety and usage guardrails
  assert.ok(faqSection.includes('never skin, face, hair, or body'), 'FAQ must strictly prohibit skin, face, hair, or body application');
  assert.ok(faqSection.includes('no powdery residue') || faqSection.includes('zero residue'), 'FAQ must state clean residue profile');
  assert.ok(faqSection.includes('15–20 cm'), 'FAQ must state 15–20 cm spray distance');
  assert.ok(faqSection.includes('15–30 seconds'), 'FAQ must state 15–30 seconds dry time');
  assert.ok(faqSection.includes('Up to 8 hours'), 'FAQ must state Up to 8 hours duration');
});

test('odorstrike.html PDP buy box (#buy): showcaseBuyBtn → buyNow(), canonical price and COD, claims discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');
  const start = html.indexOf('<section class="pd-sec pricing" id="buy"');
  assert.ok(start !== -1, 'Must have the #buy section');
  const box = html.slice(start, html.indexOf('</section>', start));

  assert.ok(/<button[^>]+class="pd-btn" id="showcaseBuyBtn" onclick="buyNow\(\)">Buy now — ₹229<\/button>/.test(box), '#showcaseBuyBtn must be a button calling buyNow() with the canonical price');
  assert.ok(html.includes("document.getElementById('showcaseBuyBtn')"), 'renderPdpQty must synchronize showcaseBuyBtn');
  assert.ok(box.includes('₹229') && box.includes('₹499') && box.includes('54% OFF'), 'Price, MRP and discount must be shown');
  assert.ok(box.includes('Cash on Delivery') && !/₹\s*(89|318)\b/.test(box), 'Buy box names COD availability without the COD amount');
  assert.ok(box.includes('class="pay-modes"') && box.includes('Cash on Delivery'), '.pay-modes must name COD');
  assert.ok(box.includes('Free shipping') && box.includes('7-day returns'), 'Shipping and returns must be stated');
  assert.ok(box.includes('~250 sprays') && box.includes('refreshes'), 'Must cite canonical sprays/refreshes');
  assert.ok(box.includes('id="buyProofMount"'), 'Gated proof mount must stay');
  for (const term of ['kills', 'destroy', 'instant', 'permanent', 'guaranteed', 'miracle', 'odor-proof', 'bacteria', '100%']) {
    assert.equal(new RegExp(term, 'i').test(box), false, `Buy box must not contain: ${term}`);
  }
  assert.equal(/month|weeks/i.test(box), false, 'No month-based bottle life');

  // "Why it works" keeps the approved wording.
  const why = html.slice(html.indexOf('id="why"'), html.indexOf('</section>', html.indexOf('id="why"')));
  assert.ok(why.includes("Neutralizes odor — doesn't hide it"), 'Must use approved "Neutralizes odor — doesn\'t hide it"');
  assert.equal(/kills odor|antibacterial|instantly/i.test(why), false, 'No prohibited claims in #why');
});

test('pages give a route to the product page that does not open checkout', () => {
  const home = readFileSync('index.html', 'utf8');
  const main = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
  const pdpLinks = main.match(/href="\/odorstrike"/g) || [];
  assert.ok(pdpLinks.length >= 4, `homepage needs plain /odorstrike links beside the buy CTAs, found ${pdpLinks.length}`);
  const hero = home.slice(home.indexOf('<section class="hero"'), home.indexOf('</section>', home.indexOf('<section class="hero"')));
  assert.ok(/class="hm-link hero-more" href="\/odorstrike"/.test(hero), 'hero must offer a route to the product page next to buy (a text link: one primary action)');
  const pdp = readFileSync('odorstrike.html', 'utf8');
  assert.equal(/\.pay-modes'\)/.test(readFileSync('assets/js/chrome.js', 'utf8')), false, 'chrome.js must not overwrite the PDP COD disclosure');
  for (const id of new Set([...pdp.matchAll(/<use href="#(i-[a-z-]+)"/g)].map(m => m[1]))) assert.ok(pdp.includes(`<symbol id="${id}"`), `icon ${id} must exist in the sprite`);
});

test('odorstrike.html mobile sticky buy bar (#mobileBar) price synchronization, unified CTA observer, and regression checks', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. #mobileBar exists with proper semantic markup
  assert.ok(html.includes('id="mobileBar"'), 'Must have #mobileBar');
  const barMatch = html.match(/<div[^>]+id="mobileBar"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(barMatch, 'Must locate #mobileBar element in markup');
  const barContent = barMatch[1];

  // 2. #mobileBarLabel exists with stable ID, polite aria-live, and canonical default
  assert.ok(html.includes('id="mobileBarLabel"'), 'Must have stable id="mobileBarLabel"');
  assert.ok(/<span[^>]+id="mobileBarLabel"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*>[\s\S]*?ODORSTRIKE 50ml · ₹229[\s\S]*?<\/span>/.test(barContent),
    '#mobileBarLabel must declare aria-live="polite", aria-atomic="true", and initial canonical label');

  // 3. #mobileBarBuyBtn exists, calls buyNow(), has 44px+ touch target, and accessible description
  assert.ok(html.includes('id="mobileBarBuyBtn"'), 'Must have id="mobileBarBuyBtn"');
  assert.ok(/<button[^>]+id="mobileBarBuyBtn"[^>]*onclick="buyNow\(\)"[^>]*aria-describedby="mobileBarLabel"[^>]*>Buy now<\/button>/.test(barContent) ||
            /<button[^>]+onclick="buyNow\(\)"[^>]*id="mobileBarBuyBtn"[^>]*aria-describedby="mobileBarLabel"[^>]*>Buy now<\/button>/.test(barContent),
    '#mobileBarBuyBtn must invoke buyNow() and associate with #mobileBarLabel via aria-describedby');

  // 4. renderPdpQty synchronizes mobileBarLabel dynamically
  assert.ok(html.includes("document.getElementById('mobileBarLabel')"), 'renderPdpQty must update mobileBarLabel');

  // Verify synchronization formula in renderPdpQty
  const unit = PRODUCT.price; // 229
  const pair = PRODUCT.pairPrice; // 419
  function deriveMobileBarLabel(qty) {
    const subtotal = Math.floor(qty / 2) * pair + (qty % 2) * unit;
    return (qty > 1 ? (qty + ' × ') : '') + 'ODORSTRIKE 50ml · ₹' + subtotal;
  }

  // Check state calculations for Qty 1, 2, 3, and max configured quantity
  assert.equal(deriveMobileBarLabel(1), 'ODORSTRIKE 50ml · ₹229', 'Quantity 1 produces canonical single unit subtotal');
  assert.equal(deriveMobileBarLabel(2), '2 × ODORSTRIKE 50ml · ₹419', 'Quantity 2 is the pair price');
  assert.equal(deriveMobileBarLabel(3), '3 × ODORSTRIKE 50ml · ₹648', 'Quantity 3 is a pair plus one bottle');
  const maxQ = PRODUCT.maxQuantity || 10;
  assert.equal(deriveMobileBarLabel(maxQ), '10 × ODORSTRIKE 50ml · ₹2095', 'Max quantity is five pairs');

  // 5. No hardcoded separate price constants in mobile bar logic
  assert.equal(/ODORSTRIKE 50ml · ₹419/i.test(html), false, 'Must not hardcode secondary quantity prices as string literals');
  assert.equal(/ODORSTRIKE 50ml · ₹648/i.test(html), false, 'Must not hardcode tertiary quantity prices as string literals');

  // 6. Unified IntersectionObserver for all actionable purchase CTAs
  const obsStart = html.indexOf('// Mobile sticky bar — visible whenever no other buy control is on screen');
  assert.ok(obsStart !== -1, 'Must locate mobile bar observer script block');
  const obsEnd = html.indexOf('window._updateMobileBar = update;', obsStart);
  const obsBlock = html.slice(obsStart, html.indexOf('})();', obsEnd) + 5);

  // Must observe:
  // - hero .buy-actions
  // - #showcaseBuyBtn
  // - #buy pricing section
  // - final CTA button (.final button or .final)
  assert.ok(obsBlock.includes('.buy-actions'), 'Observer must track hero .buy-actions');
  assert.ok(obsBlock.includes('showcaseBuyBtn'), 'Observer must track #showcaseBuyBtn');
  assert.ok(obsBlock.includes("getElementById('buy')") || obsBlock.includes("'buy'"), 'Observer must track #buy pricing section');
  assert.ok(obsBlock.includes('.final'), 'Observer must track section.final purchase button');

  // 7. Exactly ONE IntersectionObserver instance in mobile-bar logic (no duplicate observers)
  const ioMatches = obsBlock.match(/new\s+IntersectionObserver/g);
  assert.equal(ioMatches ? ioMatches.length : 0, 1, 'Mobile bar must instantiate exactly one IntersectionObserver');

  // 8. Sensible threshold to prevent flickering
  assert.ok(obsBlock.includes('threshold: 0.1') || obsBlock.includes('threshold: [0, 0.1]'), 'Observer must use a sensible threshold');

  // 9. Checkout overlay integration
  assert.ok(html.includes("var mb = document.getElementById('mobileBar');\n    if (mb) mb.style.display = 'none';"), 'openCheckout must hide mobileBar');
  assert.ok(html.includes("var mb = document.getElementById('mobileBar');\n    if (mb) mb.style.display = '';"), 'closeCheckout must restore mobileBar display');
  assert.ok(html.includes("if (typeof window._updateMobileBar === 'function') window._updateMobileBar();"), 'closeCheckout must trigger _updateMobileBar()');

  // 10. Styling & accessibility rules
  assert.ok(html.includes('.mobile-bar .mb-btn:focus-visible'), 'Must have visible focus styling for mobile bar button');
  assert.ok(html.includes('min-height:44px') || html.includes('min-height: 44px'), 'Mobile bar button must maintain 44px+ touch target');
  assert.ok(html.includes('white-space:nowrap') || html.includes('white-space: nowrap'), 'Mobile bar button must prevent truncation/awkward wrapping');
});

test('odorstrike.html final purchase CTA (section.final) structure, canonical price sync, buyNow integration, reassurance, and claim discipline', () => {
  const html = readFileSync('odorstrike.html', 'utf8');

  // 1. Final CTA exists and has section.final with semantic structure
  assert.ok(html.includes('<section class="final"'), 'Must have section.final container');
  const finalStart = html.indexOf('<section class="final"');
  assert.ok(finalStart !== -1, 'Must find <section class="final"');
  const finalEnd = html.indexOf('</section>', finalStart);
  assert.ok(finalEnd !== -1, 'Must find closing </section> for final CTA');
  const finalBlock = html.slice(finalStart, finalEnd + 10);

  // 2. Final CTA button exists, has id="finalBuyBtn", invokes buyNow()
  assert.ok(finalBlock.includes('id="finalBuyBtn"'), 'Must have id="finalBuyBtn"');
  assert.ok(finalBlock.includes('onclick="buyNow()"'), 'Final CTA button must invoke buyNow()');

  // 3. Final CTA does NOT use #buy anchor navigation or page reload
  assert.equal(finalBlock.includes('href="#buy"'), false, 'Final CTA must not navigate to #buy anchor');
  assert.equal(finalBlock.includes('href='), false, 'Final CTA must be a semantic button, not an anchor link');

  // 4. Final CTA price is driven by the existing quantity state in renderPdpQty()
  const renderQtyMatch = html.match(/function\s+renderPdpQty\s*\(\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(renderQtyMatch, 'Must locate renderPdpQty() function in odorstrike.html');
  const renderQtyBody = renderQtyMatch[1];
  assert.ok(renderQtyBody.includes('finalBuyBtn'), 'renderPdpQty() must synchronize finalBuyBtn state');
  assert.ok(
    renderQtyBody.includes("finalBtn.textContent = 'Buy now — ₹' + subtotal") ||
    renderQtyBody.includes("textContent = 'Buy now — ₹' + subtotal") ||
    renderQtyBody.includes('textContent = "Buy now — ₹" + subtotal') ||
    renderQtyBody.includes("textContent = 'Buy now — ₹' + (unitPrice() * pdpQty)"),
    'renderPdpQty() must derive final CTA price dynamically from canonical unit price and quantity'
  );

  // 5. Quantity 1 price is correct (canonical ₹229)
  const unit = PRODUCT.price; // 229
  assert.equal(unit * 1, 229, 'Canonical unit price must equal 229');
  assert.ok(finalBlock.includes('Buy now — ₹229'), 'Initial HTML markup for quantity 1 must display canonical ₹229');

  // 6–8. Pairs are 2 for ₹419, an odd bottle is ₹229 (owner's call, 2026-10-15)
  assert.equal(PRODUCT.pairPrice, 419, 'Pair price is ₹419');
  assert.equal(PRODUCT.pairPricePaise, 41900);
  assert.equal(PRODUCT.pairSaving, unit * 2 - PRODUCT.pairPrice, 'pairSaving must be 2 × price − pairPrice');
  assert.ok(html.includes('PRICES: { solo: 229, pair: 419 }'), 'CFG.PRICES carries the pair price');
  assert.ok(renderQtyBody.includes('subtotalFor(pdpQty)'), 'Buy buttons use the pair-aware subtotal');

  // 9. Final CTA and checkout use the same subtotal derivation
  const orderTotalsMatch = html.match(/function\s+orderTotals\s*\(\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(orderTotalsMatch, 'Must locate orderTotals() function in odorstrike.html');
  assert.ok(orderTotalsMatch[1].includes('subtotal = subtotalFor(qty)'), 'Checkout subtotal must use the pair-aware subtotal'); 

  // 10. No prohibited claims in final CTA copy
  const forbidden = [
    'instant', 'instantly', 'kills', 'destroy', 'guaranteed', 'permanent',
    'miracle', 'odor-proof', 'zero smell', 'smell is gone', 'all day', 'clinically tested'
  ];
  for (const term of forbidden) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    assert.equal(regex.test(finalBlock), false, `Final CTA must not contain prohibited claim: "${term}"`);
  }

  // 11. Existing mobile-bar collision logic remains intact (tracks final button)
  const obsStart = html.indexOf('// Mobile sticky bar — visible whenever no other buy control is on screen');
  const obsBlock = html.slice(obsStart, html.indexOf('})();', obsStart) + 5);
  assert.ok(obsBlock.includes('.final'), 'Mobile bar IntersectionObserver must continue to observe final CTA');

  // Reassurance copy checks
  assert.ok(finalBlock.includes('Free prepaid shipping') || finalBlock.includes('FREE SHIPPING'), 'Final CTA must include concise prepaid shipping reassurance');
  assert.ok(finalBlock.includes('COD available') || finalBlock.includes('Cash on Delivery'), 'Final CTA must include COD reassurance');
  assert.ok(finalBlock.includes('7-day returns') || finalBlock.includes('7-Day Returns'), 'Final CTA must include 7-day returns reassurance');

  // Accessible touch target and focus rules
  assert.ok(html.includes('.final button:focus-visible') || html.includes('.final-btn:focus-visible'), 'Final CTA button must have visible focus styling');
  assert.ok(html.includes('min-height:52px') || html.includes('min-height: 48px') || html.includes('min-height: 44px'), 'Final CTA button must maintain >=44px touch target');
});







test('cart drawer: no prices, COD charge still named, slides instead of popping in', () => {
  const html = readFileSync(new URL('../odorstrike.html', import.meta.url), 'utf8');
  const fn = html.slice(html.indexOf('function renderCart()'), html.indexOf('function syncModalState()'));
  const drawer = html.slice(html.indexOf('id="cartOverlay"'), html.indexOf('</aside>', html.indexOf('id="cartOverlay"')));
  // Owner's call: the drawer is for choosing how many; checkout states totals.
  assert.ok(!/₹\s*\d{3}/.test(drawer), 'Drawer markup must not show a product price or total');
  assert.ok(!/'₹'/.test(fn), 'renderCart must not write prices into the drawer');
  // COD is named; its amount is stated on the COD option in checkout.
  assert.ok(/cash on delivery/i.test(drawer) && !/₹\s*(89|318)\b/.test(drawer), 'Drawer names COD without the COD amount');
  assert.ok(/Free shipping/.test(drawer), 'Drawer must state shipping');
  assert.ok(/class="cart-keep"/.test(drawer), 'Drawer needs a way back to the page');
  assert.ok(/cartAddFromEmpty\(\)/.test(drawer), 'Empty state needs a next step');
  // display:none -> block gave the drawer no start position, so it appeared
  // instead of sliding. It must stay rendered and toggle visibility.
  const css = html.slice(html.indexOf('  .cart-overlay{'), html.indexOf('  .cart-head{'));
  assert.ok(!/display:none/.test(css) && /visibility:hidden/.test(css), 'Cart overlay must hide with visibility, not display');
  assert.ok(/translate3d\(100%/.test(css) && /transition:transform/.test(css), 'Drawer must slide from the right');
  assert.ok(!/backdrop-filter/.test(css), 'No full-screen blur under a sliding panel');
});

test('phone menu: build-time critical CSS cannot trap the drawer shut', () => {
  // The build inlines critical header CSS into every page. It once set the
  // menu to max-height:0;overflow:hidden, which chrome.css never reset, so
  // the menu "opened" at 0px tall in production only.
  const src = readFileSync(new URL('../scripts/apply-chrome.mjs', import.meta.url), 'utf8');
  const crit = src.slice(src.indexOf('const criticalChrome'), src.indexOf('</style>`', src.indexOf('const criticalChrome')));
  const rule = (crit.match(/\.sf-hdr__menu\{[^}]*\}/) || [''])[0];
  assert.ok(rule, 'critical CSS must style .sf-hdr__menu');
  assert.ok(!/max-height\s*:\s*0/.test(rule) && !/display\s*:\s*none/.test(rule), 'critical menu rule must not collapse or hide the drawer');
  const css = readFileSync(new URL('../assets/css/chrome.css', import.meta.url), 'utf8');
  const hdr = (css.match(/\n\.sf-hdr\{[^}]*\}/) || [''])[0];
  assert.ok(!/backdrop-filter/.test(hdr), '.sf-hdr must not use backdrop-filter: it would trap the fixed drawer inside the header');
  assert.ok(/\.sf-hdr__menu\.is-open\{[^}]*transform:none/.test(css), 'open drawer slides in');
});
