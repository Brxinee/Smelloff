#!/usr/bin/env node
/* Blog post reading layer — stamps the parts of every post that should be
   the same everywhere, so they can't drift between 56 hand-edited files.

   - A table of contents built from the post's own <h2>s (NN/g: people scan
     by headings; a TOC lets them jump to the one they came for). Static HTML
     between <!-- TOC:START/END --> markers: it works without JS and never
     shifts the page. blog.css shows it inline (collapsible) on phones and as
     a sticky sidebar on wide screens; blog-share.js highlights the section
     you're in.
   - ids on those <h2>s (deep-linkable sections).
   - An author byline in the meta row (the same Person the Article schema names).
   - The product card gets the bottle and a "View product" route beside Buy,
     the same two routes the homepage offers.
   - Every post loads track.js and consent-analytics.js (CLAUDE.md "Launch
     readiness": 34 posts had no first-party beacon, 9 had no consent bar).
   - The per-post inline progress-bar scripts (five variants) are removed;
     blog-share.js runs the one progress bar.
   - Schema, one entity per thing (2026-10-11 audit: the author came in three
     shapes and none had an @id; publishers in four): every Article's author
     is the founder Person (@id https://smelloff.in/#founder, the same one
     /about and the Organization name) and its publisher the Organization by
     @id. A post's free-standing SpeakableSpecification block (valid only as a
     property) moves onto the Article as `speakable`, keeping only selectors
     that exist on the page. datePublished never runs after dateModified.
   - The visible "Updated" date is the Article's dateModified (35 posts showed
     a different date than their schema). Edit dateModified, never the text.

   Idempotent. `--check` exits 1 if any post would change (wired into build).
   Run `node scripts/apply-chrome.mjs` afterwards only if you also changed a
   shared asset; this script stamps the current track/consent hashes itself. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');
const hash = (rel) => createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 8);

const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'product.json'), 'utf8')).brand;
const AUTHOR = BRAND.founder;
const ORG = { '@type': 'Organization', '@id': 'https://smelloff.in/#organization', name: BRAND.name, url: `${BRAND.website}/` };
const PERSON = {
  '@type': 'Person', '@id': 'https://smelloff.in/#founder', name: AUTHOR, jobTitle: BRAND.jobTitle,
  url: `${BRAND.website}/about`, worksFor: ORG,
};
const PUBLISHER = { ...ORG, logo: { '@type': 'ImageObject', url: BRAND.logo, width: 180, height: 180 } };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slugify = (t) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

// End of the element that opens at `start` (balanced <div> counting).
function closeOf(html, start, tag = 'div') {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

// Rewrites a JSON-LD block only when its data changes, in the block's own
// layout (multi-line blocks stay indented), so re-runs leave files alone.
function normalizeSchema(html) {
  const blocks = [...html.matchAll(/(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)\n?/g)];
  let speakable = null;
  let article = null;
  for (const m of blocks) {
    let data; try { data = JSON.parse(m[2]); } catch { continue; }
    if (data['@type'] === 'SpeakableSpecification') speakable = data.cssSelector;
    if (data['@type'] === 'Article' || data['@type'] === 'BlogPosting') article = { m, data };
  }
  if (!article) return html;
  const before = JSON.stringify(article.data);
  const a = article.data;
  a.author = PERSON;
  a.publisher = PUBLISHER;
  const sel = (speakable || a.speakable?.cssSelector || [])
    .filter((c) => /^\.[\w-]+$/.test(c) && new RegExp(`class="(?:[^"]*\\s)?${c.slice(1)}(?:\\s[^"]*)?"`).test(html));
  if (sel.length) a.speakable = { '@type': 'SpeakableSpecification', cssSelector: sel };
  else delete a.speakable;
  if (a.datePublished && a.dateModified && a.datePublished > a.dateModified) a.dateModified = a.datePublished;
  if (JSON.stringify(a) !== before) {
    const raw = article.m[2];
    const body = raw.trim().includes('\n') ? `\n${JSON.stringify(a, null, 2)}\n` : JSON.stringify(a);
    html = html.replace(article.m[0], `${article.m[1]}${body}${article.m[3]}${article.m[0].endsWith('\n') ? '\n' : ''}`);
  }
  // The free-standing speakable block goes (it now lives on the Article).
  html = html.replace(/[ \t]*<script[^>]*application\/ld\+json[^>]*>\s*\{"@context": ?"https:\/\/schema\.org", ?"@type": ?"SpeakableSpecification"[\s\S]*?<\/script>\n?/g, '');
  html = html.replace(/[ \t]*<!-- JSON-LD Speakable -->\n(?![ \t]*<script)/g, '');

  // Visible date = schema date.
  const mod = (a.dateModified || a.datePublished || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(mod)) {
    html = html.replace(/<span class="article-date">[\s\S]*?<\/span>/,
      `<span class="article-date">Updated <time datetime="${mod}">${longDate(mod)}</time></span>`);
    html = html.replace(/(<meta property="article:modified_time" content=")[^"]*(")/, `$1${mod}$2`);
  }
  return html;
}

function transform(html) {
  // 1 · Remove an earlier TOC so re-runs replace rather than stack.
  html = html.replace(/\n?[ \t]*<!-- TOC:START[\s\S]*?<!-- TOC:END -->\n?/g, '');

  const aStart = html.indexOf('<article class="article-wrap">');
  if (aStart === -1) return html;
  const hEnd = html.indexOf('</header>', aStart) + '</header>'.length;
  // The TOC covers the guide itself: stop at the FAQ / product card / related.
  const stops = ['<section class="faq', '<section class="faq-wrap', '<section class="related-guides', '<section class="read-next', '<aside class="post-share']
    .map((m) => html.indexOf(m, hEnd)).filter((i) => i !== -1);
  let bodyEnd = Math.min(...stops, html.indexOf('</article>', aStart));

  // 2 · ids on body <h2>s, and the TOC entries.
  const used = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const entries = [];
  let region = html.slice(hEnd, bodyEnd);
  region = region.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (full, attrs = '', inner) => {
    if (/class="[^"]*qa-q/.test(attrs)) return full;
    const text = strip(inner);
    if (/^(frequently asked|faq|sources)/i.test(text)) return full;
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) {
      const base = slugify(text);
      id = base; let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);
      attrs = `${attrs} id="${id}"`;
    }
    entries.push({ id, text });
    return `<h2${attrs}>${inner}</h2>`;
  });
  html = html.slice(0, hEnd) + region + html.slice(bodyEnd);

  // 3 · The TOC, after the quick answer (or straight after the header).
  if (entries.length >= 3) {
    const toc =
      `\n    <!-- TOC:START — generated by scripts/blog/apply-reader.mjs from this post's section headings. -->\n` +
      `    <details class="toc" id="toc">\n` +
      `      <summary><span class="toc-label">In this guide</span><span class="toc-count">${entries.length} sections</span></summary>\n` +
      `      <ol>\n${entries.map((e) => `        <li><a href="#${e.id}">${esc(e.text)}</a></li>`).join('\n')}\n      </ol>\n` +
      `    </details>\n    <!-- TOC:END -->\n`;
    let at = hEnd;
    const qa = html.indexOf('<div class="quick-answer"', hEnd);
    if (qa !== -1 && qa < html.indexOf('<h2', hEnd + 1) + 2000) {
      const qe = closeOf(html, qa);
      if (qe !== -1) at = qe;
    }
    html = html.slice(0, at) + toc + html.slice(at);
  }

  // 4 · Byline → the Person's url, like the schema.
  html = html.replace(/\n\s*<span class="article-author">[\s\S]*?<\/span>(?=\s*<span class="article-)/, '');
  html = html.replace(/(<div class="article-meta">\s*<span class="article-category">[\s\S]*?<\/span>)/,
    `$1\n        <span class="article-author">By <a href="/about" rel="author">${AUTHOR}</a></span>`);

  // 4b · Schema entities, speakable, dates.
  html = normalizeSchema(html);

  // 5 · Product card: bottle + a route to the product page that isn't checkout.
  html = html.replace(/<div class="end-cta">(?!<img class="cta-img")/g,
    '<div class="end-cta"><img class="cta-img" src="/assets/odorstrike-bottle-cutout.webp" alt="" width="241" height="915" loading="lazy" decoding="async">');
  html = html.replace(/(<a [^>]*class="buy-btn"[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>)(?!\s*<a class="cta-link")/g,
    '$1 <a class="cta-link" href="/odorstrike">View product details</a>');

  // 5b · Every table scrolls inside its own keyboard-reachable region on
  // phones (13 bare <table>s were pushing the page 4–50px wide).
  html = html.replace(/(<div class="table-scroll"[^>]*>)?(<table\b[\s\S]*?<\/table>)(<\/div>)?/g, (m, open, table) =>
    `<div class="table-scroll" tabindex="0" role="region" aria-label="Table — scroll sideways on small screens">${table}</div>`);

  // 6 · Inline progress-bar scripts → the shared one.
  html = html.replace(/[ \t]*<script>(?:(?!<\/script>)[\s\S])*?progress-bar(?:(?!<\/script>)[\s\S])*?<\/script>\n?/g, '');
  if (!html.includes('id="progress-bar"')) html = html.replace(/<body([^>]*)>/, '<body$1>\n<div id="progress-bar" aria-hidden="true"></div>');

  // 7 · Analytics on every post (first-party beacon + consent-gated loaders).
  for (const [rel, re] of [
    ['assets/js/track.js', /<script src="\/assets\/js\/track\.js[^"]*"[^>]*><\/script>\n?/g],
    ['assets/js/consent-analytics.js', /<script src="\/assets\/js\/consent-analytics\.js[^"]*"[^>]*><\/script>\n?/g],
  ]) {
    // Position-insensitive: apply-chrome.mjs also moves tags near </body>,
    // so only the presence and the hash are this script's business.
    const tag = `<script src="/${rel}?v=${hash(rel)}" defer></script>`;
    const found = html.match(re) || [];
    if (found.length === 1) html = html.replace(re, `${tag}\n`);
    else {
      html = html.replace(re, '');
      html = html.replace('</body>', `${tag}\n</body>`);
    }
  }
  return html;
}

let changed = 0;
for (const f of readdirSync(join(ROOT, 'blog')).filter((f) => f.endsWith('.html') && f !== 'index.html')) {
  const p = join(ROOT, 'blog', f);
  const before = readFileSync(p, 'utf8');
  const after = transform(before);
  if (after !== before) {
    changed++;
    if (CHECK) console.log(`  ${f} (stale)`);
    else writeFileSync(p, after);
  }
}
if (CHECK && changed) {
  console.error(`apply-reader: ${changed} post(s) out of date — run node scripts/blog/apply-reader.mjs`);
  process.exit(1);
}
console.log(CHECK ? 'apply-reader: all posts current' : `apply-reader: updated ${changed} post(s)`);
