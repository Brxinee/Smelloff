#!/usr/bin/env node
/**
 * Content QA for Smelloff's public blog.
 *
 * This is intentionally an editorial audit, not a keyword-density checker.
 * It reports pages that are too thin, lack an answer-first opening, lack
 * evidence links, or contain retired product/formula claims.
 *
 * Usage:
 *   node scripts/seo/check-blog-content-quality.mjs
 *   node scripts/seo/check-blog-content-quality.mjs --strict
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BLOG = path.join(REPO, 'blog');
const STRICT = process.argv.includes('--strict');

const MIN_WORDS_PILLAR = 1800;
const MIN_WORDS_SUPPORT = 1200;
const ANSWER_SELECTORS = ['quick-answer', 'quick_answer', 'article-dek'];

const RETIRED_PATTERNS = [
  /zinc\s+ricinoleate/i,
  /zinc\s+pca\s*\(?\s*1\.5\s*%/i,
  /β?-?cyclodextrin\s*\(?\s*1\.5\s*%/i,
  /86\s*%\s*(distilled\s*)?water/i,
  /5\s*%\s*(ipa|isopropyl alcohol)/i,
  /1\s*%\s*fragrance/i,
];

const EXTERNAL_EVIDENCE_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'pmc.ncbi.nlm.nih.gov',
  'doi.org',
  'pubs.acs.org',
  'sciencedirect.com',
  'springer.com',
  'scjohnson.com',
  'febreze.com',
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  return text ? text.split(/\s+/).length : 0;
}

function titleOf(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
}

function hasAnswerFirst(html) {
  if (ANSWER_SELECTORS.some((name) => html.includes(`class="${name}`))) return true;
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const paragraphs = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .slice(0, 3)
    .map((m) => stripHtml(m[1]));
  const joined = paragraphs.join(' ');
  return /\b(is|are|means|because|the answer is|yes,|no,)\b/i.test(joined);
}

function externalEvidenceLinks(html) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  return hrefs.filter((href) => {
    try {
      const u = new URL(href);
      return EXTERNAL_EVIDENCE_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  });
}

const files = fs.readdirSync(BLOG)
  .filter((name) => name.endsWith('.html') && name !== 'index.html')
  .sort();

const results = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(BLOG, file), 'utf8');
  const text = stripHtml(html);
  const words = countWords(text);
  const evidence = externalEvidenceLinks(html);
  const retired = RETIRED_PATTERNS.flatMap((re) => text.match(re) ? [re.source] : []);
  const likelyPillar = /best|vs-|deodorant-vs|what-is-|how-to-|ingredient|guide|review/i.test(file);
  const minimum = likelyPillar ? MIN_WORDS_PILLAR : MIN_WORDS_SUPPORT;

  const issues = [];
  if (words < minimum) issues.push(`thin: ${words} words (house minimum ${minimum})`);
  if (!hasAnswerFirst(html)) issues.push('no clear answer-first opening');
  if (evidence.length === 0) issues.push('no external evidence/source link');
  if (retired.length) issues.push(`retired product claims: ${retired.join(', ')}`);
  if (!/<link rel="canonical"\b/i.test(html)) issues.push('missing canonical');
  if (!/<meta name="description"/i.test(html)) issues.push('missing meta description');
  if (!/<h1\b/i.test(html)) issues.push('missing H1');

  results.push({ file, title: titleOf(html), words, evidence: evidence.length, issues });
}

const failed = results.filter((r) => r.issues.length);
console.log(`Blog content QA: ${results.length - failed.length}/${results.length} clean.`);
if (failed.length) {
  for (const r of failed) {
    console.log(`\n${r.file}\n  ${r.title}\n  ${r.words} words · ${r.evidence} evidence link(s)`);
    for (const issue of r.issues) console.log(`  - ${issue}`);
  }
}

if (STRICT && failed.length) process.exit(1);
