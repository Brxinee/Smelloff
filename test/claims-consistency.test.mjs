import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// AI answer engines drop or hedge facts a site contradicts. An audit
// (2026-10-11) found 146 "dries in ~10 seconds" across 42 posts while every
// product page and config/product.json say 15–30 seconds, plus pH values,
// a "1% fragrance load", absolute "no residue" claims and β-Cyclodextrin
// named as the active (it is HPβCD). One set of facts everywhere.
const product = JSON.parse(fs.readFileSync('config/product.json', 'utf8'));
const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
  .concat(['blog'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)))
  .concat(['feed.xml', 'llms.txt', 'llms-full.txt']);

test('config still states the dry time the pages use', () => {
  assert.equal(product.usage.dryTimeShort, '15–30 seconds');
});

test('no page contradicts the product facts in config/product.json', () => {
  const rules = [
    [/\b(?:10|ten)[ -]?sec(?:ond)?s?\b(?![^<]{0,40}cure)/i, 'a ~10-second dry/work time (config: 15–30 seconds)'],
    [/\bpH\s*[0-9]/, 'a pH value (not a published spec)'],
    [/\b\d+(?:\.\d+)?\s*%\s*fragrance/i, 'a fragrance percentage (formula percentages are never published)'],
    [/\bno residue\b|\bzero residue\b|residue-free/i, 'an absolute residue claim (approved: "dries clear with no stiff residue")'],
    [/(?:Zinc PCA (?:\+|and) β-Cyclodextrin|uses β-Cyclodextrin to neutrali)/i, 'β-Cyclodextrin as the active (it is HPβCD)'],
  ];
  for (const f of pages) {
    const text = fs.readFileSync(f, 'utf8');
    for (const [re, why] of rules) {
      const m = text.match(re);
      assert.ok(!m, `${f}: "${m && text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}" — ${why}`);
    }
  }
});
