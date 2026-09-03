#!/usr/bin/env node
/**
 * RSS 2.0 feed of published guides. Perplexity, Bing and some LLM fetchers
 * still subscribe to feeds. Google Search does not rank RSS; this is for
 * answer engines and recrawl hints.
 *
 *   node scripts/seo/generate-feed.mjs
 *   node scripts/seo/generate-feed.mjs --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');
const ORIGIN = 'https://smelloff.in';
const BLOG = path.join(REPO, 'blog');

const esc = (s) =>
  String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');

function meta(html, re) {
  return (html.match(re) || [null, ''])[1].trim();
}

const items = fs
  .readdirSync(BLOG)
  .filter((n) => n.endsWith('.html') && n !== 'index.html')
  .map((name) => {
    const html = fs.readFileSync(path.join(BLOG, name), 'utf8');
    if (/noindex/i.test(html)) return null;
    const slug = name.replace(/\.html$/i, '');
    const title = meta(html, /<title>([^<]+)/i) || slug;
    const desc = meta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
    const date =
      meta(html, /"dateModified"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})/) ||
      meta(html, /property=["']article:modified_time["'][^>]+content=["']([0-9-]{10})/) ||
      meta(html, /property=["']article:published_time["'][^>]+content=["']([0-9-]{10})/) ||
      '2026-09-03';
    return { slug, title, desc, date, loc: `${ORIGIN}/blog/${slug}` };
  })
  .filter(Boolean)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

const lastBuild = items[0]?.date || new Date().toISOString().slice(0, 10);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Smelloff — fabric odor guides</title>
    <link>${ORIGIN}/blog</link>
    <description>Clothes-only odor guides from Smelloff / ODORSTRIKE. Not for sofas, rooms, skin or pets.</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date(lastBuild + 'T00:00:00+05:30').toUTCString()}</lastBuildDate>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${it.loc}</link>
      <guid isPermaLink="true">${it.loc}</guid>
      <pubDate>${new Date(it.date + 'T00:00:00+05:30').toUTCString()}</pubDate>
      <description>${esc(it.desc)}</description>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;

const dest = path.join(REPO, 'feed.xml');
const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
if (CHECK) {
  if (current !== xml) {
    console.error('feed.xml is stale — run: node scripts/seo/generate-feed.mjs');
    process.exit(1);
  }
  console.log(`RSS feed: clean (${items.length} items)`);
} else if (current !== xml) {
  fs.writeFileSync(dest, xml);
  console.log(`wrote feed.xml (${items.length} items)`);
} else {
  console.log(`feed.xml up to date (${items.length} items)`);
}
