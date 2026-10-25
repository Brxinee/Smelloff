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

test('no page pings the retired partners.smelloff.in host', () => {
  for (const f of ['index.html', 'odorstrike.html']) {
    assert.ok(!read(f).includes('partners.smelloff.in'), f);
  }
  // ?ref= codes still reach the order through track.js attribution.
  assert.match(read('assets/js/track.js'), /t\.partner = /);
});

test('the 30-day review is described as what it was', () => {
  for (const f of ['index.html', 'odorstrike.html']) {
    assert.ok(!read(f).includes('stain-tested across India'), f);
  }
  assert.match(read('blog/odorstrike-review-30-day-india-test.html'), /One person \(me\)\. Hyderabad/);
});

test('/reviews never ships "No reviews yet" as visible static text', () => {
  assert.match(read('reviews.html'), /<div class="empty" id="empty" style="display:none">/);
});

test('FAQ makes no "fine for normal contact" safety claim', () => {
  assert.ok(!read('faq.html').includes('fine for normal contact'));
});

test('email docs quote the current COD total', () => {
  const doc = read('docs/EMAIL-SYSTEM.md');
  assert.ok(!doc.includes('₹289'));
  assert.ok(doc.includes(`₹${product.priceCod}`));
});

test('FAQ inhalation answer is an instruction, not a safety claim', () => {
  const faq = read('faq.html');
  assert.ok(!faq.includes('safe to wear against skin'));
  assert.ok(!faq.includes('Yes, once dry.'));
  assert.ok(faq.includes("Don't breathe in the mist."));
});

test('the 30-day review title says what the test was', () => {
  for (const f of ['blog/odorstrike-review-30-day-india-test.html', 'feed.xml', 'sitemap.xml', 'llms.txt']) {
    assert.ok(!read(f).includes('30-Day India Test'), f);
  }
});

test('internal scripts quote the current COD amounts', () => {
  for (const f of ['scripts/render-email-previews.mjs', 'scripts/generate_audit_reports.mjs']) {
    assert.ok(!/₹289|₹60 COD|codFee: 60\b/.test(read(f)), f);
  }
});

test('database: a review shows only when its order was bought', () => {
  const sql = read('supabase/migrations/20261025_reviews_buyers_only.sql');
  assert.match(sql, /security definer/);
  assert.match(sql, /then o\.status = 'delivered'/);
  assert.match(sql, /using \(order_id is not null and public\.review_order_bought\(order_id\)\)/);
  // Same rule as the edge function that accepts reviews.
  const edge = read('supabase/functions/_shared/security.ts');
  for (const s of ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered']) {
    assert.ok(edge.includes(`"${s}"`) && sql.includes(`'${s}'`), s);
  }
});

test('admin marks a review on an unbought order as hidden', () => {
  assert.match(read('api/admin.js'), /order:orders\(status,payment_method\)/);
  assert.match(read('admin/index.html'), /hidden on site`, 'tagged'\]/);
});
