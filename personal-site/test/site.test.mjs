// Builds the personal site into a temp folder and checks what ships.
// Runs with `npm test` here, and with the repo's root `npm test` too.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, humanDate, contentDate } from '../build.mjs';
import { markdown, inline } from '../src/markdown.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://example-personal.test';
const BASE = ORIGIN + '/NikhilPatil';
let out, pages, sitemapFile;

const read = (f) => fs.readFileSync(path.join(out, f), 'utf8');
const htmlFiles = () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.relative(out, path.join(d, e.name))] : []);
  return walk(out);
};
const textOf = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ');
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

before(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'np-site-'));
  sitemapFile = path.join(out, '..', path.basename(out) + '-sitemap.xml');
  ({ pages } = build({ outDir: out, sitemapFile, siteUrl: ORIGIN, printed: '2026-11-02' }));
});

test('builds every page', () => {
  assert.deepEqual(pages.sort(), ['/', '/about', '/now'].sort());
  assert.ok(fs.existsSync(sitemapFile), 'sitemap');
  for (const f of ['index.html', 'about.html', 'now.html', 'nikhil-patil.vcf', 'llms.txt']) {
    assert.ok(fs.existsSync(path.join(out, f)), `missing ${f}`);
  }
});

test('every page has one h1, a title, a description, a canonical and share tags', () => {
  for (const f of htmlFiles()) {
    const html = read(f);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${f}: exactly one h1`);
    assert.match(html, /<html lang="en-IN">/, `${f}: lang`);
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    assert.ok(title && title.length >= 15 && title.length <= 70, `${f}: title length ${title?.length}`);
    const desc = /<meta name="description" content="([^"]+)"/.exec(html)?.[1];
    assert.ok(desc && desc.length >= 15 && desc.length <= 170, `${f}: description length ${desc?.length}`);
    const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canon?.startsWith(BASE), `${f}: canonical on the site url`);
    assert.ok(!canon.endsWith('.html') && !canon.endsWith('/'), `${f}: clean canonical ${canon}`);
    assert.match(html, new RegExp(`<meta property="og:image" content="${BASE}/assets/img/og\\.[0-9a-f]{10}\\.jpg">`), `${f}: absolute, hashed og:image`);
    assert.match(html, /<a class="skip" href="#main">/, `${f}: skip link`);
    assert.match(html, /<main id="main"/, `${f}: main landmark`);
  }
});

test('structured data parses and describes one person consistently', () => {
  const home = ldOf(read('index.html'))[0]['@graph'];
  const profile = home.find((n) => n['@type'] === 'ProfilePage');
  const person = profile.mainEntity;
  assert.equal(person['@type'], 'Person');
  assert.equal(person.name, 'Nikhil Patil');
  // The same entity smelloff.in names as its founder and every post's author.
  assert.equal(person['@id'], 'https://smelloff.in/#founder');
  assert.equal(person.url, BASE);
  assert.ok(person.alternateName.includes('Jogdhande Nikhil Patil'));
  assert.equal(person.worksFor['@id'], 'https://smelloff.in/#organization');
  assert.match(person.image.url, new RegExp(`^${BASE}/assets/img/me/nikhil-patil\\.[0-9a-f]{10}\\.webp$`));
  assert.ok(fs.existsSync(path.join(out, person.image.url.slice(BASE.length))), 'person image exists');
  assert.ok(person.sameAs.length >= 1 && person.sameAs.every((u) => /^https:\/\//.test(u)));
  assert.ok(!person.sameAs.includes('https://smelloff.in'), 'the startup is not the person');
  assert.equal(person.homeLocation.address.addressLocality, 'Hyderabad');
  assert.ok(home.some((n) => n['@type'] === 'WebSite' && n.url === BASE));

  const about = ldOf(read('about.html'))[0]['@graph'];
  assert.equal(about.find((n) => n['@type'] === 'AboutPage').about['@id'], person['@id']);

  assert.match(read('about.html'), /id="credits"/, 'picture credits live on About');
  assert.ok(!fs.existsSync(path.join(out, 'notes')), 'no notes pages');
  for (const f of htmlFiles().filter((x) => x !== 'index.html')) {
    assert.ok(!read(f).includes('"@type":"WebSite"'), `${f}: WebSite markup only on the cover`);
  }
});

test('internal links and #anchors resolve', () => {
  const exists = (p) => {
    assert.ok(p === '/NikhilPatil' || p.startsWith('/NikhilPatil/'), `link outside the base path: ${p}`);
    const rel = p.slice('/NikhilPatil'.length).replace(/^\//, '');
    return rel === '' || fs.existsSync(path.join(out, rel)) || fs.existsSync(path.join(out, rel + '.html'));
  };
  for (const f of htmlFiles()) {
    const html = read(f);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, href] of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [p, hash] = href.split('#');
      if (p) assert.ok(exists(p), `${f}: broken link ${href}`);
      if (hash) {
        const rel = p.slice('/NikhilPatil'.length).replace(/^\//, '');
        const target = p ? read(rel === '' ? 'index.html' : rel + '.html') : html;
        assert.ok(new RegExp(`\\sid="${hash}"`).test(target) || (!p && ids.has(hash)), `${f}: missing #${hash}`);
      }
    }
  }
});

test('external links are marked and safe', () => {
  for (const f of htmlFiles()) {
    for (const [tag] of read(f).matchAll(/<a [^>]*href="https?:[^"]+"[^>]*>/g)) {
      assert.match(tag, /rel="(me )?noopener"/, `${f}: ${tag}`);
    }
  }
});

test('nothing private, priced or formula-ish ships', () => {
  const allowedEmails = new Set(['info@smelloff.in']);
  for (const f of [...htmlFiles(), 'llms.txt', 'llms-full.txt', 'index.md', 'about.md', 'now.md', 'nikhil-patil.vcf', sitemapFile]) {
    const raw = path.isAbsolute(f) ? fs.readFileSync(f, 'utf8') : read(f);
    const text = f.endsWith('.html') ? textOf(raw) : raw;
    for (const [email] of raw.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)) {
      assert.ok(allowedEmails.has(email.toLowerCase()), `${f}: unexpected email ${email}`);
    }
    assert.doesNotMatch(text, /(\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/, `${f}: looks like a phone number`);
    assert.doesNotMatch(text, /₹|\bRs\.?\s?\d|\bINR\b/, `${f}: a price`);
    assert.doesNotMatch(text, /\d+(\.\d+)?\s?%/, `${f}: a percentage (formula figures are never published)`);
    assert.doesNotMatch(text, /\b(born|birthday|age \d|years old)\b/i, `${f}: personal dates`);
    // Smelloff's claim rules apply wherever the product is named.
    assert.doesNotMatch(text, /kills? (the )?odou?r|not a deodorant|10[- ]second|clinically|dermatologist/i, `${f}: product claim`);
  }
});

test('one tiny inline script, and no inline styles', () => {
  for (const f of htmlFiles()) {
    const html = read(f);
    assert.equal([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].length, 1, `${f}: only the theme script is inline`);
    assert.doesNotMatch(html, /\sstyle="/, `${f}: style attribute`);
  }
});

test('assets are content-hashed and every referenced one exists', () => {
  for (const f of htmlFiles()) {
    for (const [, u] of read(f).matchAll(/(?:href|src|srcset)="(\/NikhilPatil\/assets\/[^"]+)"/g)) {
      assert.match(u, /\.[0-9a-f]{10}\.[a-z0-9]+$/, `${f}: unhashed asset ${u}`);
      assert.ok(fs.existsSync(path.join(out, u.slice('/NikhilPatil'.length))), `${f}: missing ${u}`);
    }
  }
  const css = fs.readdirSync(path.join(out, 'assets/css')).find((x) => x.endsWith('.css'));
  const urls = [...read('assets/css/' + css).matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(urls.length > 4);
  for (const u of urls) {
    assert.ok(u.startsWith('/NikhilPatil/assets/'), `css url outside the base path: ${u}`);
    assert.ok(fs.existsSync(path.join(out, u.slice('/NikhilPatil'.length))), `css: missing ${u}`);
  }
});

test('images have alt text and the cover image has its size', () => {
  for (const f of htmlFiles()) {
    for (const [tag] of read(f).matchAll(/<img [^>]+>/g)) {
      assert.match(tag, /\salt="/, `${f}: ${tag}`);
      assert.match(tag, /\swidth="\d+" height="\d+"/, `${f}: ${tag} needs width/height`);
    }
  }
});

test('sitemap points at the site url; the log is gone', () => {
  const sm = fs.readFileSync(sitemapFile, 'utf8');
  for (const p of ['', '/about', '/now']) assert.ok(sm.includes(`<loc>${BASE}${p}</loc>`), p || 'cover');
  assert.match(sm, /<image:loc>[^<]+nikhil-patil/);
  assert.ok(!sm.includes('/log'), 'no log page in the sitemap');
  assert.ok(!fs.existsSync(path.join(out, 'log.html')) && !fs.existsSync(path.join(out, 'feed.xml')));
  for (const f of htmlFiles()) assert.doesNotMatch(read(f), /href="\/NikhilPatil\/(log|feed\.xml)"/, `${f}: link to the removed log`);
});

test('the name is clear: title, h1 and first words say Nikhil Patil', () => {
  const html = read('index.html');
  assert.match(/<title>([^<]+)<\/title>/.exec(html)[1], /^Nikhil Patil/);
  assert.match(html, /<h1 class="masthead"[^>]*><span[^>]*>Nikhil<\/span> <span[^>]*>Patil<\/span><\/h1>/);
  assert.match(textOf(html), /I’m Nikhil Patil/);
  // About lists the profiles so other Nikhil Patils can't be mistaken for him.
  assert.match(read('about.html'), /If a profile isn’t listed here, it isn’t me/);
});

test('private items Nikhil did not approve stay off the site', () => {
  // Side projects and the nickname were not approved (Nov 2026).
  for (const f of htmlFiles()) {
    const text = textOf(read(f));
    assert.doesNotMatch(text, /Brainee|Doddy|Pulpbite|DOIT|backtest|Nifty/i, `${f}: unapproved item`);
  }
});

test('no school history or job-by-job detail (owner, 9 Nov 2026)', () => {
  const files = [...htmlFiles(), 'llms.txt', 'llms-full.txt', 'index.md', 'about.md'];
  for (const f of files) {
    const text = f.endsWith('.html') ? textOf(read(f)) : read(f);
    assert.doesNotMatch(text, /Class 10|college|left school|school stopped|deliver(y|ies)|cleaning|floor work|mobile shop/i, `${f}: withdrawn detail`);
  }
  assert.doesNotMatch(read('index.html'), /early-jobs/, 'the early-jobs photo is gone');
  assert.match(textOf(read('about.html')), /Before Smelloff/);
});

test('content files follow their own rules', () => {
  const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/bench.json'), 'utf8')).items;
  for (const b of bench) assert.ok(['NOW', 'LIVE', 'NEW', 'PARKED', 'RETIRED'].includes(b.status), b.id);
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/now.json'), 'utf8'));
  assert.ok(now.supporting.length <= 2, 'one main thing, at most two on the side');

});

test('markdown and dates render as expected', () => {
  assert.equal(humanDate('2026-11-02'), '2 Nov 2026');
  assert.equal(humanDate('2026-08'), 'Aug 2026');
  assert.equal(inline('<b>'), '&lt;b&gt;');
  const { html, headings } = markdown('## Hi there\n\n- one\n- **two**\n\nA [link](/x) and `code`.');
  assert.match(html, /<h2 id="hi-there">Hi there<\/h2>/);
  assert.match(html, /<ul><li>one<\/li><li><strong>two<\/strong><\/li><\/ul>/);
  assert.match(html, /<a href="\/x">link<\/a>/);
  assert.equal(headings[0].id, 'hi-there');
});

test('every page has a Markdown twin, linked from its head and listed in llms.txt; llms-full.txt holds them all', () => {
  const llmsTxt = read('llms.txt');
  const full = read('llms-full.txt');
  assert.match(llmsTxt, /llms-full\.txt/);
  for (const [html, md] of [['index.html', 'index.md'], ['about.html', 'about.md'], ['now.html', 'now.md']]) {
    const page = read(html);
    const twin = read(md);
    const href = (page.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)">/) || [])[1];
    assert.equal(href, `${BASE}/${md}`, `${html} links its twin`);
    assert.ok(llmsTxt.includes(href), `llms.txt lists ${md}`);
    const canon = page.match(/<link rel="canonical" href="([^"]+)"/)[1];
    assert.match(twin, new RegExp(`^url: ${canon.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`, 'm'));
    const h1 = textOf(page.match(/<h1\b[\s\S]*?<\/h1>/)[0]).replace(/\s+/g, " ").trim();
    assert.ok(twin.includes(`# ${h1}`) && full.includes(`# ${h1}`), `${md} and llms-full carry the H1 "${h1}"`);
    assert.doesNotMatch(twin, /<[a-z][^>]*>|opens another site|Stamp|Tidy/, `${md} is clean text`);
  }
});

test('structured data passes Google’s ProfilePage checks: one ProfilePage with a mainEntity, full ISO date-times', () => {
  const all = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') { all.push(n); Object.values(n).forEach(walk); }
  };
  for (const f of htmlFiles()) walk(ldOf(read(f)));
  const profiles = all.filter((n) => n['@type'] === 'ProfilePage');
  assert.equal(profiles.length, 1, 'exactly one ProfilePage (a stray one in subjectOf shows as "Unnamed item, missing mainEntity")');
  assert.ok(profiles[0].mainEntity && profiles[0].mainEntity['@type'] === 'Person');
  for (const n of all) {
    for (const k of ['dateCreated', 'dateModified', 'datePublished']) {
      if (n[k] !== undefined) assert.match(n[k], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, `${k} "${n[k]}" is a full date-time`);
    }
  }
});

test('ProfilePage carries what Google reads: name, url, Person with name/image/sameAs, created ≤ modified', () => {
  const graph = ldOf(read('index.html')).flatMap((b) => b['@graph'] || [b]);
  const p = graph.find((n) => n['@type'] === 'ProfilePage');
  assert.ok(p.name && p.url === BASE, 'ProfilePage name + url');
  const person = p.mainEntity;
  assert.ok(person.name && person.image?.url && person.sameAs?.length, 'Person name, image, sameAs');
  assert.ok(Date.parse(p.dateCreated) <= Date.parse(p.dateModified), `dateCreated ${p.dateCreated} ≤ dateModified ${p.dateModified}`);
});

test('the printed date / dateModified is the last content change, not the build day (2026-11-09)', () => {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));
  const d = contentDate(site.created);
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d >= site.created, 'never before the site existed');
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  assert.ok(d <= today, 'never in the future');
  assert.equal(contentDate('2999-01-01'), '2999-01-01', 'the floor wins when later');
  const src = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8');
  assert.match(src, /printed = printed \|\| process\.env\.PRINTED_DATE \|\| contentDate\(/, 'build() defaults to the content date');
  assert.doesNotMatch(src, /printed = printed \|\| process\.env\.PRINTED_DATE \|\| new Date\(\)/, 'not the build day');
});

test('the handle NikhilxPatil points at this person: profiles, schema, title, questions', () => {
  const home = read('index.html');
  const person = ldOf(home)[0]['@graph'].find((n) => n['@type'] === 'ProfilePage').mainEntity;
  assert.ok(person.sameAs.includes('https://x.com/NikhilxPatil'), 'X profile');
  assert.ok(person.sameAs.includes('https://www.instagram.com/NikhilxPatil'), 'Instagram profile');
  assert.ok(person.alternateName.includes('NikhilxPatil'));
  assert.equal(person.identifier.value, 'NikhilxPatil');
  assert.match(/<title>([^<]+)<\/title>/.exec(home)[1], /^Nikhil Patil \(NikhilxPatil\)/);
  assert.match(home, /rel="me noopener">@NikhilxPatil/);
  assert.doesNotMatch(home + read('about.html'), /Nikhilxpatil/, 'the handle is spelled NikhilxPatil');
  assert.match(textOf(read('about.html')), /Who is NikhilxPatil\?/);
  for (const f of ['index.html', 'about.html', 'now.html']) {
    const t = /<title>([^<]+)<\/title>/.exec(read(f))[1];
    const d = /<meta name="description" content="([^"]+)"/.exec(read(f))[1];
    assert.ok(t.length <= 60, `${f} title ${t.length}`);
    assert.ok(d.length <= 160, `${f} description ${d.length}`);
  }
});

test('About tells the founder story, what he learned and who should write to him', () => {
  const html = read('about.html');
  for (const id of ['why', 'learned', 'talk']) assert.match(html, new RegExp(`<h2 id="${id}"`), `#${id}`);
  const text = textOf(html);
  assert.match(text, /Why did Nikhil Patil start Smelloff\?/);
  assert.match(text, /I read every message myself/);
  // His page is about him: the product is not named or sold here.
  assert.doesNotMatch(text.slice(text.indexOf('Why I started Smelloff'), text.indexOf('How I work')), /ODORSTRIKE|Buy now|₹/);
});

test('a swipe that starts on a collage piece scrolls the page; holding lifts the piece', () => {
  const css = fs.readFileSync(new URL('../assets/css/site.css', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../assets/js/site.js', import.meta.url), 'utf8');
  const rule = /\.piece\[data-drag\] \{[^}]*\}/.exec(css)[0];
  assert.match(rule, /touch-action: pan-y/, 'vertical swipes on a piece belong to the page');
  assert.doesNotMatch(rule, /touch-action: none/);
  assert.match(js, /pointerType === 'touch'/);
  assert.match(js, /if \(touch\) timer = setTimeout\(start, HOLD_MS\)/, 'a finger must hold before a drag starts');
  assert.match(js, /addEventListener\('touchmove'[\s\S]{0,120}passive: false/, 'the page stays put while a piece is carried');
  assert.match(read('index.html'), /Hold a piece to move it/);
  assert.match(read('index.html'), /<script type="speculationrules">/);
});

test('no AI or tooling talk, and dark-mode stamps stay visible (owner, 9 Nov 2026)', () => {
  for (const f of [...htmlFiles(), 'llms.txt', 'llms-full.txt']) {
    const text = f.endsWith('.html') ? textOf(read(f)) : read(f);
    assert.doesNotMatch(text, /\bAI\b|Claude|Gemini|Cloudflare|Supabase|JavaScript|coding tools/, `${f}: tooling detail`);
  }
  const css = fs.readFileSync(new URL('../assets/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) :is\(\.piece--selfstamp, \.stamp-mark\) \{ mix-blend-mode: normal/);
});
