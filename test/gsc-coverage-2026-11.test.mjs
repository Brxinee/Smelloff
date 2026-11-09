// Search Console drilldowns + ProfilePage email, 2026-11-09.
// - "Excluded by 'noindex' tag": /odorstrike?buy=1, ?cart=open, /?ref=producthunt…
//   got noindex from track.js (any URL with a query). Pages already carry a clean
//   rel=canonical; Google advises against noindex for duplicates on one site.
// - "New Profile page structured data issues": the live markup was fixed in #585;
//   this keeps any ProfilePage on the shop's own pages to the same rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '*.html'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const pages = tracked.filter((f) => !/^(_shared|admin|emails|personal-site)\//.test(f) && !/^google[0-9a-f]+\.html$/.test(f));

test('track.js never turns a page noindex (query URLs rely on rel=canonical)', () => {
  const js = fs.readFileSync('assets/js/track.js', 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(js, /noindex/i);
  assert.doesNotMatch(js, /meta\[name="(robots|googlebot)"\]/);
});

test('no shop script writes a robots meta at runtime', () => {
  for (const f of execFileSync('git', ['ls-files', 'assets/js/*.js'], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
    const js = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(js, /name\s*=\s*['"](robots|googlebot)['"]/, `${f} sets a robots meta`);
  }
  for (const f of pages) {
    const inline = [...fs.readFileSync(f, 'utf8').matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    assert.doesNotMatch(inline, /\.content\s*=\s*['"]noindex/, `${f} sets noindex from a script`);
  }
});

test('every indexable page names its clean URL in rel=canonical', () => {
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8');
    if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
    const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canon, `${f} has a canonical`);
    assert.match(canon, /^https:\/\/smelloff\.in(\/[^?#]*)?$/, `${f}: canonical ${canon} has no query`);
    assert.ok(!/\.html$/.test(canon) && !/.\/$/.test(canon.replace('https://smelloff.in/', '')), `${f}: clean canonical ${canon}`);
  }
});

test('any ProfilePage on the shop pages has a Person/Organization mainEntity and full date-times', () => {
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== 'object') return;
        if (n['@type'] === 'ProfilePage') {
          assert.ok(['Person', 'Organization'].includes(n.mainEntity?.['@type']), `${f}: ProfilePage needs mainEntity`);
          for (const k of ['dateCreated', 'dateModified']) if (n[k]) assert.match(n[k], /T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, `${f}: ${k}`);
        }
        Object.values(n).forEach(walk);
      };
      walk(JSON.parse(m[1]));
    }
  }
});
