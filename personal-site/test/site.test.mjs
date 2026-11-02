// Builds the personal site into a temp folder and checks what ships.
// Runs with `npm test` here, and with the repo's root `npm test` too.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, humanDate } from '../build.mjs';
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
  assert.deepEqual(pages.sort(), ['/', '/about', '/log', '/notes/how-this-site-is-made', '/now'].sort());
  assert.ok(fs.existsSync(sitemapFile), 'sitemap');
  for (const f of ['index.html', 'about.html', 'now.html', 'log.html', 'notes/how-this-site-is-made.html', 'feed.xml', 'nikhil-patil.vcf']) {
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
  assert.match(person.image.url, new RegExp(`^${BASE}/assets/img/me/portrait\\.[0-9a-f]{10}\\.webp$`));
  assert.ok(fs.existsSync(path.join(out, person.image.url.slice(BASE.length))), 'person image exists');
  assert.ok(person.sameAs.length >= 1 && person.sameAs.every((u) => /^https:\/\//.test(u)));
  assert.ok(!person.sameAs.includes('https://smelloff.in'), 'the startup is not the person');
  assert.equal(person.homeLocation.address.addressLocality, 'Hyderabad');
  assert.ok(home.some((n) => n['@type'] === 'WebSite' && n.url === BASE));

  const about = ldOf(read('about.html'))[0]['@graph'];
  assert.equal(about.find((n) => n['@type'] === 'AboutPage').about['@id'], person['@id']);

  const note = ldOf(read('notes/how-this-site-is-made.html'))[0]['@graph'].find((n) => n['@type'] === 'BlogPosting');
  assert.equal(note.author['@id'], person['@id']);
  assert.match(note.datePublished, /^\d{4}-\d{2}-\d{2}$/);
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
      assert.match(tag, /rel="noopener"/, `${f}: ${tag}`);
    }
  }
});

test('nothing private, priced or formula-ish ships', () => {
  const allowedEmails = new Set(['info@smelloff.in']);
  for (const f of [...htmlFiles(), 'feed.xml', 'nikhil-patil.vcf', sitemapFile]) {
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

test('sitemap and feed point at the site url', () => {
  const sm = fs.readFileSync(sitemapFile, 'utf8');
  for (const p of ['', '/about', '/now', '/log', '/notes/how-this-site-is-made']) assert.ok(sm.includes(`<loc>${BASE}${p}</loc>`), p || 'cover');
  assert.match(sm, /<image:loc>[^<]+portrait/);
  const feed = read('feed.xml');
  assert.match(feed, /<rss version="2.0"/);
  assert.equal((feed.match(/<item>/g) || []).length, JSON.parse(fs.readFileSync(path.join(ROOT, 'content/log.json'), 'utf8')).entries.length);
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

test('content files follow their own rules', () => {
  const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/bench.json'), 'utf8')).items;
  for (const b of bench) assert.ok(['NOW', 'LIVE', 'NEW', 'PARKED', 'RETIRED'].includes(b.status), b.id);
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/now.json'), 'utf8'));
  assert.ok(now.supporting.length <= 2, 'one main thing, at most two on the side');
  const log = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/log.json'), 'utf8')).entries;
  for (const e of log) assert.match(e.date, /^\d{4}-\d{2}(-\d{2})?$/);
  const keys = log.map((e) => e.date.padEnd(10, '-99'));
  assert.deepEqual(keys, [...keys].sort().reverse(), 'log is newest first');
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
