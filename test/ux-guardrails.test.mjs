import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const money = ['index.html', 'odorstrike.html'];

// Image slots waiting for photography rendered as dashed boxes reading
// "IMAGE 01 · 4:5 · 1200×1500 · WebP" on the live homepage and PDP.
test('photo placeholders never reach customers', () => {
  for (const f of money) {
    const html = fs.readFileSync(f, 'utf8');
    assert.match(html, /\.ph-img\{display:none !important\}/, `${f}: .ph-img slots must stay hidden until the photo exists`);
  }
  assert.match(fs.readFileSync('index.html', 'utf8'), /<section class="hm-sec" id="combos"[^>]*\shidden>/, 'combo cards are template text until combos exist');
  assert.match(fs.readFileSync('odorstrike.html', 'utf8'), /<section class="pd-sec" id="size"[^>]*\shidden>/, '#size is three empty slots until shot');
});

// config/product.json claims.prohibited, enforced on the visible copy of the two money pages.
test('money pages carry no prohibited product claims', () => {
  const banned = /no white marks|no marks\b|anti-regrowth|anti regrowth|zero residue|residue-free/i;
  for (const f of money) {
    const visible = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    const hit = visible.match(new RegExp(`.{0,40}(${banned.source}).{0,40}`, 'i'));
    assert.equal(hit, null, `${f}: ${hit && hit[0]}`);
  }
});

// The bar covered ~200px of an 844px phone screen with two stacked buttons.
test('consent bar puts Accept and Reject side by side on phones, equal weight', () => {
  for (const f of ['index.html', 'odorstrike.html', 'assets/css/chrome.css', 'assets/js/consent-analytics.js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(src.includes('#smelloff-consent-bar .cb-actions button{flex:1 1 130px'), `${f}: buttons must share one row`);
    assert.ok(!src.includes('#smelloff-consent-bar .cb-actions button{flex:1 1 100%}'), `${f}: stacked buttons are back`);
  }
});

test('delivery estimate counts the 48-hour dispatch window into the late date', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.match(html, /var hi = addBusinessDays\(now, hiCount \+ DISPATCH_DAYS\);/);
});

// Owner's call (2026-10-11): show three key ingredients and count the rest.
test('the full ingredient list is not published — three actives plus a count', () => {
  const supporting = /polysorbate|PE9010|ethylhexylglycerin|citric acid/i;
  for (const f of ['odorstrike.html', 'index.html', 'blog/odorstrike-ingredients.html', 'llms.txt', 'llms-full.txt', 'products.json', 'merchant-feed.xml']) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), supporting, `${f} names a supporting ingredient`);
  }
  assert.match(fs.readFileSync('odorstrike.html', 'utf8'), /HPβCD · Zinc PCA · Triethyl Citrate <span class="pd-inci-more">\+ 8 more<\/span>/);
});
