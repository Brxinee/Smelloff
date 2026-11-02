// 2026-11-02 conversion pass: per-use price framing and the checkout exit question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(f, 'utf8');

test('per-use price shows its maths (₹229 / ~250 sprays, 2–3 sprays a refresh)', () => {
  for (const f of ['odorstrike.html', 'index.html']) {
    assert.ok(read(f).includes('Under ₹3 a refresh: about ₹0.92 a spray, 2–3 sprays each time'), f);
  }
  assert.ok(Math.abs(229 / 250 - 0.92) < 0.01 && 229 / 250 * 3 < 3, 'the maths holds');
});

test('checkout exit question: once per session, only after a real visit, never after an order', () => {
  const html = read('odorstrike.html');
  assert.match(html, /window\.__smfCkOpenedAt = Date\.now\(\);/);
  assert.match(html, /window\.__smfOrdered = true;/);
  assert.match(html, /if \(window\.__smfOrdered \|\| box\) return;/);
  assert.match(html, /Date\.now\(\) - window\.__smfCkOpenedAt < 4000/);
  assert.match(html, /sessionStorage\.getItem\(KEY\)/);
  // Never while an order or payment is in flight (Codex review on #561).
  assert.match(html, /var ckBusy = !!\(\(lsEl && lsEl\.classList\.contains\('active'\)\) \|\| \(sbEl && sbEl\.disabled\)\);/);
  assert.match(html, /if \(!ckBusy && typeof window\.smfAskWhy === 'function'\) window\.smfAskWhy\(\);/);
  for (const k of ['cod', 'price', 'unsure', 'delivery', 'looking', 'other']) assert.ok(html.includes(`k: '${k}'`), k);
  // Built with textContent only, and no COD amount outside checkout.
  const block = html.slice(html.indexOf('CHECKOUT EXIT QUESTION'), html.indexOf('CONSENT BAR LOGIC'));
  assert.doesNotMatch(block, /innerHTML/);
  assert.doesNotMatch(block, /₹(89|119|149|179|318|348|378|408)\b/);
});

test('the tracker accepts checkout_exit', () => {
  assert.match(read('api/track.js'), /'checkout_exit'/);
});
