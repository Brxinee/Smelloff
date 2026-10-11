import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const money = ['index.html', 'odorstrike.html'];

// Owner's call (2026-10-11): the photo slots stay visible as briefs until the
// photography lands (reverses the earlier "hide them" fix). Swap each .ph-img
// div for an <img> of the stated ratio.
test('photo placeholder slots are visible on the homepage and PDP', () => {
  for (const f of money) {
    const html = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(html, /\.ph-img\{display:none/, `${f}: .ph-img slots must render`);
    assert.ok((html.match(/class="[^"]*\bph-img\b/g) || []).length >= 4, `${f}: image slots missing`);
  }
  assert.doesNotMatch(fs.readFileSync('index.html', 'utf8'), /<section class="hm-sec" id="combos"[^>]*\shidden>/);
  assert.doesNotMatch(fs.readFileSync('odorstrike.html', 'utf8'), /<section class="pd-sec" id="size"[^>]*\shidden>/);
});

// Brand palette (owner, 2026-10-11): Carbon Black, Ice White, Signal Lime.
test('tokens use the brand palette and buttons are Signal Lime', () => {
  for (const f of ['assets/css/tokens.css', 'index.html', 'odorstrike.html']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const t of ['--ink:#0A0A0A;', '--text:#F2F5EF;', '--acid:#B8FF57;', '--cta:#B8FF57;']) {
      assert.ok(src.includes(t), `${f}: missing ${t}`);
    }
  }
});

// Calm layout (2026-10-11): no full-width acid bands; lime is the accent.
test('no acid bands', () => {
  const idx = fs.readFileSync('index.html', 'utf8');
  for (const sel of ['.final{', '.ticker{']) {
    const rule = idx.slice(idx.indexOf('  ' + sel), idx.indexOf('}', idx.indexOf('  ' + sel)));
    assert.doesNotMatch(rule, /background:var\(--acid\)/, `index.html ${sel} is acid again`);
  }
  assert.match(fs.readFileSync('assets/css/chrome.css', 'utf8'), /\.sf-announce\{background:var\(--surface\)/);
  assert.doesNotMatch(fs.readFileSync('assets/css/chrome.css', 'utf8') + fs.readFileSync('assets/css/soft.css', 'utf8'), /font-weight:900/);
});

test('blog, solutions and checkout follow the quiet layer too', () => {
  const blog = fs.readFileSync('assets/css/blog.css', 'utf8');
  for (const sel of ['.article-category', '.end-cta .buy-btn']) {
    const at = blog.indexOf(sel + ' {') >= 0 ? blog.indexOf(sel + ' {') : blog.indexOf(sel + '{');
    assert.ok(at >= 0, `blog.css lost ${sel}`);
    assert.doesNotMatch(blog.slice(at, blog.indexOf('}', at)), /background: ?var\(--acid\)/, `blog.css ${sel} is acid again`);
  }
  for (const f of fs.readdirSync('solutions').filter(f => f.endsWith('.html'))) {
    assert.doesNotMatch(fs.readFileSync(`solutions/${f}`, 'utf8'), /\.cta-btn\{[^}]*background:var\(--acid\)/, `solutions/${f}`);
  }
  const chrome = fs.readFileSync('assets/js/chrome.js', 'utf8');
  assert.ok(!/'PAY ₹|'PLACE COD ORDER/.test(chrome), 'checkout button labels are sentence case');
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
