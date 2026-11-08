import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SKIP, CLUSTER_LINES, SLUG_LINES, CARD } from '../scripts/blog/product-card.config.mjs';

// About 90% of search traffic lands on the guides, but the product only
// appeared at the end of each post. apply-reader.mjs stamps a compact product
// card right after the quick answer of every post except SKIP (posts whose own
// answer is "a spray is not the fix", and posts already about the product).
const posts = fs.readdirSync('blog').filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.slice(0, -5));
const read = (slug) => fs.readFileSync(`blog/${slug}.html`, 'utf8');
const cardOf = (html) => (html.match(/<!-- PCARD:START[\s\S]*?<!-- PCARD:END -->/) || [])[0];

test('the skip list names real posts, each with a reason', () => {
  for (const [slug, why] of Object.entries(SKIP)) {
    assert.ok(posts.includes(slug), `SKIP lists ${slug}, which has no post`);
    assert.ok(typeof why === 'string' && why.length > 10, `${slug}: give a reason`);
  }
  for (const slug of Object.keys(SLUG_LINES)) {
    assert.ok(posts.includes(slug), `SLUG_LINES lists ${slug}, which has no post`);
    assert.ok(!(slug in SKIP), `${slug} is skipped; drop its line`);
  }
  assert.ok(posts.length - Object.keys(SKIP).length >= 75, 'most posts carry the card');
});

test('every non-skipped post has exactly one card, right after the quick answer', () => {
  for (const slug of posts) {
    const html = read(slug);
    const n = (html.match(/<!-- PCARD:START/g) || []).length;
    const ids = (html.match(/id="blog_pcard"/g) || []).length;
    if (slug in SKIP) {
      assert.equal(n, 0, `${slug} is skipped but has a card`);
      assert.equal(ids, 0, `${slug} is skipped but has a card`);
      continue;
    }
    assert.equal(n, 1, `${slug}: one card (run node scripts/blog/apply-reader.mjs)`);
    assert.equal(ids, 1, `${slug}: one card element`);
    // Directly after the quick answer's closing tag: only whitespace between.
    assert.match(html, /<div class="quick-answer">(?:(?!<div class="quick-answer">)[\s\S])*?<\/div>\s*<!-- PCARD:START/, `${slug}: card follows the quick answer`);
    // The table of contents comes after the card, and nothing is inside the quick answer.
    const toc = html.indexOf('<!-- TOC:START');
    if (toc !== -1) assert.ok(html.indexOf('<!-- PCARD:END') < toc, `${slug}: card before the TOC`);
  }
});

test('the card carries no price, links to the product page and has the hidden India-only line', () => {
  const PRICE = /₹|&#8377;|&#x20b9;|\bRs\.?\s?\d|\bMRP\b|\d+\s*%|\boff\b|discount|\bsave\b/i;
  for (const slug of posts.filter((s) => !(s in SKIP))) {
    const card = cardOf(read(slug));
    assert.ok(card, slug);
    assert.doesNotMatch(card.replace(/<[^>]+>/g, ' '), PRICE, `${slug}: no price, discount or saving in the card`);
    assert.doesNotMatch(card, /₹/, `${slug}: no ₹ anywhere in the card`);
    const links = [...card.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ['/odorstrike'], `${slug}: one link, to /odorstrike (not checkout)`);
    assert.match(card, /<a class="sf-btn sf-btn--ghost pcard__cta" href="\/odorstrike">/, `${slug}: the site's ghost button`);
    assert.match(card, /<p class="pcard__intl" hidden>We deliver within India only\.<\/p>/, `${slug}: hidden India-only line`);
    assert.match(card, /Cash on Delivery · Free shipping on prepaid · Ships from Hyderabad within 48 hours/, `${slug}: India perks`);
    // The owner's in-hand photo, whole, never a cutout; no layout shift.
    assert.doesNotMatch(card, /odorstrike-bottle-(cutout|studio)/, `${slug}: no cutout`);
    const img = card.match(/<img\b[^>]*>/)[0];
    assert.match(img, /offer-in-hand-black@400\.webp/);
    assert.match(img, /width="\d+" height="\d+"/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /decoding="async"/);
    assert.match(img, /alt="[^"]{20,}"/);
    // track.js reports the closest [id] as link_location, so the card's id
    // tells its clicks apart from the end card ("end_card").
    assert.match(card, /<div class="pcard" id="blog_pcard">/);
  }
});

test('card copy keeps to the locked claims and the clothing-only rule', () => {
  const text = JSON.stringify({ CLUSTER_LINES, SLUG_LINES, CARD });
  assert.doesNotMatch(text, /₹|\d+\s*%|\bpH\b|10 ?sec|instant|kills?\b|bacteri|antimicrob|no residue|zero residue|residue-free|guarantee|best ?seller|only \d+ left|hurry|limited|rating|review|★/i);
  assert.doesNotMatch(text, /shoe|sneaker|helmet|\bbag\b|gym bag|sofa|curtain|room spray|car seat|luggage/i);
  assert.doesNotMatch(text, /\bnot (?:a |an )?deo(?:dorant)?\b(?=\s*(?:[.,;:)—–-]|and\b|or\b|nor\b|$))/i, 'say "not a body deodorant"');
  assert.match(CARD.what, /never on skin/i);
});

test('the stamping is current (apply-reader --check)', () => {
  execFileSync(process.execPath, ['scripts/blog/apply-reader.mjs', '--check'], { stdio: 'pipe' });
});

test('blog.css styles the card with tokens, and posts load the current blog.css', () => {
  const css = fs.readFileSync('assets/css/blog.css', 'utf8');
  const block = css.slice(css.indexOf('In-article product card'), css.indexOf('/* ---', css.indexOf('In-article product card') + 50));
  assert.match(block, /\.pcard\b/);
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b/i, 'tokens, not raw hex');
  assert.match(block, /object-fit:\s*contain/, 'the photo is shown whole');
  // /assets/* is immutable for a year: the ?v= stamp must be blog.css's
  // content hash (apply-chrome.mjs hashOf) or returning readers keep the old file.
  const v = createHash('sha256').update(fs.readFileSync('assets/css/blog.css')).digest('hex').slice(0, 8);
  for (const slug of posts) assert.ok(read(slug).includes(`/assets/css/blog.css?v=${v}"`), `${slug}: blog.css?v=${v} (run node scripts/apply-chrome.mjs or re-stamp)`);
});
