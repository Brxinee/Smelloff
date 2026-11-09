// Product page (owner, 2026-11-08): one shorter page and one product name.
// #why, #compare, #science and #size became one section; the gallery's second
// tile is the in-hand photo on black (shown whole); every descriptor on the
// PDP, cart, checkout and success screen says "fabric freshener spray"
// (was "clothing deodorant spray" until 2026-11-09).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('odorstrike.html', 'utf8');
const why = html.match(/<section[^>]*\bid="why"[\s\S]*?<\/section>/)[0];

test('#why holds the comparison, the four layers and the key-ingredients note', () => {
  assert.doesNotMatch(html, /<section[^>]*\bid="(science|size)"/, 'no separate #science / #size sections');
  for (const id of ['compare', 'science', 'size', 'whyTitle', 'whyLede']) {
    assert.ok(why.includes(`id="${id}"`), `#${id} stays inside #why (links, speakable)`);
  }
  for (const [layer, name] of [['Trap', 'HPβCD'], ['Neutralize', 'Zinc PCA'], ['Prevent', 'Triethyl Citrate'], ['Sustain', 'Zinc Gluconate']]) {
    assert.match(why, new RegExp(`<span class="pd-layers__k">${layer}</span><span><b>${name}`), `${layer} · ${name}`);
  }
  assert.ok(why.includes('Exact concentrations are proprietary. Need the full list for an allergy check? Write to <a href="mailto:info@smelloff.in">info@smelloff.in</a>.'));
  assert.equal((html.match(/class="pd-scroll" id="compare"/g) || []).length, 1);
});

test('the PDP uses one product name: fabric freshener spray', () => {
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, (m) => (/application\/ld\+json/.test(m) ? '' : m));
  assert.doesNotMatch(visible, /Fabric odor (mist|spray) ·|FABRIC ODOR CONTROL|POCKET MIST/, 'old descriptors are gone');
  assert.ok(html.includes('<p class="pd-eyebrow">FABRIC FRESHENER SPRAY · 50ML</p>'));
  assert.ok(html.includes('· Fabric freshener spray</p>'), 'checkout item line');
  assert.ok(html.includes('<div class="cart-line-unit">Fabric freshener spray · 50ml</div>'), 'cart drawer');
  assert.ok(html.includes("'Fabric freshener spray · Qty ' + qty"), 'success screen');
  assert.doesNotMatch(visible, /not a deodorant/i);
});

test('gallery tile 2 is the whole in-hand photo, never a cutout', () => {
  const gal = html.slice(html.indexOf('id="gallery"'), html.indexOf('<!-- Mobile Gallery Slide Indicator -->'));
  assert.doesNotMatch(gal, /cutout/);
  const tiles = gal.split('<figure').slice(1);
  assert.equal(tiles.length, 5);
  assert.match(tiles[1], /gal-tile--fit/);
  assert.match(tiles[1], /offer-in-hand-black/);
  assert.match(tiles[0], /pdp-01-hero\.webp/, 'tile 1 (LCP) unchanged');
});
