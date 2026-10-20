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
    [/Neutrali[sz]ation lasts|\b(?:8|9|10)\s*(?:to|–|-)\s*(?:10|12|24)\s*hours of (?:odou?r )?protection/i, 'protection beyond the locked "up to 8 hours"'],
    [/(?:scent|fragrance)[^.<]{0,30}\bfades? (?:with)?in (?:a few )?minutes/i, 'a scent fade time (config says only "light scent")'],
  ];
  for (const f of pages) {
    const text = fs.readFileSync(f, 'utf8');
    for (const [re, why] of rules) {
      const m = text.match(re);
      assert.ok(!m, `${f}: "${m && text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}" — ${why}`);
    }
  }
});

// 2026-10-11: a chat tool's citation token ("fileciteturn8file0")
// had been pasted into the best-fabric guide and was live in the page text.
test('no pasted AI-tool residue (citation tokens, private-use or zero-width characters)', () => {
  for (const f of pages) {
    const text = fs.readFileSync(f, 'utf8');
    const m = text.match(/[-​-‍⁠﻿]|filecite|citeturn|turn\d+(?:file|search|view)\d+|oaicite|contentReference\[/);
    assert.ok(!m, `${f}: "${m && text.slice(Math.max(0, m.index - 30), m.index + 30)}"`);
  }
});

// 2026-10-20: ODORSTRIKE is a "clothing deodorant". Pages that still said
// "not a deodorant" contradicted it, and an engine quoting either line gets
// the category wrong. It is not a BODY deodorant, and every page says that.
test('category: a clothing deodorant, never "not a deodorant"', () => {
  for (const f of pages) {
    const m = fs.readFileSync(f, 'utf8').match(/\bnot (?:a |an )?deo(?:dorant)?\b(?=\s*(?:[.,;:)—–-]|and\b|or\b|nor\b|$))/i);
    assert.ok(!m, `${f}: "${m && m.input.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}" — say "not a body deodorant"`);
  }
  const def = product.product.definition;
  assert.ok(def.includes('clothing deodorant') && def.includes('not a body deodorant') && def.includes('never on skin'), 'definition names the category and keeps it off skin');
  for (const f of ['index.html', 'odorstrike.html', 'faq.html']) {
    assert.ok(fs.readFileSync(f, 'utf8').includes(def), `${f}: "What is ODORSTRIKE?" must quote product.definition verbatim`);
  }
  for (const f of ['index.html', 'odorstrike.html']) {
    const html = fs.readFileSync(f, 'utf8');
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    assert.match(title, /Clothing Deodorant/, `${f}: title names the category`);
    assert.match(html, /Not body deodorant/, `${f}: keeps the "Not body deodorant" chip`);
  }
});
