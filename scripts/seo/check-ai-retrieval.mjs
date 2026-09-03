#!/usr/bin/env node
/**
 * Real AEO/LLM retrieval check against GSC 0-CTR queries and locked product
 * facts. The previous stub always printed "passed".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const llms = fs.readFileSync(path.join(REPO, 'llms.txt'), 'utf8').toLowerCase();
const full = fs.readFileSync(path.join(REPO, 'llms-full.txt'), 'utf8').toLowerCase();
const home = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8').toLowerCase();
const robots = fs.readFileSync(path.join(REPO, 'robots.txt'), 'utf8');
const feed = fs.existsSync(path.join(REPO, 'feed.xml'))
  ? fs.readFileSync(path.join(REPO, 'feed.xml'), 'utf8')
  : '';

const errors = [];
const must = (hay, needle, where) => {
  if (!hay.includes(needle.toLowerCase())) errors.push(`${where} missing “${needle}”`);
};

must(llms, 'can deodorant be used on clothes', 'llms.txt');
must(llms, 'curry', 'llms.txt');
must(llms, 'dri-fit', 'llms.txt');
must(llms, 'cyclodextrin', 'llms.txt');
must(llms, 'sofas', 'llms.txt');
must(llms, '₹229', 'llms.txt');
must(llms, 'not for skin', 'llms.txt');
must(llms, 'hyderabad', 'llms.txt');
must(llms, 'bedding', 'llms.txt');
must(llms, 'naphthalene', 'llms.txt');
must(llms, 'suitcase', 'llms.txt');
must(llms, 'polyester', 'llms.txt');
must(full, 'clothes only', 'llms-full.txt');
must(full, '₹229', 'llms-full.txt');
must(home, 'speakablespecification', 'index.html');
must(home, 'faqpage', 'index.html');
must(home, 'additionalproperty', 'index.html');
must(home, 'hasmerchantreturnpolicy', 'index.html');
must(home, 'hreflang="en-in"', 'index.html');
if (!/User-agent:\s*GPTBot/i.test(robots)) errors.push('robots.txt missing GPTBot');
if (!/User-agent:\s*Google-Extended/i.test(robots)) errors.push('robots.txt missing Google-Extended');
if (!/Sitemap:\s*https:\/\/smelloff\.in\/sitemap\.xml/.test(robots)) errors.push('robots.txt missing apex sitemap');
if (!feed.includes('<rss')) errors.push('feed.xml missing');
if (!feed.includes('https://smelloff.in/blog/gym-clothes-smell-after-washing')) {
  errors.push('feed.xml missing gym clothes URL');
}

if (errors.length) {
  console.error(`AI retrieval check failed (${errors.length}):`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('AI retrieval check passed (GSC citation answers + crawl files).');
