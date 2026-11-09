#!/usr/bin/env node
// Builds Nikhil Patil's personal site.
//
//   node build.mjs          preview build into ./dist (served by serve.mjs)
//
// Live, it is part of the smelloff.in deploy: scripts/prepare-public.mjs calls
// build() with outDir = public/NikhilPatil, so every page lives under
// https://smelloff.in/NikhilPatil (site.json → url + basePath).
//
// No dependencies. Content lives in ./content (JSON + Markdown notes); the
// look lives in ./assets. Every page is complete, crawlable HTML: JavaScript
// only adds the toys (drag, stamps, ring, shutter, clock).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { markdown, frontMatter, escapeHtml as esc, plainText, inline } from './src/markdown.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-02" → "2 Nov 2026"; "2026-08" → "Aug 2026" */
export function humanDate(iso, long = false) {
  const [y, m, d] = iso.split('-').map(Number);
  const mon = (long ? MONTHS_LONG : MONTHS)[m - 1];
  return d ? `${d} ${mon} ${y}` : `${mon} ${y}`;
}

const STATUS_WORD = { NOW: 'Now', LIVE: 'Live', NEW: 'New', PARKED: 'Parked', RETIRED: 'Retired' };

// The one inline script: sets the theme before first paint so the shutter
// never flashes.
export const THEME_SCRIPT = "(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('np-theme');if(t==='dark'||t==='light')d.dataset.theme=t}catch(e){}})();";

function loadContent() {
  const site = json('content/site.json');
  const notesDir = path.join(ROOT, 'content/notes');
  const notes = (fs.existsSync(notesDir) ? fs.readdirSync(notesDir) : [])
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, body } = frontMatter(fs.readFileSync(path.join(notesDir, f), 'utf8'));
      const { html, headings } = markdown(body);
      const words = plainText(body).split(' ').length;
      return { slug: f.slice(0, -3), ...data, html, headings, minutes: Math.max(1, Math.round(words / 200)) };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    site,
    now: json('content/now.json'),
    journey: json('content/journey.json'),
    bench: json('content/bench.json').items,
    syllabus: json('content/syllabus.json'),
    shelf: json('content/shelf.json'),
    credits: json('content/credits.json').items,
    notes,
  };
}

/* ---------- assets: copied with a content hash, so they can be cached forever */

function hashName(file, buf) {
  const h = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const ext = path.extname(file);
  return file.slice(0, -ext.length) + '.' + h + ext;
}

function copyAssets(outDir, basePath) {
  const map = {}; // "/assets/css/site.css" → "/assets/css/site.3f9a….css" (before the base path)
  const srcRoot = path.join(ROOT, 'assets');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const files = walk(srcRoot);
  const leaf = files.filter((f) => !/\.(css|js)$/.test(f));
  const code = files.filter((f) => /\.(css|js)$/.test(f));
  const write = (rel, buf, hashed = true) => {
    const name = hashed ? hashName(rel, buf) : rel;
    const target = path.join(outDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf);
    map['/' + rel.split(path.sep).join('/')] = '/' + name.split(path.sep).join('/');
  };
  for (const f of leaf) write(path.relative(ROOT, f), fs.readFileSync(f), !/\.txt$/.test(f));
  for (const f of code) {
    const text = fs.readFileSync(f, 'utf8').replace(/\/assets\/[A-Za-z0-9_./@-]+/g, (u) => basePath + (map[u] || u));
    write(path.relative(ROOT, f), Buffer.from(text));
  }
  return map;
}

/* ---------- small template helpers. Pages are written with root-relative
 * paths ("/about", "/assets/…"); withBase() moves them under the base path. */

const attr = (s) => esc(s);
const ext = (url) => /^https?:\/\//.test(url);
const linkTo = (url, label, cls = '') =>
  `<a${cls ? ` class="${cls}"` : ''} href="${attr(url)}"${ext(url) ? ' rel="noopener"' : ''}>${esc(label)}${ext(url) ? '<span class="ext" aria-hidden="true">↗</span><span class="sr"> (opens another site)</span>' : ''}</a>`;
const icon = (name) => `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

function withBase(html, basePath, assets) {
  return html.replace(/(\s(?:href|src|srcset)=")(\/(?!\/)[^"]*)"/g, (m, pre, url) => {
    if (url.startsWith(basePath + '/') || url === basePath) return m;
    const mapped = assets[url.split('#')[0]] ? url.replace(url.split('#')[0], assets[url.split('#')[0]]) : url;
    if (mapped === '/') return `${pre}${basePath}"`;
    if (mapped.startsWith('/#')) return `${pre}${basePath}${mapped.slice(1)}"`;
    return `${pre}${basePath}${mapped}"`;
  });
}

const picture = (img, { cls = '', priority = false, sizes } = {}) => `<picture${cls ? ` class="${cls}"` : ''}>
  <source type="image/avif" srcset="${img.avif}">
  <img src="${img.src}" width="${img.width}" height="${img.height}" alt="${attr(img.alt)}"${priority ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" draggable="false"${sizes ? ` sizes="${sizes}"` : ''}>
</picture>`;

const SPRITE = `<svg class="sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-stamp" viewBox="0 0 24 24"><path d="M9 3h6l-1 7h3a3 3 0 0 1 3 3v2H4v-2a3 3 0 0 1 3-3h3L9 3Zm-5 15h16v3H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-tidy" viewBox="0 0 24 24"><path d="M12 3v8m-5 0h10l1 3H6l1-3Zm-1 3-1 7m4-7-.5 7M14 14l.5 7M18 14l1 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-shutter" viewBox="0 0 24 24"><path d="M3 4h18M5 4v13h14V4M5 8h14M5 12h14M10 17v2h4v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-card" viewBox="0 0 24 24"><path d="M3 6h18v12H3zM7 10h5M7 14h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-rss" viewBox="0 0 24 24"><path d="M5 19a1 1 0 1 0 0-.01M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
</svg>`;

/* ---------- structured data */

// Google's ProfilePage report wants full ISO 8601 date-times ("Invalid datetime
// value" for a bare date). Pages are dated in IST.
const isoDateTime = (d) => (/T/.test(d) ? d : `${d}T00:00:00+05:30`);

function personLd(c, ctx) {
  const s = c.site;
  return {
    '@type': 'Person',
    // The same @id smelloff.in uses for its founder, so the store's pages and
    // this one describe one person; this page is where that person lives.
    '@id': s.personId,
    name: s.name,
    alternateName: s.alternateName,
    givenName: s.givenName,
    familyName: s.familyName,
    url: `${ctx.site}`,
    mainEntityOfPage: `${ctx.site}`,
    image: { '@type': 'ImageObject', url: ctx.abs(s.photo.src), width: s.photo.width, height: s.photo.height },
    description: s.description,
    disambiguatingDescription: s.disambiguation,
    jobTitle: s.jobTitle,
    hasOccupation: { '@type': 'Occupation', name: 'Founder', occupationLocation: { '@type': 'City', name: s.location.city } },
    subjectOf: [
      { '@type': 'Article', url: 'https://smelloff.in/blog/why-i-built-odorstrike', headline: 'Why I Built ODORSTRIKE: A Founder’s Note', author: { '@id': s.personId } },
    ],
    worksFor: { '@type': 'Organization', '@id': s.worksFor.id, name: s.worksFor.name, url: s.worksFor.url },
    homeLocation: {
      '@type': 'Place',
      name: `${s.location.city}, ${s.location.country}`,
      address: { '@type': 'PostalAddress', addressLocality: s.location.city, addressRegion: s.location.region, addressCountry: s.location.countryCode },
    },
    knowsAbout: s.knowsAbout,
    sameAs: s.profiles.filter((p) => p.sameAs).map((p) => p.url),
  };
}

const breadcrumbLd = (ctx, trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ctx.url(p) })),
});

const ldScript = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;

/* ---------- page shell */

function layout(c, ctx, page) {
  const s = c.site;
  const url = ctx.url(page.path);
  const og = ctx.abs('/assets/img/og.jpg');
  const current = (p) => (page.path === p || (p !== '/' && page.path.startsWith(p + '/')) ? ' aria-current="page"' : '');
  return `<!doctype html>
<html lang="${s.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${attr(page.description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="text/markdown" href="${ctx.site + mdPath(page.path)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="${attr(s.name)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F2EDE3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141311" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${attr(s.name)}">
<meta property="og:title" content="${attr(page.ogTitle || page.title)}">
<meta property="og:description" content="${attr(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${s.ogLocale}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(`${s.name}, a self-taught builder in Hyderabad.`)}">
${page.ogType === 'profile' ? `<meta property="profile:first_name" content="${attr(s.givenName)}">\n<meta property="profile:last_name" content="${attr(s.familyName)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="@Nikhilxpatil">
<link rel="preload" href="/assets/fonts/archivo-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<script>${THEME_SCRIPT}</script>
${page.ld ? ldScript(page.ld) + '\n' : ''}<script src="/assets/js/site.js" defer></script>
</head>
<body class="${page.bodyClass || ''}">
${SPRITE}
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__in">
    <a class="brand" href="/"${current('/')}><span class="brand__mark" aria-hidden="true">NP</span><span class="brand__name">${esc(s.name)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/now"${current('/now')}>Now</a>
      <a href="/about"${current('/about')}>About</a>
    </nav>
    <p class="clock" aria-label="Local time in Hyderabad"><span class="clock__place">Hyd</span> <time class="clock__time" data-clock>IST</time></p>
    <button class="shutter-btn" type="button" data-theme-toggle aria-pressed="false" title="Lights off">${icon('shutter')}<span class="shutter-btn__label">Lights</span><span class="sr"> (dark mode)</span></button>
  </div>
</header>
<main id="main" tabindex="-1">
${page.body}
</main>
<footer class="foot">
  <div class="foot__in">
    <p class="foot__printed">${esc(s.name)} · printed in ${esc(s.location.city)} · <time datetime="${ctx.printed}">${humanDate(ctx.printed)}</time></p>
    <nav class="foot__nav" aria-label="Footer">
      <a href="/">Cover</a><a href="/now">Now</a><a href="/about">About</a>
    </nav>
    <p class="foot__small">No cookies, no trackers. Words and photos © ${ctx.printed.slice(0, 4)} ${esc(s.name)}; cut-outs from Wikimedia Commons (CC0), credited on the <a href="/about#credits">About page</a>. Fonts under the SIL Open Font License.</p>
  </div>
</footer>
<div class="shutter" aria-hidden="true"></div>
</body>
</html>
`;
}

/* ---------- reusable blocks */

const secHead = (num, id, title, aside) => `<header class="sec__head">
  <p class="sec__num" aria-hidden="true">${num}</p>
  <h2 class="sec__title" id="${id}">${title}</h2>
  ${aside ? `<p class="sec__aside hand" aria-hidden="true">${aside}</p>` : ''}
</header>`;


function benchCard(item, i) {
  const body = item.body ? markdown(item.body).html : '';
  const links = item.links.length ? `<ul class="card__links">${item.links.map((l) => `<li>${linkTo(l.url, l.label)}</li>`).join('')}</ul>` : '';
  return `<li class="card card--${item.status.toLowerCase()} tilt-${i % 4}" id="made-${item.id}">
  <p class="stamp stamp--${item.status.toLowerCase()}"><span class="sr">Status: </span>${STATUS_WORD[item.status]}</p>
  <p class="card__kicker">${esc(item.kicker)}</p>
  <h3 class="card__title">${esc(item.title)}</h3>
  <p class="card__summary">${inline(item.summary)}</p>
  ${body ? `<details class="card__more"><summary><span>More</span></summary><div class="card__body prose">${body}</div></details>` : ''}
  ${links}
</li>`;
}

function nowBlock(now, { full = false } = {}) {
  return `<div class="note-paper now__paper">
  <p class="now__label">The main thing</p>
  <p class="now__main">${inline(now.main)}</p>
  <p class="now__label">On the side <span class="now__rule">(two, max)</span></p>
  <ul class="now__side">${now.supporting.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>
  <p class="now__parked">${inline(now.parked)}</p>
  <p class="now__date">Updated <time datetime="${now.updated}">${humanDate(now.updated)}</time> in ${esc(now.place)}${full ? '' : ` · <a href="/now">The /now page</a>`}</p>
</div>`;
}

function timeCard(j, site) {
  return `<div class="timecard">
  <div class="timecard__card">
    <p class="timecard__head"><span>Time card</span><span>${esc(site.name)}</span></p>
    <ol class="timecard__rows">
${j.rows.map((r, i) => `      <li class="punch${r.today ? ' punch--today' : ''}">
        <span class="punch__no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <span class="punch__job">${esc(r.job)}</span>
        <span class="punch__note">${esc(r.note)}</span>
        <span class="punch__stamp" aria-hidden="true">${r.today ? '<time data-clock>IN</time>' : 'IN'}</span>
      </li>`).join('\n')}
    </ol>
  </div>
  <figure class="print print--early">
    ${picture(j.photo)}
    <figcaption class="hand">${esc(j.photo.caption)}</figcaption>
  </figure>
</div>`;
}

// rel="me" tells crawlers (and IndieWeb tools) these profiles belong to the
// person this page is about.
const meLink = (p) => `<a href="${attr(p.url)}" rel="${p.sameAs ? 'me ' : ''}noopener">${esc(p.handle)}<span class="ext" aria-hidden="true">↗</span><span class="sr"> (opens another site)</span></a>`;

function profileLinks(site, cls = 'links') {
  return `<ul class="${cls}">${site.profiles.map((p) => `<li><span class="links__label">${esc(p.label)}</span> ${meLink(p)}</li>`).join('')}
<li><span class="links__label">Email</span> <a href="mailto:${attr(site.email.address)}">${esc(site.email.address)}</a> <span class="links__note">${esc(site.email.note)}</span></li></ul>`;
}

/* ---------- pages */

function homePage(c, ctx) {
  const { site, now, journey, bench, syllabus, shelf } = c;
  const sections = [['now', 'Now'], ['clocked-in', journey.title], ['syllabus', 'Self-taught syllabus'], ['shelf', 'Shelf'], ['made', 'Things I’ve made'], ['card', 'Take a card']];
  const body = `
<section class="cover" id="cover" aria-labelledby="cover-title" data-cover>
  <p class="issue"><span><span class="issue__no">Issue ${esc(humanDate(ctx.printed).replace(/^\d+ /, ''))}</span> <span class="issue__sep" aria-hidden="true">·</span> ${esc(site.location.city)}</span> <span class="issue__what">A zine about one person</span></p>
  <h1 class="masthead" id="cover-title"><span class="masthead__a">Nikhil</span> <span class="masthead__b">Patil</span></h1>
  <p class="dek">${esc(site.dek).replace('self-taught', '<mark>self-taught</mark>')}</p>

  <div class="collage" data-collage>
    <figure class="piece piece--portrait" data-drag>
      ${picture(site.photo, { priority: true })}
      <figcaption class="hand">that’s me</figcaption>
    </figure>
    <figure class="piece piece--beach" data-drag>
      ${picture({ src: '/assets/img/me/nikhil-patil-beach.webp', avif: '/assets/img/me/nikhil-patil-beach.avif', width: 560, height: 430, alt: 'Nikhil Patil on a beach, in a pink striped shirt.' })}
      <figcaption class="hand">out of office</figcaption>
    </figure>
    <figure class="piece piece--bottle" data-drag>
      <picture>
        <source type="image/avif" srcset="/assets/img/bottle-halftone.avif">
        <img src="/assets/img/bottle-halftone.webp" width="200" height="621" alt="A photocopied halftone of the spray bottle my startup makes." loading="lazy" decoding="async" draggable="false">
      </picture>
      <figcaption class="hand">thing I make</figcaption>
    </figure>
    <div class="piece piece--glove" data-drag aria-hidden="true">
      <img src="/assets/img/glove.webp" width="212" height="326" alt="" loading="lazy" decoding="async" draggable="false">
      <span class="hand">Ippo energy</span>
    </div>
    <div class="piece piece--cassette" data-drag aria-hidden="true">
      <img src="/assets/img/cassette.webp" width="354" height="235" alt="" loading="lazy" decoding="async" draggable="false">
      <span class="hand">side A: anime</span>
    </div>
    <p class="piece piece--city" data-drag aria-hidden="true"><span class="tape-label">Hyderabad</span></p>
    <a class="piece piece--sticky" href="#now"><span class="sticky__label">Now</span><span class="sticky__text">${esc(now.sticky)}.</span><span class="sticky__go">${icon('arrow')}<span class="sr">Read the now note</span></span></a>
    <p class="piece piece--selfstamp" data-drag aria-hidden="true">Self-taught</p>
    <div class="stamps" data-stamps aria-hidden="true"></div>
  </div>

  <div class="tools" role="toolbar" aria-label="Things to play with on the cover">
    <button type="button" class="tool" data-stamp-tool aria-pressed="false">${icon('stamp')}<span>Stamp</span></button>
    <button type="button" class="tool" data-tidy>${icon('tidy')}<span>Tidy</span></button>
    <button type="button" class="tool tool--bell" data-bell>${icon('bell')}<span>Ring</span></button>
    <p class="tools__status sr" role="status" aria-live="polite" data-tools-status></p>
  </div>
  <nav class="toc" aria-label="In this copy">
    <p class="toc__title">In this copy</p>
    <ol>${sections.map(([id, t], i) => `<li><a href="#${id}"><span class="toc__n">${String(i + 1).padStart(2, '0')}</span> ${t}</a></li>`).join('')}</ol>
  </nav>
</section>

<section class="sec now" id="now" aria-labelledby="now-h">
${secHead('01', 'now-h', 'Now', 'one thing at a time')}
${nowBlock(now)}
</section>

<section class="sec journey" id="clocked-in" aria-labelledby="journey-h">
${secHead('02', 'journey-h', esc(journey.title), 'every job, in order')}
<p class="sec__lede">${esc(journey.lede)}</p>
${timeCard(journey, site)}
</section>

<section class="sec syllabus" id="syllabus" aria-labelledby="syllabus-h">
${secHead('03', 'syllabus-h', 'Self-taught syllabus', 'no exams, lots of homework')}
<p class="sec__lede">${esc(syllabus.intro)}</p>
<div class="notebook">
  <div class="notebook__cols" aria-hidden="true"><span>Subject</span><span>What it covered</span><span>Where it shows</span><span>Status</span></div>
  <ol class="subjects">
${syllabus.subjects.map((s) => `    <li class="subject">
      <h3 class="subject__name">${esc(s.subject)}</h3>
      <dl class="subject__dl">
        <div><dt>What it covered</dt><dd>${esc(s.topics)}</dd></div>
        <div><dt>Where it shows</dt><dd>${esc(s.proof)}</dd></div>
        <div><dt>Status</dt><dd class="subject__status">${esc(s.status)}</dd></div>
      </dl>
    </li>`).join('\n')}
  </ol>
  <p class="remark"><span class="remark__label">Remark</span> <span class="hand remark__text">${esc(syllabus.remark)}</span></p>
</div>
</section>

<section class="sec shelf" id="shelf" aria-labelledby="shelf-h">
${secHead('04', 'shelf-h', 'Shelf', 'when I’m not working')}
<div class="shelf__grid${shelf.items.length ? '' : ' shelf__grid--solo'}">
  <figure class="tape" aria-labelledby="tape-cap">
    <img class="tape__img" src="/assets/img/cassette.webp" width="354" height="235" alt="" loading="lazy" decoding="async">
    <figcaption id="tape-cap" class="tape__label">${esc(shelf.tape.label)}</figcaption>
    <ol class="tape__tracks">${shelf.tape.tracks.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
  </figure>
${shelf.items.length ? `  <ul class="shelf__items">
${shelf.items.map((it) => `    <li><span class="shelf__label">${esc(it.label)}</span> ${esc(it.text)}</li>`).join('\n')}
  </ul>` : ''}
</div>
</section>

<section class="sec bench" id="made" aria-labelledby="made-h">
${secHead('05', 'made-h', 'Things I’ve made', 'the stamp says where it is')}
<ul class="cards">
${bench.map(benchCard).join('\n')}
</ul>
</section>

<section class="sec card-sec" id="card" aria-labelledby="card-h">
${secHead('06', 'card-h', 'Take a card', 'like the ones on a shop counter')}
<div class="share" data-share>
  <div class="share__prompt" role="group" aria-labelledby="share-title">
    <p class="share__app" aria-hidden="true">${icon('card')} Visiting card</p>
    <p class="share__title" id="share-title">${esc(site.name)} would like to share a contact card.</p>
    <div class="share__actions">
      <button type="button" class="share__btn" data-share-decline>Decline</button>
      <a class="share__btn share__btn--yes" href="/nikhil-patil.vcf" download data-share-accept>Accept</a>
    </div>
    <p class="share__status" role="status" aria-live="polite" data-share-status></p>
  </div>
  <div class="vcard" data-vcard>
    <div class="vcard__top">
      <img class="vcard__photo" src="${site.photo.src}" width="${site.photo.width}" height="${site.photo.height}" alt="" loading="lazy" decoding="async">
      <div>
        <p class="vcard__name">${esc(site.name)}</p>
        <p class="vcard__role">Self-taught builder · ${esc(site.jobTitle)}, ${linkTo(site.worksFor.url, site.worksFor.name)}</p>
        <p class="vcard__place">${esc(site.location.city)}, ${esc(site.location.country)}</p>
      </div>
    </div>
    ${profileLinks(site, 'links vcard__links')}
  </div>
</div>
</section>`;

  return {
    path: '/',
    title: `${site.name}: self-taught founder of Smelloff, Hyderabad`,
    ogTitle: `${site.name}, Hyderabad`,
    description: site.description,
    bodyClass: 'home',
    body,
    ld: [
      { '@type': 'WebSite', '@id': `${ctx.site}#website`, url: ctx.site, name: site.name, inLanguage: site.lang, publisher: { '@id': site.personId } },
      { '@type': 'ProfilePage', '@id': `${ctx.site}#profile`, url: ctx.site, name: site.name, dateCreated: isoDateTime(site.created), dateModified: isoDateTime(ctx.printed), isPartOf: { '@id': `${ctx.site}#website` }, mainEntity: personLd(c, ctx) },
    ],
  };
}

function faq(s) {
  return [
    ['Who is Nikhil Patil?', `Nikhil Patil (full name ${s.alternateName[0]}) is a self-taught builder based in Hyderabad, India, and the founder of his startup, Smelloff.`],
    ['Which Nikhil Patil is this?', `There are many people named Nikhil Patil. This one lives in Hyderabad and founded Smelloff. His accounts are X @Nikhilxpatil, LinkedIn in/jogdhande and Product Hunt @nikhilpatil; any other profile isn’t him.`],
    ['Where is Nikhil Patil based?', 'Hyderabad, Telangana, India.'],
    ['What does Nikhil Patil do?', 'He runs his startup, Smelloff, and does most of the work himself: the product, the packaging, the website (built with AI coding tools), the shipping and the customer inbox.'],
    ['Did Nikhil Patil go to college?', 'No. He studied up to Class 10 and has taught himself everything since, on the job and by building things.'],
    ['What did Nikhil Patil do before Smelloff?', 'He worked a mobile shop counter, did deliveries, worked in cloud-kitchen operations at Zomato Everyday for about a year and a half, and became a team lead.'],
    ['How do I contact Nikhil Patil?', `Email ${s.email.address} or message @Nikhilxpatil on X.`],
  ];
}

function aboutPage(c, ctx) {
  const s = c.site;
  const qa = faq(s);
  const body = `
<article class="page about" aria-labelledby="about-h">
  <header class="page__head page__head--photo">
    <div>
      <p class="kicker">About</p>
      <h1 id="about-h" class="page__title">About Nikhil Patil</h1>
      <p class="lede">I’m Nikhil Patil, a self-taught builder in Hyderabad, India. My full name is Jogdhande Nikhil Patil. I stopped school after Class 10, worked my way through a lot of jobs, and now run my own startup.</p>
    </div>
    <figure class="print print--about">
      ${picture({ src: '/assets/img/me/nikhil-patil-yellow-jacket.webp', avif: '/assets/img/me/nikhil-patil-yellow-jacket.avif', width: 480, height: 480, alt: 'Nikhil Patil in a yellow jacket, smiling.' }, { priority: true })}
      <figcaption class="hand">me, in my yellow jacket era</figcaption>
    </figure>
  </header>
  <div class="page__grid">
    <aside class="facts" aria-labelledby="facts-h">
      <h2 id="facts-h" class="facts__title">The short version</h2>
      <dl>
        <div><dt>Name</dt><dd>${esc(s.name)}</dd></div>
        <div><dt>Full name</dt><dd>${esc(s.alternateName[0])}</dd></div>
        <div><dt>Based in</dt><dd>${esc(s.location.city)}, ${esc(s.location.region)}, ${esc(s.location.country)}</dd></div>
        <div><dt>School</dt><dd>Up to Class 10. Self-taught since.</dd></div>
        <div><dt>Before</dt><dd>Shop counter, deliveries, cloud kitchens, team lead</dd></div>
        <div><dt>Now</dt><dd>Founder of my startup, ${linkTo(s.worksFor.url, s.worksFor.name)}</dd></div>
      </dl>
      <p class="facts__stamp" aria-hidden="true">Checked copy</p>
    </aside>
    <div class="prose">
      <h2 id="who">Who is Nikhil Patil?</h2>
      <p class="answer"><strong>${esc(qa[0][1])}</strong> He left school after Class 10 and learned the rest on the job.</p>

      <h2 id="school">School stopped at Class 10</h2>
      <p>I didn’t go the usual school and college route. After Class 10 I started working, and everything I know since then I learned because a job, or something I was building, needed it. My <a href="/#syllabus">self-taught syllabus</a> lists the subjects.</p>

      <h2 id="jobs">The jobs</h2>
      <p>I’ve worked behind a mobile shop counter, done deliveries, and worked in cloud-kitchen operations at Zomato Everyday for about a year and a half. Somewhere in there I asked for a chance at the computer, went from cleaning and floor work to registers and spreadsheets, and later led a team. The whole <a href="/#clocked-in">time card</a> is on the cover page.</p>

      <h2 id="now">What I do now</h2>
      <p>I run my own startup, Smelloff, from Hyderabad, with my friend Vineeth Kumar Duggepogu, whom I met at a job interview. I do most of the work myself: the product, the packaging, the website, the shipping and the customer inbox. I built its website too, with AI coding tools.</p>

      <h2 id="how">How I work</h2>
      <ul>
        <li><strong>One main thing at a time.</strong> Everything else waits in a parking lot. My <a href="/now">/now page</a> says what the one thing is.</li>
        <li><strong>I learn by building.</strong> If I don’t understand how something works, I build a small version of it until I do.</li>
        <li><strong>Facts live in one place.</strong> An AI rebuild once put wrong information on my store. Since then every claim is checked against one source of truth before it ships.</li>
        <li><strong>I build with AI, and I write its rules.</strong> Most of my code is written with Claude Code. I decide what goes in and check what comes out.</li>
      </ul>

      <h2 id="likes">When I’m not working</h2>
      <p>Anime: Hajime no Ippo, Attack on Titan, Mob Psycho 100, Dandadan and Sakamoto Days.</p>

      <h2 id="questions">Questions people ask</h2>
      <div class="qa">
${qa.slice(1).map(([q, a]) => `        <h3>${esc(q)}</h3>\n        <p>${esc(a)}</p>`).join('\n')}
      </div>

      <h2 id="bio">Bio to copy</h2>
      <p>For a post, an interview or an introduction. Please use these words as they are.</p>
      <div class="bios">
        <figure class="bio"><figcaption>One line</figcaption><blockquote><p data-bio>${esc(s.bios.line)}</p></blockquote><button type="button" class="bio__copy" data-copy hidden>Copy</button></figure>
        <figure class="bio"><figcaption>Short</figcaption><blockquote><p data-bio>${esc(s.bios.short)}</p></blockquote><button type="button" class="bio__copy" data-copy hidden>Copy</button></figure>
      </div>

      <h2 id="elsewhere">Find me elsewhere</h2>
      <p>These are my accounts. If a profile isn’t listed here, it isn’t me: there are a lot of Nikhil Patils.</p>
      ${profileLinks(s)}

      <h2 id="credits">Picture credits</h2>
      <p>The photos of me are mine. The cut-outs on the cover are free-licence photos from Wikimedia Commons:</p>
      <ul>${c.credits.map((k) => `<li>${esc(k.what)}: <a href="${attr(k.url)}" rel="noopener">“${esc(k.title)}”<span class="ext" aria-hidden="true">↗</span></a> by ${esc(k.author)}, ${esc(k.licence)}.</li>`).join('')}</ul>
    </div>
  </div>
</article>`;
  return {
    path: '/about',
    title: `About Nikhil Patil (Jogdhande Nikhil Patil), Hyderabad`,
    description: `${s.name} (${s.alternateName[0]}) is a self-taught builder in Hyderabad. School to Class 10, then shop counters, deliveries, cloud kitchens and now his own startup.`,
    ogType: 'profile',
    bodyClass: 'inner',
    body,
    ld: [
      { '@type': 'FAQPage', '@id': `${ctx.url('/about')}#faq`, mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'AboutPage', '@id': `${ctx.url('/about')}#page`, url: ctx.url('/about'), name: `About ${s.name}`, dateModified: isoDateTime(ctx.printed), about: { '@id': s.personId }, isPartOf: { '@id': `${ctx.site}#website` } },
      breadcrumbLd(ctx, [[s.name, '/'], ['About', '/about']]),
    ],
  };
}

function nowPage(c, ctx) {
  const body = `
<article class="page now-page" aria-labelledby="now-title">
  <header class="page__head">
    <p class="kicker">Now</p>
    <h1 id="now-title" class="page__title">What I’m doing now</h1>
    <p class="lede">One main thing, at most two on the side. Everything else is parked until the main thing works.</p>
  </header>
  ${nowBlock(c.now, { full: true })}
  <div class="prose now-page__foot">
    <p>This is a <a href="https://nownownow.com/about" rel="noopener">/now page<span class="ext" aria-hidden="true">↗</span></a>: a short note on what I’m focused on, updated when it changes.</p>
  </div>
</article>`;
  return {
    path: '/now',
    title: `Now: what ${c.site.name} is working on`,
    description: `What ${c.site.name} is focused on right now, updated ${humanDate(c.now.updated)}: ${c.now.main}`,
    bodyClass: 'inner',
    body,
    ld: [breadcrumbLd(ctx, [[c.site.name, '/'], ['Now', '/now']])],
  };
}

function notePage(c, ctx, n) {
  const p = `/notes/${n.slug}`;
  const credits = n.slug === 'how-this-site-is-made' ? `
  <section class="prose credits" aria-labelledby="credits-h">
    <h2 id="credits-h">Picture credits</h2>
    <ul>${c.credits.map((k) => `<li>${esc(k.what)}: <a href="${attr(k.url)}" rel="noopener">“${esc(k.title)}”<span class="ext" aria-hidden="true">↗</span></a> by ${esc(k.author)}, ${esc(k.licence)}, via Wikimedia Commons.</li>`).join('')}
    <li>Photos of Nikhil: his own.</li></ul>
  </section>` : '';
  const body = `
<article class="page note" aria-labelledby="note-title">
  <header class="page__head">
    <p class="kicker"><a href="/">Cover</a> · Note</p>
    <h1 id="note-title" class="page__title">${esc(n.title)}</h1>
    <p class="page__meta"><time datetime="${n.date}">${humanDate(n.date)}</time> · ${n.minutes} min read · by ${esc(c.site.name)}</p>
  </header>
  <div class="prose note__body">
${n.html}
  </div>${credits}
  <p class="more"><a class="btn" href="/">Back to the cover ${icon('arrow')}</a></p>
</article>`;
  return {
    path: p,
    title: `${n.title} · ${c.site.name}`,
    description: n.description,
    ogType: 'article',
    bodyClass: 'inner',
    body,
    ld: [
      { '@type': 'BlogPosting', '@id': `${ctx.url(p)}#post`, headline: n.title, description: n.description, datePublished: isoDateTime(n.date), dateModified: isoDateTime(n.updated || n.date), inLanguage: c.site.lang, url: ctx.url(p), mainEntityOfPage: ctx.url(p), author: { '@type': 'Person', '@id': c.site.personId, name: c.site.name, url: ctx.site }, image: ctx.abs('/assets/img/og.jpg') },
      breadcrumbLd(ctx, [[c.site.name, '/'], [n.title, p]]),
    ],
  };
}

/* ---------- machine files */

const sitemap = (ctx, pages) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url><loc>${ctx.url(p.path)}</loc><lastmod>${p.lastmod}</lastmod>${p.path === '/' ? `<image:image><image:loc>${ctx.abs('/assets/img/me/nikhil-patil.webp')}</image:loc></image:image>` : ''}</url>`).join('\n')}
</urlset>
`;

function vcard(c, ctx) {
  const s = c.site;
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${s.familyName};${s.givenName};;;`, `FN:${s.name}`,
    `ORG:${s.worksFor.name}`, `TITLE:${s.jobTitle}`,
    `EMAIL;TYPE=INTERNET,WORK:${s.email.address}`,
    `URL:${ctx.site}`, ...s.profiles.filter((p) => p.sameAs).map((p) => `URL:${p.url}`),
    `ADR;TYPE=WORK:;;;${s.location.city};${s.location.region};;${s.location.country}`,
    'NOTE:Self-taught builder in Hyderabad.',
    'END:VCARD',
  ].join('\r\n') + '\r\n';
}

// Markdown twins of the pages, for AI assistants and agents that read text
// (llmstxt.org suggests a .md next to each page). Built from the same HTML, so
// they can never say something the page doesn't. Decorative bits (aria-hidden,
// ballpoint notes, toys, in-page nav) are dropped.
function dropElements(html, test) {
  const open = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let out = html, m;
  open.lastIndex = 0;
  while ((m = open.exec(out))) {
    const [tagText, tag, attrs] = m;
    if (!test(tag.toLowerCase(), attrs) || /\/>$/.test(tagText) || /^(img|br|source|input|meta|link)$/i.test(tag)) continue;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = m.index + tagText.length;
    let depth = 1, r;
    while (depth && (r = re.exec(out))) depth += r[1] ? -1 : 1;
    const end = r ? r.index + r[0].length : out.length;
    out = out.slice(0, m.index) + out.slice(end);
    open.lastIndex = m.index;
  }
  return out;
}

const decode = (t) => t.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function htmlToMarkdown(html, ctx) {
  const abs = (h) => (/^https?:|^mailto:/.test(h) ? h : h.startsWith('/') ? ctx.origin + h : null);
  let t = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|button|template)\b[\s\S]*?<\/\1>/gi, '');
  t = dropElements(t, (tag, a) => /aria-hidden="true"/.test(a) || /role="toolbar"/.test(a) || tag === 'nav'
    || /class="(sr|issue|[^"]*\bpiece--sticky)\b/.test(a));
  t = t.replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi, (_, k, v) => `<li>**${k.trim()}:** ${v.trim()}</li>`);
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/<img\b[^>]*>/gi, (img) => {
    const alt = (img.match(/\balt="([^"]*)"/) || [])[1];
    const src = abs((img.match(/\bsrc="([^"]*)"/) || [])[1] || '');
    return alt && src ? `\n\n![${alt}](${src})\n\n` : '';
  });
  t = t.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, txt) => {
    const u = abs(h); const inner = txt.replace(/<[^>]+>/g, '').trim();
    return u && inner ? `[${inner}](${u})` : inner;
  });
  t = t.replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, x) => `\n\n${'#'.repeat(+n)} ${x.replace(/<[^>]+>/g, '').trim()}\n\n`);
  t = t.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**').replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  t = t.replace(/<li\b[^>]*>/gi, '\n- ').replace(/<blockquote\b[^>]*>/gi, '\n\n> ');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|section|header|footer|figure|figcaption|ul|ol|dl|dt|dd|table|tr|article|aside|details|summary|blockquote)\b[^>]*>/gi, '\n\n');
  t = decode(t.replace(/<\/(span|time|mark|small|abbr|code)>/gi, ' ').replace(/<[^>]+>/g, ''));
  return t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .split('\n').filter((l) => l !== '-').join('\n')
    .replace(/ +([.,:;!?)])/g, '$1').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const mdPath = (pagePath) => (pagePath === '/' ? '/index.md' : pagePath + '.md');

function pageMarkdown(c, ctx, page, html) {
  const main = (html.match(/<main\b[^>]*>([\s\S]*)<\/main>/) || [])[1] || '';
  return `---
title: ${JSON.stringify(page.title)}
description: ${JSON.stringify(page.description)}
url: ${ctx.url(page.path)}
author: ${c.site.name}
---

${htmlToMarkdown(main, ctx)}`;
}

// Everything on the site as one text file (the llms-full.txt convention).
function llmsFull(c, ctx, docs) {
  return `# ${c.site.name}: the whole site as text

> ${c.site.disambiguation} ${c.site.description} Source: ${ctx.site}. Updated ${ctx.printed}.

${docs.map(({ page, md }) => `\n---\n\n<!-- ${ctx.url(page.path)} -->\n\n${md.replace(/^---[\s\S]*?---\n\n/, '')}`).join('\n')}`;
}

// A plain-text fact sheet for language models (llmstxt.org format).
function llms(c, ctx) {
  const s = c.site;
  return `# ${s.name}

> ${s.disambiguation} ${s.description}

${faq(s).map(([q, a]) => `- **${q}** ${a}`).join('\n')}

## Pages
- [${s.name}](${ctx.site}): the cover page
- [About ${s.name}](${ctx.url('/about')}): facts, jobs, how he works, questions
- [Now](${ctx.url('/now')}): what he is working on, updated ${c.now.updated}

## Optional
- [The whole site as one text file](${ctx.url('/llms-full.txt')})
- Each page as Markdown: ${['/', '/about', '/now'].map((p) => ctx.site + mdPath(p)).join(' · ')}

## Profiles (these are his; others with the same name are not)
${s.profiles.map((p) => `- ${p.label}: ${p.url}`).join('\n')}
`;
}

/* ---------- build */

// The day the site's words, photos or look last changed, in IST: the last commit
// that touched content/, src/, assets/ or this file. It is the "printed" date,
// the ProfilePage/AboutPage dateModified and the sitemap lastmod. It used to be
// the build date, so every deploy (several a day, most of them shop changes)
// told Google the profile had changed; Google stops trusting a lastmod that is
// always "today". No git (or a shallow clone without that commit): today, as before.
export function contentDate(floor = '') {
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  let day = today;
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', 'content', 'src', 'assets', 'build.mjs'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const t = Date.parse(iso);
    if (Number.isFinite(t)) day = new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);
  } catch { /* no git here */ }
  if (day > today) day = today;
  return floor && day < floor ? floor : day;
}

/**
 * @param {object} o
 * @param {string} o.outDir       where the pages go (index.html = the base path)
 * @param {string} o.sitemapFile  where the sitemap goes (a root-level file on the host)
 */
export function build({ outDir = path.join(ROOT, 'dist', 'NikhilPatil'), sitemapFile, siteUrl, basePath, printed } = {}) {
  const c = loadContent();
  const origin = (siteUrl || process.env.SITE_URL || c.site.url).replace(/\/+$/, '');
  basePath = basePath ?? c.site.basePath;
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw new Error(`site url must be https://host, got "${origin}"`);
  if (!/^\/[A-Za-z0-9-]+$/.test(basePath)) throw new Error(`basePath must look like /Name, got "${basePath}"`);
  printed = printed || process.env.PRINTED_DATE || contentDate(c.site.created);
  sitemapFile = sitemapFile || path.join(path.dirname(outDir), 'sitemap-nikhil-patil.xml');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const assets = copyAssets(outDir, basePath);
  const site = origin + basePath;
  const ctx = {
    origin, basePath, site, printed, assets,
    url: (p) => site + (p === '/' ? '' : p),
    abs: (p) => site + (assets[p] || p),
  };

  const pages = [
    { ...homePage(c, ctx), lastmod: printed },
    { ...aboutPage(c, ctx), lastmod: printed },
    { ...nowPage(c, ctx), lastmod: c.now.updated },
    ...c.notes.map((n) => ({ ...notePage(c, ctx, n), lastmod: n.updated || n.date })),
  ];
  const docs = [];
  for (const page of pages) {
    const file = page.path === '/' ? 'index.html' : page.path.slice(1) + '.html';
    const target = path.join(outDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const html = withBase(layout(c, ctx, page), basePath, assets);
    fs.writeFileSync(target, html);
    const md = pageMarkdown(c, ctx, page, html);
    fs.writeFileSync(path.join(outDir, mdPath(page.path).slice(1)), md);
    docs.push({ page, md });
  }
  fs.writeFileSync(path.join(outDir, 'llms-full.txt'), llmsFull(c, ctx, docs));
  fs.mkdirSync(path.dirname(sitemapFile), { recursive: true });
  fs.writeFileSync(sitemapFile, sitemap(ctx, pages));
  fs.writeFileSync(path.join(outDir, 'nikhil-patil.vcf'), vcard(c, ctx));
  fs.writeFileSync(path.join(outDir, 'llms.txt'), llms(c, ctx));
  return { outDir, sitemapFile, site, pages: pages.map((p) => p.path), printed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = build();
  console.log(`Built ${r.pages.length} pages for ${r.site} into ${path.relative(process.cwd(), r.outDir)} (printed ${r.printed})`);
}
