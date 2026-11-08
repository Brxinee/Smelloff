// PDP additions (2026-11-08): a "When to reach for it" strip of Indian everyday
// occasions below the hero, and "What happens after you order" under the #buy
// box, plus a hidden India-only note for non-Indian visitors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('odorstrike.html', 'utf8');
const product = JSON.parse(fs.readFileSync('config/product.json', 'utf8'));

function sectionById(id) {
  const m = html.match(new RegExp(`<section[^>]*\\bid="${id}"[\\s\\S]*?</section>`));
  assert.ok(m, `#${id} section exists`);
  return m[0];
}
const text = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('occasions strip sits below the hero, after #how, with 4–5 items', () => {
  const hero = html.indexOf('<section class="pd-hero"');
  const how = html.indexOf('id="how"');
  const when = html.indexOf('id="when"');
  const why = html.indexOf('id="why"');
  assert.ok(hero > 0 && when > hero, 'after the hero');
  assert.ok(when > how && when < why, 'between #how and #why');
  const sec = sectionById('when');
  assert.match(sec, /<h2 id="whenTitle"[^>]*>When to reach/);
  const items = sec.match(/<li class="pd-when__item">/g) || [];
  assert.ok(items.length >= 4 && items.length <= 5, `4–5 occasions, got ${items.length}`);
});

test('occasions copy stays inside the claims: clothing only, no new numbers', () => {
  const t = text(sectionById('when'));
  assert.doesNotMatch(t, /₹|\d+\s*%|\bhours?\b|bacteria|zero residue|not a deodorant/i);
  assert.doesNotMatch(t, /\b(shoes?|sneakers?|helmets?|bags?|backpacks?|sofas?|curtains?|rooms?|car seats?)\b/i);
  assert.match(t, /sweat|heat/i);
  assert.match(t, /smoke/i);
  assert.match(t, /tadka|frying|food/i);
  assert.match(t, /between washes/i);
});

test('after-order steps live under the #buy box and state no amount', () => {
  const buy = sectionById('buy');
  const m = buy.match(/<div class="pd-after">[\s\S]*?<\/ol>[\s\S]*?<\/p>/);
  assert.ok(m, 'the after-order block is inside #buy');
  const steps = m[0].match(/<li>/g) || [];
  assert.ok(steps.length >= 3 && steps.length <= 4, `3–4 steps, got ${steps.length}`);
  const t = text(m[0]);
  assert.doesNotMatch(t, /₹|&#8377;|\bRs\.?\s*\d/i, 'no rupee amount (COD amounts belong in checkout only)');
  assert.match(t, /email/i);
  assert.match(t, /phone call before dispatch/i, 'COD phone confirmation (config shipping.dispatchCodNote)');
  assert.ok(product.shipping.dispatchCodNote.includes('phone call before dispatch'));
  assert.match(t, /Hyderabad/);
  assert.match(t, /Within 48 hours of order confirmation \(excluding Sundays and public holidays\)/, 'matches /shipping');
  assert.match(fs.readFileSync('shipping.html', 'utf8'), /within <strong>48 hours<\/strong> of order confirmation \(excluding Sundays and public holidays\)/);
  assert.match(m[0], /href="\/track-order"/);
  assert.match(t, new RegExp(`${product.returns.windowDays} days from delivery`));
  assert.match(m[0], /href="\/returns"/);
});

test('hidden India-only note sits in the #buy box', () => {
  const buy = sectionById('buy');
  assert.ok(buy.includes('<p class="pd-intl" hidden>We deliver within India only.</p>'));
  const offer = buy.slice(buy.indexOf('<div class="pd-offer-body">'), buy.indexOf('<div class="pd-after">'));
  assert.ok(offer.includes('class="pd-intl"'), 'inside the offer box, not below it');
  const css = html.match(/\.pd-intl\{[^}]*\}/);
  assert.ok(css, '.pd-intl is styled');
  assert.doesNotMatch(css[0], /display\s*:/, 'no display rule, so [hidden] keeps it hidden');
});
