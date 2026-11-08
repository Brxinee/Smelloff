#!/usr/bin/env node
/**
 * Ping IndexNow (Bing / Copilot / Yandex / Naver and partners) with the
 * sitemap's URLs, so a new or changed page is pushed rather than waiting to be
 * crawled. Google does not participate in IndexNow — for Google the levers are
 * the sitemap itself and internal linking.
 *
 *   node scripts/indexnow-ping.mjs
 *
 * HOST WAS WRONG UNTIL 2026-08-03. It read `www.smelloff.in`, but the canonical
 * host is non-www (CLAUDE.md: "Canonical domain is https://smelloff.in
 * (non-www; www redirects)"). That meant this script fetched a sitemap URL that
 * 301s, and then submitted a `host` and a `keyLocation` that both redirect —
 * IndexNow's key check is a direct fetch and a redirecting key file is grounds
 * for rejecting the submission. Every URL it submitted was also a www URL that
 * canonicalises elsewhere, i.e. the opposite of what we want indexed.
 *
 * The key file must stay reachable at https://smelloff.in/<KEY>.txt and contain
 * exactly the key. It is committed at the repo root.
 */
const KEY = '163974d1a8d940cf89b0ec712246c779';
const HOST = 'smelloff.in';

// The store's sitemap and the personal site's (both named in robots.txt). The
// personal one was never submitted before 2026-11-08, so Bing (and ChatGPT
// search, which uses Bing's index) never heard about /NikhilPatil.
const SITEMAPS = [`https://${HOST}/sitemap.xml`, `https://${HOST}/sitemap-nikhil-patil.xml`];

const urlList = [];
for (const sitemapUrl of SITEMAPS) {
  const res0 = await fetch(sitemapUrl, { redirect: 'manual' });
  if (res0.status >= 300 && res0.status < 400) {
    throw new Error(
      `${sitemapUrl} redirected to ${res0.headers.get('location')} — ` +
      `submitting redirecting URLs to IndexNow wastes the submission. Fix HOST.`
    );
  }
  if (!res0.ok) throw new Error(`${sitemapUrl} answered HTTP ${res0.status}`);
  const sitemap = await res0.text();
  // `<loc>` only: `<image:loc>` entries are images, not pages.
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) throw new Error(`No URLs found in ${sitemapUrl}`);
  for (const u of locs) if (!urlList.includes(u)) urlList.push(u);
}

const offHost = urlList.filter((u) => new URL(u).host !== HOST);
if (offHost.length) {
  throw new Error(`sitemap contains URLs on another host, refusing to submit:\n  ${offHost.slice(0, 5).join('\n  ')}`);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  }),
});

console.log(`IndexNow: submitted ${urlList.length} URLs — HTTP ${res.status}`);
if (res.status >= 400) {
  console.error(await res.text());
  process.exit(1);
}
