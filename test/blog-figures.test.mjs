import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FIGURES } from '../scripts/blog/figures.config.mjs';

// Owner (2026-10-18): "photos or diagrams in the blogs, for engagement".
// Every post carries one photo and one diagram, stamped by
// scripts/blog/apply-figures.mjs from scripts/blog/figures.config.mjs.
const posts = fs.readdirSync('blog').filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.slice(0, -5));

test('every post has a figure entry with one photo and one diagram', () => {
  assert.deepEqual(Object.keys(FIGURES).sort(), posts.sort(), 'figures.config.mjs must list every post');
  for (const [slug, figs] of Object.entries(FIGURES)) {
    assert.equal(figs.filter((f) => f.kind === 'photo').length, 1, `${slug}: one photo`);
    assert.ok(figs.some((f) => f.kind === 'diagram'), `${slug}: a diagram`);
  }
});

test('stamped figures are in the post, photos exist and carry alt text', () => {
  for (const slug of posts) {
    const html = fs.readFileSync(`blog/${slug}.html`, 'utf8');
    const n = FIGURES[slug].length;
    assert.equal((html.match(/<!-- FIG:START \d+/g) || []).length, n, `${slug}: run node scripts/blog/apply-figures.mjs`);
    const photo = html.match(/<figure class="blog-figure fx-photo">[\s\S]*?<\/figure>/);
    assert.ok(photo, `${slug}: photo figure`);
    assert.match(photo[0], /alt="[^"]{30,}"/, `${slug}: photo alt describes the image`);
    assert.match(photo[0], /loading="lazy"/, `${slug}: inline photos are lazy`);
    assert.match(photo[0], /width="1200" height="800"/, `${slug}: photo box reserved (no layout shift)`);
    for (const w of [640, 1200]) for (const ext of ['avif', 'webp']) {
      assert.ok(fs.existsSync(`blog/assets/inline/${slug}@${w}.${ext}`), `${slug}: missing ${w}.${ext}`);
    }
    // The figure never lands inside the quick answer or the TOC.
    const qa = html.match(/<div class="quick-answer">[\s\S]*?<!-- TOC:END/);
    if (qa) assert.doesNotMatch(qa[0], /FIG:START/, `${slug}: figure inside the quick answer`);
  }
});

test('diagram copy keeps to the locked product facts', () => {
  const text = JSON.stringify(FIGURES);
  // Dry time is 15–30 s everywhere (test/claims-consistency); no pH, no %
  // concentrations, no absolute "no residue", no skin use.
  assert.doesNotMatch(text, /10 ?sec|~10 s|\bpH\b|no residue|residue-free|\d+(\.\d+)?% (HPβCD|zinc|triethyl)/i);
  assert.doesNotMatch(text, /shoe|sneaker|helmet/i);
});
