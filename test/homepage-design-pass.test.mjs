// Homepage design pass, 2026-11-02 (owner: "improve my Smelloff design … you
// can remove or edit the homepage sections … deeply research what works").
// Audited with taste-skill's inspector, Vercel's Web Interface Guidelines and
// ui-ux-pro-max; see docs/audits/homepage-design-pass-2026-11-02.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const sec = (id) => main.slice(main.indexOf(`id="${id}"`), main.indexOf('</section>', main.indexOf(`id="${id}"`)));

test('section order: hero, photos, proof, offer, contents, founders, FAQ, close', () => {
  // 2026-11-08 (owner): the real photos sit directly under the hero.
  const order = ['in-use', 'reviews', 'odorstrike-featured', 'how-it-works', 'founders', 'faq', 'final'];
  const at = order.map((id) => main.indexOf(`id="${id}"`));
  assert.ok(at.every((i) => i > 0), 'every section exists');
  assert.deepEqual([...at].sort((a, b) => a - b), at, `sections in order: ${order.join(' → ')}`);
  // Section reach covers every section, in page order.
  assert.match(html, /\['in-use','reviews','odorstrike-featured','how-it-works','founders','faq','final'\]\.forEach/);
  const heroEnd = main.indexOf('</section>', main.indexOf('<section class="hero"'));
  assert.ok(heroEnd > 0 && main.indexOf('<section', heroEnd) === main.indexOf('<section class="inuse" id="in-use"'), 'the in-use photos come straight after the hero');
});

test('"Your shirt remembers" (the drag-the-day timeline) is gone for good (owner, 2026-11-08)', () => {
  assert.ok(!/id="remembers"|remembersTitle|rmScrub|class="rm-|\.rm-|\.remembers|var DAY\b/.test(html), 'no markup, CSS or script left');
  assert.ok(!/'remembers'/.test(html), 'not observed by section reach or the sticky bar');
  assert.ok(!/Your shirt remembers/.test(main.replace(/<!--[\s\S]*?-->/g, '')), 'no copy left');
});

test('one product name on the homepage: "fabric freshener spray" (owner, 2026-11-08; renamed 2026-11-09)', () => {
  assert.ok(main.includes('<span class="hero-eyebrow-pill">FABRIC FRESHENER SPRAY</span>'), 'hero eyebrow');
  const visible = main.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(!/FABRIC ODOR CONTROL|[Ff]abric odor eliminator (mist|spray)/.test(visible), 'the other two names are gone from the visible copy');
  assert.ok(sec('odorstrike-featured').includes('A pocket-sized fabric freshener spray'));
  assert.ok(!/not a deodorant/i.test(html), 'never "not a deodorant" ("not a body deodorant" is fine)');
});

test('no endless motion: the ticker and the Hinglish marquee are gone, the line stays still', () => {
  assert.ok(!/class="ticker"|ticker-track|band-marquee|bm-track/.test(main), 'no moving strips in the markup');
  assert.ok(!/@keyframes ticker|animation:ticker/.test(html), 'no ticker animation in the CSS');
  assert.ok(sec('odorstrike-featured').includes('<p class="band-static">Smell Khatam. Confidence Qaayam.</p>'));
});

test('in-use section: four of the owner\'s photos, clothing only, sized and lazy', () => {
  const s = sec('in-use');
  const imgs = [...s.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(imgs.length, 4);
  for (const img of imgs) {
    assert.match(img, /src="\/assets\/photos\//, 'owner photos only');
    assert.match(img, /width="\d+" height="\d+"/, 'explicit size (no CLS)');
    assert.match(img, /loading="lazy"/, 'below the fold, lazy');
    assert.match(img, /alt="[^"]{12,}"/, 'describes the photo');
    const file = img.match(/src="\/([^"]+)"/)[1];
    assert.ok(fs.existsSync(file), `${file} exists`);
  }
  // Every srcset/source file exists.
  for (const m of s.matchAll(/\/assets\/photos\/[^\s",]+/g)) assert.ok(fs.existsSync(m[0].slice(1)), `${m[0]} exists`);
  // The in-hand shot has an iPhone (Apple logo) and the jacket shot a bag: not used here.
  assert.ok(!/pdp-size-in-hand|pdp-jacket-lining/.test(s));
  assert.ok(/class="ph-pic"/.test(s), 'network-aware sizes apply (lazy .ph-pic)');
  assert.ok(s.includes('href="/odorstrike">View product details</a>'), 'a route to the product page');
});

test('one action, one name: every homepage buy button says "Fix my shirt"', () => {
  assert.ok(!/GET ODORSTRIKE|Fix your shirt|View Full Specs/.test(html), 'old labels are gone');
  assert.ok(sec('odorstrike-featured').includes('>FIX MY SHIRT — ₹229</a>'));
  assert.ok(sec('final').includes('>FIX MY SHIRT — ₹229</a>'));
  assert.match(html, /class="mb-btn" href="\/odorstrike\?buy=1" tabindex="-1">FIX MY SHIRT</);
});

test('fewer labels above headings, short headings, nothing below 12px', () => {
  // Only the hero keeps its pill (and its test); section H2s stand alone.
  for (const id of ['in-use', 'reviews', 'odorstrike-featured', 'how-it-works', 'founders', 'final']) {
    assert.ok(!/<p class="eyebrow/.test(sec(id)), `#${id} has no eyebrow label`);
  }
  for (const [id, h] of [['inuseTitle', 'Spray the shirt, not you.'], ['voicesTitle', 'What beta testers say'], ['proofTitle', "What's in the bottle"], ['founderTitle', 'Built for 41°C days']]) {
    assert.ok(main.includes(`id="${id}"`) && main.includes(`>${h}</h2>`), `${id}: "${h}"`);
    assert.ok(h.split(' ').length <= 6, `${id} is a title, not a sentence`);
  }
  // The four layers work together; they are not a numbered sequence.
  assert.ok(!/0[1-4] — (TRAP|NEUTRALIZE|PREVENT|SUSTAIN)/.test(main));
  assert.ok(!/<span class="i-pct">0\d<\/span>/.test(main));
  // The third copy of the fabric-only badges and the extra trust line are gone.
  assert.ok(!/prod-badge|prod-trust-sub/.test(html));
  // Legibility floor.
  assert.match(html, /#sf-main :is\(\.hero-clarify,[^)]*\.close-trust\)\{font-size:12px !important\}/);
  assert.match(html, /#homeMobileBar \.mb-label\{font-size:12px\}/);
});

test('Web Interface Guidelines basics on the homepage', () => {
  assert.match(html, /:root\{color-scheme:dark\}/, 'dark theme declares color-scheme');
  assert.match(html, /#sf-main :is\(a,button,summary,input\),#homeMobileBar a\{touch-action:manipulation\}/);
  assert.match(html, /#sf-main section\[id\]\{scroll-margin-top:/, 'anchors clear the sticky header');
  assert.match(html, /<meta name="theme-color" content="#0A0A0A">/);
});

test('facts kept: locked claims, beta testers labelled', () => {
  assert.ok(sec('how-it-works').includes('Perfume and body deodorant sit on top of the fabric'));
  assert.ok(sec('how-it-works').includes('up to 8 hours of protection on fabric'));
  assert.equal((sec('reviews').match(/Beta tester/g) || []).length, 3);
  assert.ok(sec('in-use').includes('Dries clear in 15–30 seconds'));
  assert.ok(!/zero residue|no residue|instantly|kills/i.test(sec('in-use')));
});
