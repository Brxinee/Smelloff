#!/usr/bin/env node
// Ping IndexNow (Bing/Copilot + partners) with all sitemap URLs.
// Run after each deploy:  node scripts/indexnow-ping.mjs
// Docs: https://www.indexnow.org/documentation
const KEY = '163974d1a8d940cf89b0ec712246c779';
const HOST = 'www.smelloff.in';

const sitemap = await fetch(`https://${HOST}/sitemap.xml`).then(r => r.text());
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urlList.length) throw new Error('No URLs found in sitemap');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList })
});
console.log(`IndexNow: submitted ${urlList.length} URLs — HTTP ${res.status}`);
if (res.status >= 400) console.error(await res.text());
