// 2026-11-01 UI/UX pass (ui-ux-pro-max checklist: fixed elements must not hide
// the primary action; reserve space so fonts don't shift layout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const face = (css, family) => {
  const m = css.match(new RegExp(`font-family:'${family}';[^}]*size-adjust:([\\d.]+)%`));
  return m ? Number(m[1]) : null;
};

test('fallback faces are metric-matched (no 37% oversized Inter Tight fallback)', () => {
  for (const f of ['assets/fonts.css', 'index.html']) {
    const css = read(f);
    const it = face(css, 'Inter Tight Fallback');
    const fr = face(css, 'Fraunces Fallback');
    // Inter Tight is narrower than Arial; Fraunces 900 is ~Liberation Serif Bold.
    assert.ok(it > 90 && it < 100, `${f}: Inter Tight Fallback size-adjust ${it}% (measured 95.32%)`);
    assert.ok(fr > 96 && fr < 106, `${f}: Fraunces Fallback size-adjust ${fr}% (measured 101.13%)`);
  }
});

test('phone consent bar is compact and its buttons keep 44px with an explicit line-height', () => {
  const css = read('assets/css/chrome.css');
  const block = css.slice(css.indexOf('Compact consent bar on phones'));
  assert.match(block, /@media\(max-width:519px\)/);
  assert.match(block, /html #smelloff-consent-bar \.cb-actions button\{[^}]*min-height:44px;[^}]*line-height:1\.2/);
  // 2026-11-08 (owner: smaller cookie bar): 4px padding around one 44px row,
  // and the tracker names drop out of the phone sentence (/privacy names them).
  assert.match(block, /html #smelloff-consent-bar\{padding:4px 12px calc\(4px \+ env\(safe-area-inset-bottom,0px\)\)\}/);
  assert.match(block, /html #smelloff-consent-bar \.cb-who\{display:none\}/);
  const copy = 'Analytics cookies<span class="cb-who"> (Google Analytics, Meta Pixel)</span> help us improve the site. <a href="/privacy">Privacy Policy</a>';
  for (const f of ['index.html', 'odorstrike.html', 'faq.html', 'assets/js/consent-analytics.js']) {
    assert.ok(read(f).includes(copy), `${f}: consent copy in sync`);
    assert.ok(read(f).includes('#smelloff-consent-bar .cb-who{display:none}'), `${f}: carries the CONSENT-COMPACT block`);
    assert.ok(!read(f).includes('Shopping works either way'), `${f}: one short sentence`);
  }
  // Accept stays Ice White, never lime (it must not out-weigh Reject).
  assert.match(read('index.html'), /#smelloff-consent-bar \.cb-accept\{background:var\(--text\)/);
});

test('chat launcher yields to page buttons and to the open consent bar on phones', () => {
  const js = read('assets/js/support-chat.js');
  assert.match(js, /function yieldToButtons\(\)/);
  assert.match(js, /html\.sf-chat-yield \.sfc-launch/);
  assert.match(js, /window\.innerWidth < 520 && cb/);
});

test('sticky buy strips treat the bottom 120px as covered', () => {
  assert.match(read('odorstrike.html'), /threshold: 0\.1, rootMargin: '0px 0px -120px 0px'/);
  assert.match(read('index.html'), /threshold: 0, rootMargin: '0px 0px -120px 0px'/);
});

test('PDP phones: fabric chips sit under the buy row so Buy is in the first screen', () => {
  const html = read('odorstrike.html');
  assert.match(html, /\.pd-kicker,\.pd-title,\.pd-highlights\{order:-2\}/);
  assert.match(html, /\.pd-price,\.buy-actions,\.pd-eta\{order:-1\}/);
});

test('homepage product-block image sizes match its rendered width on phones', () => {
  const html = read('index.html');
  assert.equal((html.match(/sizes="\(min-width:900px\) 360px, calc\(100vw - 74px\)"/g) || []).length, 2);
});

test('PDP shows a delivery date under Buy, from the checkout estimate', () => {
  const html = read('odorstrike.html');
  const buy = html.indexOf('id="pdpBuyBtn"'), eta = html.indexOf('id="pdEta"'), cart = html.indexOf('id="pdpCartBtn"');
  assert.ok(buy > 0 && eta > buy && eta < cart, 'delivery line sits between Buy and Add to cart');
  assert.match(html, /id="pdEta" hidden/, 'hidden until the script fills it');
  assert.match(html, /var e = calculateDeliveryEstimate\(\);/, 'same window as checkout');
});
