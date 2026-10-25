// Fixes from the Notion task audit (2026-10-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(f, 'utf8');
const product = JSON.parse(read('config/product.json')).product;

test('blog comments never send an email anywhere', () => {
  const js = read('assets/js/blog-comments.js');
  assert.ok(!js.includes('/rest/v1/waitlist'), 'comment form must not post to the waitlist');
  assert.ok(!/type="email"/.test(js), 'comment form must not ask for an email');
  assert.match(js, /\/rest\/v1\/blog_comments/);
});

test('every post loads the same blog-comments.js stamp', () => {
  const stamps = new Set();
  for (const f of fs.readdirSync('blog').filter((n) => n.endsWith('.html'))) {
    const m = read(`blog/${f}`).match(/blog-comments\.js\?v=(\d+)/);
    if (m) stamps.add(m[1]);
  }
  assert.deepEqual([...stamps], ['3']);
});

test('refund policy prices a returned pack bottle at what was paid for it', () => {
  const html = read('refund.html');
  assert.ok(!html.includes('single 50ml unit'), 'packs exist; the SKU is not "single"');
  assert.ok(!html.includes('₹229 per bottle'), 'a pack bottle cost less than ₹229');
  const each = (paise, n) => (paise / n / 100).toFixed(2).replace(/\.00$/, '');
  assert.ok(html.includes(`₹${each(product.pairPricePaise, 2)} from a pair`));
  assert.ok(html.includes(`₹${each(product.fivePackPricePaise, 5)} from a pack of 5`));
});

test('no page offers ODORSTRIKE as a zinc ricinoleate spray', () => {
  for (const f of fs.readdirSync('blog').filter((n) => n.endsWith('.html'))) {
    const keywords = (read(`blog/${f}`).match(/<meta name="keywords" content="([^"]*)"/) || [])[1] || '';
    assert.ok(!/ricinoleate/i.test(keywords), f);
  }
});

test('database: reviews are readable only when tied to an order', () => {
  const sql = read('supabase/migrations/20261025_reviews_verified_only.sql');
  assert.match(sql, /drop policy if exists "Reviews are publicly readable"/);
  assert.match(sql, /using \(order_id is not null\)/);
  assert.match(sql, /revoke all on table public\.reviews from anon, authenticated/);
});
