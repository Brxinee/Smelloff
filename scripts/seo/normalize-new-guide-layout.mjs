#!/usr/bin/env node
/** Normalize the 10 new guide pages to the same article shell as the established Smelloff blogs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG_DIR = path.join(REPO, 'blog');
const CHECK = process.argv.includes('--check');

const SLUGS = [
  'why-clothes-smell-bad-again-after-sweating',
  'why-clothes-smell-bad-after-drying',
  'why-clothes-smell-musty-after-being-stored',
  'why-clothes-smell-in-wardrobe-even-when-clean',
  'why-polyester-holds-odor-longer-than-cotton',
  'why-clean-shirt-starts-smelling-within-hours',
  'how-to-freshen-clothes-stored-for-months',
  'how-to-pack-sweaty-clothes-without-bag-smell',
  'why-body-odor-comes-back-on-clothes-so-quickly',
  'odor-on-clothes-vs-odor-in-clothes',
];

const HEADER = `<!-- SF-CHROME:HEADER -->\n<a class="sf-skip" href="#sf-main">Skip to content</a>\n<header class="sf-hdr">\n  <div class="sf-wrap">\n    <div class="sf-hdr__row">\n      <a href="/" class="sf-hdr__logo" aria-label="Smelloff home">\n        <img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" decoding="async">\n      </a>\n      <div class="sf-hdr__right">\n        <a class="sf-cart" href="/odorstrike?cart=open" aria-label="Cart — view what you've added">\n          <svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 368c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg>\n          <span class="sf-cart__count" id="sfCartCount" hidden>0</span>\n        </a>\n        <ul class="sf-nav">\n          <li><a href="/odorstrike">ODORSTRIKE</a></li>\n          <li><a href="/blog">Guides</a></li>\n          <li><a href="/reviews">Reviews</a></li>\n          <li><a href="/faq">FAQ</a></li>\n          <li><a href="/track-order">Track order</a></li>\n        </ul>\n        <a href="/odorstrike#buy" class="sf-hdr__cta">Buy ₹229</a>\n        <button class="sf-burger" type="button" aria-expanded="false" aria-controls="sfMenu" aria-label="Open menu"><span></span><span></span><span></span></button>\n      </div>\n    </div>\n    <ul class="sf-hdr__menu" id="sfMenu">\n      <li><a href="/odorstrike">ODORSTRIKE</a></li>\n      <li><a href="/blog">Guides</a></li>\n      <li><a href="/reviews">Reviews</a></li>\n      <li><a href="/faq">FAQ</a></li>\n      <li><a href="/track-order">Track order</a></li>\n      <li><a href="/contact">Contact</a></li>\n    </ul>\n  </div>\n</header>\n<!-- /SF-CHROME:HEADER -->`;

const SHARE = `\n<aside class="post-share" aria-label="Share this guide">\n  <span class="post-share-title"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg>Share this guide</span>\n  <div class="post-share-row">\n    <button type="button" class="ps-btn ps-native" data-share-native hidden aria-label="Share via your apps"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg></button>\n    <a class="ps-btn" data-share="whatsapp" target="_blank" rel="noopener nofollow" aria-label="Share on WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="19" height="19" loading="lazy"></a>\n    <a class="ps-btn" data-share="x" target="_blank" rel="noopener nofollow" aria-label="Share on X"><img src="/assets/icon-x.png" alt="" width="19" height="19" loading="lazy"></a>\n    <a class="ps-btn" data-share="facebook" target="_blank" rel="noopener nofollow" aria-label="Share on Facebook"><img src="/assets/icon-facebook-white.png" alt="" width="19" height="19" loading="lazy"></a>\n    <a class="ps-btn" data-share="linkedin" target="_blank" rel="noopener nofollow" aria-label="Share on LinkedIn"><img src="/assets/icon-linkedin-white.png" alt="" width="19" height="19" loading="lazy"></a>\n    <a class="ps-btn" data-share="telegram" target="_blank" rel="noopener nofollow" aria-label="Share on Telegram"><img src="/assets/icon-telegram-white.png" alt="" width="19" height="19" loading="lazy"></a>\n    <button type="button" class="ps-btn ps-copy" data-share-copy aria-label="Copy link"><span class="ps-copy-label">Copy link</span></button>\n  </div>\n</aside>\n<section id="blog-comments" data-post-slug="__SLUG__"></section>\n<script src="/assets/js/blog-comments.js?v=2" defer></script>`;

const FOOTER = `\n<!-- SF-CHROME:FOOTER -->\n<footer class="sf-ftr">\n  <div class="sf-wrap">\n    <div class="sf-ftr__grid">\n      <div class="sf-ftr__brand">\n        <img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" loading="lazy">\n        <p>Pocket-sized fabric odor neutralizer. Made for clothes. Smell Proof. Always.</p>\n      </div>\n      <div><h3>Shop</h3><ul><li><a href="/odorstrike">ODORSTRIKE</a></li><li><a href="/track-order">Track order</a></li><li><a href="/reviews">Reviews</a></li><li><a href="/blog">Guides</a></li></ul></div>\n      <div><h3>Support</h3><ul><li><a href="/contact">Contact</a></li><li><a href="/faq">FAQ</a></li><li><a href="/shipping">Shipping</a></li><li><a href="/returns">Returns</a></li><li><a href="/refund">Refunds</a></li><li><a href="/cancellation">Cancellation</a></li></ul></div>\n      <div><h3>Company</h3><ul><li><a href="/about">About</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="https://partners.smelloff.in">Partners</a></li></ul></div>\n      <div class="sf-ftr__socials">\n        <a href="https://instagram.com/smelloffindia" target="_blank" rel="noopener" aria-label="Instagram"><img src="/assets/icon-instagram-white.png" alt="" width="20" height="20" loading="lazy"></a>\n        <a href="https://x.com/smelloffindia" target="_blank" rel="noopener" aria-label="X (Twitter)"><img src="/assets/icon-x.png" alt="" width="20" height="20" loading="lazy"></a>\n        <a href="https://t.me/smelloffindia" target="_blank" rel="noopener" aria-label="Telegram"><img src="/assets/icon-telegram-white.png" alt="" width="20" height="20" loading="lazy"></a>\n        <a href="https://www.linkedin.com/company/smelloff" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="/assets/icon-linkedin-white.png" alt="" width="20" height="20" loading="lazy"></a>\n        <a href="https://www.facebook.com/share/1BU1dCAttY/" target="_blank" rel="noopener" aria-label="Facebook"><img src="/assets/icon-facebook-white.png" alt="" width="20" height="20" loading="lazy"></a>\n        <a href="https://wa.me/919392974031" target="_blank" rel="noopener" aria-label="WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="20" height="20" loading="lazy"></a>\n      </div>\n    </div>\n    <div class="sf-ftr__bottom"><span>© 2026 SMELLOFF. HYDERABAD. MFG: Jogdhande Nikhil Patil, Sanathnagar, Erragadda, Hyderabad.</span><span>MADE IN INDIA / FABRIC ONLY</span></div>\n    <div class="sf-ftr__disclaimer"><span>Febreze, Ambi Pur and all other product names, logos and brands mentioned on this site are the property of their respective owners. Smelloff is not affiliated with, endorsed by or sponsored by any of them. Comparisons are our own independent assessments, published for information only.</span></div>\n  </div>\n</footer>\n<!-- /SF-CHROME:FOOTER -->\n<script src="/assets/js/blog-share.js?v=7c7fb634" defer></script>`;

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

  html = html.replace(/<header class="sf-hdr">[\s\S]*?<\/header>/i, HEADER);
  html = normalizeFaq(html);
  html = html.replace(/<footer class="sf-ftr">[\s\S]*?<\/footer>/i, FOOTER.replace('__SLUG__', slug));

  if (!html.includes('<div id="progress-bar"></div>')) {
    html = html.replace('<body>', '<body>\n<div id="progress-bar"></div>');
  }

  if (!html.includes('class="post-share"')) {
    const share = SHARE.replace('__SLUG__', slug);
    html = html.replace('</main>', `${share}\n</main>`);
  }

  if (!html.includes('class="sf-ftr"')) {
    html = html.replace('</body>', FOOTER.replace('__SLUG__', slug) + '\n</body>');
  } else {
    // If footer existed before, ensure share script is present exactly once.
    const shareCount = (html.match(/blog-share\.js/g) || []).length;
    if (shareCount === 0) html = html.replace('</body>', '<script src="/assets/js/blog-share.js?v=7c7fb634" defer></script>\n</body>');
  }

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
