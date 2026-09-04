#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG_DIR = path.join(REPO, 'blog');
const CHECK = process.argv.includes('--check');

// Recently added guides plus the older pages already protected by this normalizer.
const SLUGS = [
  'why-clothes-smell-bad-again-after-sweating','why-clothes-smell-bad-after-drying','why-clothes-smell-musty-after-being-stored','why-clothes-smell-in-wardrobe-even-when-clean','why-polyester-holds-odor-longer-than-cotton','why-clean-shirt-starts-smelling-within-hours','how-to-freshen-clothes-stored-for-months','how-to-pack-sweaty-clothes-without-bag-smell','why-body-odor-comes-back-on-clothes-so-quickly','odor-on-clothes-vs-odor-in-clothes',
  'deodorant-perfume-on-fabric','dry-air-clothes-indian-home','how-odor-neutralizer-works-on-fabric','remove-incense-agarbatti-dhoop-smell','vinegar-baking-soda-fabric-softener','wash-refresh-or-wear','why-clothes-smell-stale-in-ac-room','why-shirt-zones-smell-after-washing','why-sweat-smells-stronger-on-some-shirts','why-traffic-fumes-cling-to-clothes','why-washing-machine-makes-clothes-smell','why-water-makes-clothing-odor-louder',
];

const HEADER = `<!-- SF-CHROME:HEADER -->\n<a class="sf-skip" href="#sf-main">Skip to content</a>\n<header class="sf-hdr">\n  <div class="sf-wrap">\n    <div class="sf-hdr__row">\n      <a href="/" class="sf-hdr__logo" aria-label="Smelloff home">\n        <img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" decoding="async">\n      </a>\n      <div class="sf-hdr__right">\n        <a class="sf-cart" href="/?cart=open" aria-label="Cart — view what you've added">\n          <svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 368c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg>\n          <span class="sf-cart__count" id="sfCartCount" hidden>0</span>\n        </a>\n        <ul class="sf-nav">\n          <li><a href="/#buy">ODORSTRIKE</a></li><li><a href="/blog">Guides</a></li><li><a href="/reviews">Reviews</a></li><li><a href="/faq">FAQ</a></li><li><a href="/track-order">Track order</a></li>\n        </ul>\n        <a href="/#buy" class="sf-hdr__cta">Buy ₹229</a>\n        <button class="sf-burger" type="button" aria-expanded="false" aria-controls="sfMenu" aria-label="Open menu"><span></span><span></span><span></span></button>\n      </div>\n    </div>\n    <ul class="sf-hdr__menu" id="sfMenu"><li><a href="/#buy">ODORSTRIKE</a></li><li><a href="/blog">Guides</a></li><li><a href="/reviews">Reviews</a></li><li><a href="/faq">FAQ</a></li><li><a href="/track-order">Track order</a></li><li><a href="/contact">Contact</a></li></ul>\n  </div>\n</header>\n<!-- /SF-CHROME:HEADER -->`;

const SHARE = `\n<aside class="post-share" aria-label="Share this guide"><span class="post-share-title">Share this guide</span><div class="post-share-row"><button type="button" class="ps-btn ps-native" data-share-native hidden aria-label="Share via your apps">↗</button><a class="ps-btn" data-share="whatsapp" target="_blank" rel="noopener nofollow" aria-label="Share on WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="19" height="19" loading="lazy"></a><a class="ps-btn" data-share="x" target="_blank" rel="noopener nofollow" aria-label="Share on X"><img src="/assets/icon-x.png" alt="" width="19" height="19" loading="lazy"></a><button type="button" class="ps-btn ps-copy" data-share-copy aria-label="Copy link"><span class="ps-copy-label">Copy link</span></button></div></aside>\n<section id="blog-comments" data-post-slug="__SLUG__"></section>\n<script src="/assets/js/blog-comments.js?v=2" defer></script>`;

const FOOTER = `\n<!-- SF-CHROME:FOOTER -->\n<footer class="sf-ftr"><div class="sf-wrap"><div class="sf-ftr__grid"><div class="sf-ftr__brand"><img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" loading="lazy"><p>Pocket-sized fabric odor neutralizer. Made for clothes. Smell Proof. Always.</p></div><div><h3>Shop</h3><ul><li><a href="/#buy">ODORSTRIKE</a></li><li><a href="/track-order">Track order</a></li><li><a href="/reviews">Reviews</a></li><li><a href="/blog">Guides</a></li></ul></div><div><h3>Support</h3><ul><li><a href="/contact">Contact</a></li><li><a href="/faq">FAQ</a></li><li><a href="/shipping">Shipping</a></li><li><a href="/returns">Returns</a></li><li><a href="/refund">Refunds</a></li><li><a href="/cancellation">Cancellation</a></li></ul></div><div><h3>Company</h3><ul><li><a href="/about">About</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div></div><div class="sf-ftr__bottom"><span>© 2026 SMELLOFF. HYDERABAD.</span><span>MADE IN INDIA / FABRIC ONLY</span></div></div></footer>\n<!-- /SF-CHROME:FOOTER -->\n<script src="/assets/js/blog-share.js?v=7c7fb634" defer></script>`;

function normalizeFaq(html) {
  return html.replace(/<section class="faq-wrap"[^>]*>([\s\S]*?)<\/section>/i, (_m, inner) => {
    const items = [...inner.matchAll(/<div class="faq-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi)];
    if (!items.length) return _m;
    const details = items.map(([_, q, a]) => `<details><summary>${q}</summary><div class="faq-a"><p>${a}</p></div></details>`).join('\n');
    return `<section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Frequently Asked Questions</h2>${details}</section>`;
  });
}

function normalizeOne(slug) {
  const file = path.join(BLOG_DIR, `${slug}.html`);
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = normalizeFaq(html);
  html = html.replace(/(?:<div id="progress-bar"><\/div>\s*)+/g, '<div id="progress-bar"></div>\n');
  if (!html.includes('<div id="progress-bar"></div>')) html = html.replace('<body>', '<body>\n<div id="progress-bar"></div>');
  if (!html.includes('class="post-share"')) html = html.replace('</main>', `${SHARE.replace('__SLUG__', slug)}\n</main>`);
  if (!html.includes('class="sf-ftr"')) html = html.replace('</body>', FOOTER + '\n</body>');
  if (html !== before) {
    if (!CHECK) fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

const changed = SLUGS.filter(normalizeOne);
if (CHECK && changed.length) {
  console.error(`New-guide layout drift in ${changed.length} page(s):\n- ${changed.join('\n- ')}`);
  process.exit(1);
}
console.log(`New-guide layout: ${CHECK ? 'clean' : `normalized ${changed.length} page(s)`}`);
