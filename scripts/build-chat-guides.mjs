#!/usr/bin/env node
/* Guide catalog for the support chat (api/support-chat.js).
 *
 * The Worker has no filesystem, so the chat can't read /blog at runtime.
 * This writes shared/chat-guides.json: one row per post (slug, title, a short
 * description, a 640w thumbnail when one exists). The chat lists the
 * slugs in its prompt and shows a guide card only for a slug in this file,
 * so it can never link a post that doesn't exist.
 *
 *   node scripts/build-chat-guides.mjs           write the file
 *   node scripts/build-chat-guides.mjs --check   fail if it is stale (npm run build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shared', 'chat-guides.json');

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;|&#8217;/g, "'")
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…';
}

export function buildGuides() {
  return fs.readdirSync(path.join(ROOT, 'blog'))
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .sort()
    .map((f) => {
      const slug = f.slice(0, -5);
      const html = fs.readFileSync(path.join(ROOT, 'blog', f), 'utf8');
      const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '')
        .replace(/\s*\|\s*Smelloff$/, '').replace(/\s*\(20\d\d\)$/, '');
      const desc = shorten(decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''), 140);
      // `%40`, not `@`: Cloudflare's asset server 307s an @ path (see prepare-public.mjs).
      const thumb = fs.existsSync(path.join(ROOT, 'blog', 'assets', `${slug}@640.webp`))
        ? `/blog/assets/${slug}%40640.webp` : null;
      return { slug, title, desc, thumb };
    });
}

const json = JSON.stringify(buildGuides(), null, 1) + '\n';
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== json) {
    console.error('shared/chat-guides.json is stale. Run: node scripts/build-chat-guides.mjs');
    process.exit(1);
  }
  console.log('chat-guides: up to date');
} else {
  fs.writeFileSync(OUT, json);
  console.log(`chat-guides: wrote ${JSON.parse(json).length} guides`);
}
