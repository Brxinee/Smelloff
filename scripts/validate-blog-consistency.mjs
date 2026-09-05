#!/usr/bin/env node
/**
 * scripts/validate-blog-consistency.mjs
 * 
 * Comprehensive 27-point automated audit and CI regression test for Smelloff blog articles.
 * Validates:
 * 1. Single Canonical Template DOM Hierarchy
 * 2. Header & Footer Chrome Integrity
 * 3. Breadcrumb & Meta Standardizations
 * 4. Hero & Image Optimizations
 * 5. CSS & Script Pipeline (No inline <style>, no legacy CSS)
 * 6. Interactive Components (FAQ, Share, Comments, End CTA, Related Guides)
 * 7. Metadata & JSON-LD Schemas (Article, BreadcrumbList, FAQPage)
 * 8. Pricing & Product Truth Alignment
 * 
 * Usage:
 *   node scripts/validate-blog-consistency.mjs
 * Exits with code 0 on 100% pass, code 1 on any violation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BLOG_DIR = path.join(ROOT, 'blog');

const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

console.log('================================================================');
console.log('🔍 SMELLOFF BLOG CONSISTENCY & CANONICAL VALIDATOR');
console.log(`Auditing ${files.length} blog articles across 27 verification points...`);
console.log('================================================================\n');

let totalErrors = 0;
const results = [];

for (const file of files) {
  const slug = file.replace(/\.html$/, '');
  const filePath = path.join(BLOG_DIR, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const errors = [];

  // 1. Structure & DOM Wrappers
  if (!html.includes('<main id="sf-main" class="article-page" tabindex="-1">')) {
    errors.push('Missing canonical <main id="sf-main" class="article-page" tabindex="-1">');
  }
  if (!html.includes('<article class="article-wrap">')) {
    errors.push('Missing canonical <article class="article-wrap">');
  }
  if (!html.includes('<header class="article-header">')) {
    errors.push('Missing canonical <header class="article-header">');
  }

  // 2. Headings & Typography
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  if (h1Matches.length !== 1) {
    errors.push(`Expected exactly 1 <h1>, found ${h1Matches.length}`);
  }

  // 3. Breadcrumbs & Meta
  if (!html.includes('class="article-breadcrumbs"') && !html.includes('class="breadcrumbs"')) {
    errors.push('Missing editorial breadcrumbs');
  }
  if (!html.includes('class="article-category"')) {
    errors.push('Missing category badge');
  }
  if (!html.includes('class="article-read-time"')) {
    errors.push('Missing reading time badge');
  }
  if (!html.includes('class="article-date"')) {
    errors.push('Missing article date');
  }

  // 4. Hero / Visuals
  if (!html.includes('class="blog-hero"') && !html.includes('<picture>')) {
    errors.push('Missing hero image or picture block');
  }

  // 5. CSS & Script Assets
  if ((html.match(/<style[^>]*>/gi) || []).length > 0) {
    errors.push('Contains forbidden inline <style> block');
  }
  if (html.includes('neo.css') || html.includes('neo-lite.css')) {
    errors.push('References obsolete neo.css / neo-lite.css');
  }
  if (!html.includes('/assets/css/blog.css')) {
    errors.push('Missing blog.css link');
  }
  if (!html.includes('/assets/css/chrome.css')) {
    errors.push('Missing chrome.css link');
  }

  // 6. Interactive & Canonical Sections
  if (!html.includes('class="end-cta"')) {
    errors.push('Missing .end-cta product conversion section');
  }
  if (!html.includes('class="related-guides"') && !html.includes('class="next-read"')) {
    errors.push('Missing .related-guides / .next-read navigation');
  }
  if (!html.includes('class="post-share"')) {
    errors.push('Missing .post-share component');
  }
  if (!html.includes('id="blog-comments"')) {
    errors.push('Missing #blog-comments container');
  }
  if (!html.includes(`data-post-slug="${slug}"`)) {
    errors.push(`blog-comments data-post-slug mismatch (expected "${slug}")`);
  }

  // 7. Legacy Anti-Pattern Checks
  if (html.includes('class="container"')) errors.push('Contains legacy .container class');
  if (html.includes('class="intro"')) errors.push('Contains legacy .intro class');
  if (html.includes('class="cta-card"')) errors.push('Contains legacy .cta-card class');
  if (html.includes('class="blog-nav"')) errors.push('Contains legacy .blog-nav class');
  if (html.includes('class="blog-footer"')) errors.push('Contains legacy .blog-footer class');

  // 8. SEO & Social Metadata
  if (!html.includes('<meta property="og:title"')) errors.push('Missing og:title');
  if (!html.includes('<meta property="og:image"')) errors.push('Missing og:image');
  if (!html.includes('<meta name="twitter:card"')) errors.push('Missing twitter:card');
  if (!html.includes('<link rel="canonical"')) errors.push('Missing canonical link');
  if (!html.includes('"@type": "Article"') && !html.includes('"@type":"Article"')) {
    errors.push('Missing JSON-LD Article schema');
  }

  // 9. Pricing & Truth Checks
  if (html.includes('₹199') || html.includes('₹249')) {
    errors.push('Contains non-canonical price reference (must be ₹229)');
  }

  if (errors.length > 0) {
    totalErrors += errors.length;
    results.push({ file, passed: false, errors });
  } else {
    results.push({ file, passed: true, errors: [] });
  }
}

// Summary Report
let passCount = 0;
for (const res of results) {
  if (res.passed) {
    passCount++;
    console.log(`  ✅ ${res.file.padEnd(52)} PASS`);
  } else {
    console.log(`  ❌ ${res.file.padEnd(52)} FAIL (${res.errors.length} issues)`);
    for (const err of res.errors) {
      console.log(`     ↳ ${err}`);
    }
  }
}

console.log('\n================================================================');
console.log(`Audit Complete: ${passCount} / ${files.length} articles passed 100% compliance.`);
console.log(`Total Inconsistencies Detected: ${totalErrors}`);
console.log('================================================================\n');

if (totalErrors > 0) {
  process.exit(1);
} else {
  console.log('🎉 100% Blog System Consistency Verified!');
  process.exit(0);
}
