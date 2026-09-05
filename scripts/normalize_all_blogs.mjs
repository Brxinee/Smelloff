#!/usr/bin/env node
/**
 * scripts/normalize_all_blogs.mjs
 * 
 * Normalizes all 48 blog posts to the canonical single-template architecture:
 * <main id="sf-main" class="article-page" tabindex="-1">
 *   <article class="article-wrap">
 *     <header class="article-header">
 *       breadcrumbs
 *       meta (category, read-time, date)
 *       h1
 *       hero picture/img
 *       dek / summary
 *     </header>
 *     ... article content (quick-answer, tables, callouts, faq, etc.) ...
 *     end-cta
 *     related-guides
 *     post-share
 *   </article>
 *   #blog-comments
 * </main>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BLOG_DIR = path.join(ROOT, 'blog');

const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

console.log(`Normalizing ${files.length} blog articles...`);

for (const file of files) {
  const slug = file.replace(/\.html$/, '');
  const filePath = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // Extract <head>
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  if (!headMatch) {
    console.error(`Missing <head> in ${file}`);
    continue;
  }
  const headHtml = headMatch[0];

  // Header and Footer Chrome markers
  const headerEnd = html.indexOf('<!-- /SF-CHROME:HEADER -->');
  const footerStart = html.indexOf('<!-- SF-CHROME:FOOTER');

  if (headerEnd === -1 || footerStart === -1) {
    console.error(`Missing Chrome markers in ${file}`);
    continue;
  }

  const headerChrome = html.slice(0, headerEnd + 26);
  const footerChrome = html.slice(footerStart);
  let inner = html.slice(headerEnd + 26, footerStart).trim();

  // Strip existing <main...> <article...> and closing tags
  inner = inner.replace(/^<main[^>]*>\s*/i, '');
  inner = inner.replace(/^<article[^>]*>\s*/i, '');
  inner = inner.replace(/\s*<\/main>\s*$/i, '');
  inner = inner.replace(/\s*<\/article>\s*$/i, '');
  inner = inner.replace(/\s*<\/main>\s*$/i, '');
  inner = inner.replace(/\s*<\/article>\s*$/i, '');

  // Extract or normalize <header class="article-header">
  let category = 'Guide';
  let readTime = '5 min read';
  let date = 'Updated: 2026';
  let h1Html = '';
  let heroHtml = '';
  let dekHtml = '';
  let breadcrumbTitle = '';

  // Check if H1 exists
  const h1Match = inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    h1Html = h1Match[0];
    const h1Clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
    breadcrumbTitle = h1Clean.length > 35 ? h1Clean.slice(0, 32) + '...' : h1Clean;
  }

  // Extract meta
  const catMatch = inner.match(/<span class="article-category">([\s\S]*?)<\/span>/i) ||
                   inner.match(/<div class="meta">([^·<]+)·/i);
  if (catMatch) category = catMatch[1].replace(/<[^>]+>/g, '').trim();

  const readMatch = inner.match(/<span class="article-read-time">([\s\S]*?)<\/span>/i) ||
                    inner.match(/·\s*(\d+\s*min read)/i);
  if (readMatch) readTime = readMatch[1].replace(/<[^>]+>/g, '').trim();

  const dateMatch = inner.match(/<span class="article-date">([\s\S]*?)<\/span>/i) ||
                    inner.match(/·\s*(Updated:\s*[^<]+)<\/div>/i);
  if (dateMatch) date = dateMatch[1].replace(/<[^>]+>/g, '').trim();

  // Extract hero image/picture
  const heroMatch = inner.match(/<picture>[\s\S]*?<\/picture>/i) ||
                    inner.match(/<img[^>]*class="[^"]*blog-hero[^"]*"[^>]*>/i);
  if (heroMatch) {
    heroHtml = heroMatch[0].trim();
  }

  // Extract dek / summary
  const dekMatch = inner.match(/<p class="article-dek">([\s\S]*?)<\/p>/i) ||
                   inner.match(/<div class="subtitle">([\s\S]*?)<\/div>/i);
  if (dekMatch) {
    const dekText = dekMatch[1].trim();
    dekHtml = `<p class="article-dek">${dekText}</p>`;
  }

  // Clean inner content: remove header, old metas, hero, old wrappers, duplicate comments/shares/ctas
  let body = inner;

  // Remove existing header block if present
  body = body.replace(/<header class="article-header">[\s\S]*?<\/header>/i, '');
  // Remove standalone meta/h1/hero/dek from start of body if not in header
  body = body.replace(/<div class="meta">[\s\S]*?<\/div>/i, '');
  body = body.replace(/<div class="article-meta">[\s\S]*?<\/div>/i, '');
  body = body.replace(/<nav class="article-breadcrumbs"[\s\S]*?<\/nav>/i, '');
  if (h1Html) body = body.replace(h1Html, '');
  if (heroHtml) body = body.replace(heroHtml, '');
  if (dekMatch) body = body.replace(dekMatch[0], '');

  // Remove legacy classes & tags
  body = body.replace(/class="intro"/g, '');
  body = body.replace(/<div class="cta-card">[\s\S]*?<\/div>/gi, ''); // legacy non-canonical CTA

  // Extract or clean existing sections
  // 1. Comments
  body = body.replace(/<!-- Comments[\s\S]*?-->/gi, '');
  body = body.replace(/<section id="blog-comments"[\s\S]*?<\/section>/gi, '');
  body = body.replace(/<script src="\/assets\/js\/blog-comments\.js[^"]*"[^>]*><\/script>/gi, '');

  // 2. Share
  let shareHtml = `<aside class="post-share" aria-label="Share this guide">
    <span class="post-share-title"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg>Share this guide</span>
    <div class="post-share-row">
      <button type="button" class="ps-btn ps-native" data-share-native hidden aria-label="Share via your apps"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg></button>
      <a class="ps-btn" data-share="whatsapp" target="_blank" rel="noopener nofollow" aria-label="Share on WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="x" target="_blank" rel="noopener nofollow" aria-label="Share on X"><img src="/assets/icon-x.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="facebook" target="_blank" rel="noopener nofollow" aria-label="Share on Facebook"><img src="/assets/icon-facebook-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="linkedin" target="_blank" rel="noopener nofollow" aria-label="Share on LinkedIn"><img src="/assets/icon-linkedin-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="telegram" target="_blank" rel="noopener nofollow" aria-label="Share on Telegram"><img src="/assets/icon-telegram-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <button type="button" class="ps-btn ps-copy" data-share-copy aria-label="Copy link"><svg class="ps-ico" viewBox="0 0 640 512" aria-hidden="true"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C81.8 372 81.8 321 113.3 289.5L225.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg><span class="ps-copy-label">Copy link</span></button>
    </div>
  </aside>`;
  body = body.replace(/<aside class="post-share"[\s\S]*?<\/aside>/gi, '');

  // 3. Related guides
  let relatedMatch = body.match(/<section class="related-guides"[\s\S]*?<\/section>/i) ||
                     body.match(/<div class="next-read"[\s\S]*?<\/div>/i) ||
                     body.match(/<section class="next-read"[\s\S]*?<\/section>/i);
  let relatedHtml = '';
  if (relatedMatch) {
    relatedHtml = relatedMatch[0];
    body = body.replace(relatedMatch[0], '');
  } else {
    relatedHtml = `<section class="related-guides"><div class="eyebrow">Related Guides</div><div class="guide-grid"><a class="guide-card" href="/blog/how-to-use-odorstrike"><span>How to Use ODORSTRIKE</span><span>→</span></a><a class="guide-card" href="/blog/odorstrike-ingredients"><span>ODORSTRIKE Ingredients</span><span>→</span></a><a class="guide-card" href="/blog/deodorant-vs-fabric-mist"><span>Deodorant vs Fabric Mist</span><span>→</span></a></div></section>`;
  }

  // 4. End CTA
  let endCtaMatch = body.match(/<div class="end-cta"[\s\S]*?<\/div>/i) ||
                    body.match(/<section class="end-cta"[\s\S]*?<\/section>/i);
  let endCtaHtml = '';
  if (endCtaMatch) {
    endCtaHtml = endCtaMatch[0];
    body = body.replace(endCtaMatch[0], '');
  } else {
    endCtaHtml = `<div class="end-cta"><div class="cta-label">FABRIC ONLY</div><h4>ODORSTRIKE — 50ml Fabric Odor Mist</h4><p class="cta-spec">Clothing-only · ₹229 prepaid · Free shipping pan-India</p><a class="buy-btn" href="/#buy">BUY ODORSTRIKE →</a></div>`;
  }

  // Clean trailing/leading whitespace and stray tags
  body = body.replace(/^\s*<\/article>/i, '').replace(/^\s*<\/main>/i, '');
  body = body.replace(/<\/article>\s*$/i, '').replace(/<\/main>\s*$/i, '');
  body = body.trim();

  // Rebuild canonical article DOM
  const canonicalArticle = `
<main id="sf-main" class="article-page" tabindex="-1">
  <article class="article-wrap">
    <header class="article-header">
      <nav class="article-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/blog">Guides</a><span class="sep">/</span><span aria-current="page">${breadcrumbTitle}</span></nav>
      <div class="article-meta">
        <span class="article-category">${category}</span>
        <span class="article-read-time">${readTime}</span>
        <span class="article-date">${date}</span>
      </div>
      ${h1Html}
      ${heroHtml}
      ${dekHtml}
    </header>

    ${body}

    ${endCtaHtml}

    ${relatedHtml}

    ${shareHtml}
  </article>

  <!-- Comments (self-contained; Supabase-backed, open commenting) -->
  <section id="blog-comments" data-post-slug="${slug}"></section>
  <script src="/assets/js/blog-comments.js?v=2" defer></script>
</main>
`;

  const newFullHtml = `${headerChrome}\n${canonicalArticle.trim()}\n${footerChrome}`;
  fs.writeFileSync(filePath, newFullHtml, 'utf8');
}

console.log('Finished normalizing all 48 blog posts.');
