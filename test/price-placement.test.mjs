// Owner, 2026-11-02: "don't reveal the price everywhere except the homepage and
// product page". Every other public page, feed and AI file names the product,
// never its price, except the four posts below that ask about it. Checkout (on /odorstrike), order emails, /track-order's
// own-order amounts and the Merchant feed / products.json / PDP schema keep
// their prices: they are the product page or the buyer's own receipt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const P = JSON.parse(readFileSync('config/product.json', 'utf8')).product;
const amounts = [P.price, P.mrp, P.pairPrice, P.fivePackPrice, (P.pairPrice / 2).toFixed(2), (P.fivePackPrice / 5).toFixed(2), (P.price / P.spraysApprox).toFixed(2), (P.price / P.refreshesApprox).toFixed(2)];
const PRICE = new RegExp(`(?:₹|&#8377;|&#x20b9;)\\s?(?:${amounts.map((a) => String(a).replace('.', '\\.')).join('|')})(?![\\d.])`, 'i');
const ALLOWED = new Set(['index.html', 'odorstrike.html', 'merchant-feed.xml', 'products.json']);
// Owner, same day: "if it's mandatory in some blogs, keep it". These posts ask
// about the price in their title or a heading/FAQ question, so the answer
// states it, in the body only: never in <head> (search snippet, share text),
// the menu card or the end card.
const PRICE_QUESTION_POSTS = {
  'blog/is-fabric-odor-spray-worth-it-india.html': 'Cost per Use',
  'blog/clothes-perfume-spray-vs-fabric-odor-spray.html': 'What does ODORSTRIKE cost?',
  'blog/gifts-for-men-under-500-india.html': 'How much does ODORSTRIKE cost?',
  'blog/why-i-built-odorstrike.html': 'Why this price?',
};

const files = execSync("git ls-files '*.html' '*.txt' '*.xml' 'manifest.json' 'shared/chat-guides.json' 'assets/js/*.js'", { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => !ALLOWED.has(f) && !(f in PRICE_QUESTION_POSTS) && !/^(admin|emails|docs|test|supabase|node_modules|scripts)\//.test(f) && !f.startsWith('.'));

test('no product or pack price outside the homepage and product page', () => {
  assert.ok(files.length > 100, `scanned ${files.length} files`);
  const hits = files.filter((f) => PRICE.test(readFileSync(f, 'utf8')));
  // chrome.js runs checkout on /odorstrike; reviews-system.js / support-chat.js format amounts at runtime.
  const real = hits.filter((f) => !['assets/js/chrome.js'].includes(f));
  assert.deepEqual(real, [], `prices found in: ${real.join(', ')}`);
});

test('posts that ask about the price answer it in the body only', () => {
  for (const [f, q] of Object.entries(PRICE_QUESTION_POSTS)) {
    const html = readFileSync(f, 'utf8');
    assert.ok(html.includes(q), `${f}: still asks "${q}"`);
    assert.match(html.split('</head>')[1], PRICE, `${f}: the answer states the price`);
    assert.doesNotMatch(html.split('</head>')[0], PRICE, `${f}: no price in <head> (snippet, share text)`);
    for (const block of [/<a class="sf-menu__product"[\s\S]*?<\/a>/, /<div class="end-cta">[\s\S]*?<\/div>\s*(?=<|$)/]) {
      const m = html.match(block);
      if (m) assert.doesNotMatch(m[0], PRICE, `${f}: no price in the menu or end card`);
    }
  }
});

test('generators that stamp other pages carry no price', () => {
  const chrome = readFileSync('scripts/apply-chrome.mjs', 'utf8');
  assert.doesNotMatch(chrome, /₹\$\{/, 'apply-chrome stamps the menu card and closing card on every page');
  assert.doesNotMatch(readFileSync('scripts/seo/build-llms.mjs', 'utf8'), /₹\$\{P\.(price|mrp|pairPrice|fivePackPrice)\}/);
  assert.match(readFileSync('api/support-chat.js', 'utf8'), /PRICES: say a price, or add a pack card/);
});

test('the homepage and product page still show the price', () => {
  for (const f of ['index.html', 'odorstrike.html']) assert.match(readFileSync(f, 'utf8'), new RegExp(`₹${P.price}\\b`), f);
});
