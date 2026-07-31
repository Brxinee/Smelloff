import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BLOG_ASSETS_DIR = path.resolve('blog/assets');
const BLOG_DIR = path.resolve('blog');

async function processImages() {
  if (!fs.existsSync(BLOG_ASSETS_DIR)) {
    console.error('Blog assets directory does not exist:', BLOG_ASSETS_DIR);
    return;
  }

  const files = fs.readdirSync(BLOG_ASSETS_DIR);
  const imageFiles = files.filter(f => /\.(png|jpe?g|webp)$/i.test(f) && !f.endsWith('.avif'));

  const bases = new Set();
  for (const file of imageFiles) {
    const nameWithoutExt = path.basename(file, path.extname(file));
    bases.add(nameWithoutExt);
  }

  console.log(`[Blog Thumbnails] Processing ${bases.size} blog thumbnail assets...`);

  let totalPngBytes = 0;
  let totalWebpBytes = 0;
  let totalAvifBytes = 0;

  for (const base of bases) {
    let sourcePath = null;
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const candidate = path.join(BLOG_ASSETS_DIR, `${base}${ext}`);
      if (fs.existsSync(candidate)) {
        sourcePath = candidate;
        break;
      }
    }

    if (!sourcePath) continue;

    const avifPath = path.join(BLOG_ASSETS_DIR, `${base}.avif`);
    const webpPath = path.join(BLOG_ASSETS_DIR, `${base}.webp`);

    // Generate WebP
    if (!fs.existsSync(webpPath) || fs.statSync(sourcePath).mtime > fs.statSync(webpPath).mtime) {
      await sharp(sourcePath)
        .webp({ quality: 80 })
        .toFile(webpPath);
    }

    // Generate AVIF
    if (!fs.existsSync(avifPath) || fs.statSync(sourcePath).mtime > fs.statSync(avifPath).mtime) {
      await sharp(sourcePath)
        .avif({ quality: 65, effort: 4 })
        .toFile(avifPath);
    }

    const pngStat = fs.existsSync(path.join(BLOG_ASSETS_DIR, `${base}.png`)) ? fs.statSync(path.join(BLOG_ASSETS_DIR, `${base}.png`)).size : 0;
    const webpStat = fs.existsSync(webpPath) ? fs.statSync(webpPath).size : 0;
    const avifStat = fs.existsSync(avifPath) ? fs.statSync(avifPath).size : 0;

    totalPngBytes += pngStat;
    totalWebpBytes += webpStat;
    totalAvifBytes += avifStat;
  }

  console.log('[Blog Thumbnails] Image optimization complete:');
  if (totalPngBytes > 0) console.log(`  Total PNG size:  ${(totalPngBytes / 1024).toFixed(1)} KB`);
  console.log(`  Total WebP size: ${(totalWebpBytes / 1024).toFixed(1)} KB`);
  console.log(`  Total AVIF size: ${(totalAvifBytes / 1024).toFixed(1)} KB`);
  if (totalWebpBytes > 0) {
    const savings = ((1 - totalAvifBytes / totalWebpBytes) * 100).toFixed(1);
    console.log(`  AVIF vs WebP bandwidth savings: ${savings}%\n`);
  }

  updateHtmlPictureTags();
}

function updateHtmlPictureTags() {
  const htmlFiles = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html'));
  let updatedCount = 0;

  for (const file of htmlFiles) {
    const filePath = path.join(BLOG_DIR, file);
    let html = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Ensure CSS rule in blog/index.html covers picture tags
    if (file === 'index.html') {
      if (!html.includes('.b-card-thumb--img picture')) {
        html = html.replace(
          '.b-card-thumb--img img{',
          '.b-card-thumb--img picture{position:absolute;inset:0;width:100%;height:100%;display:block}\n  .b-card-thumb--img img{'
        );
        changed = true;
      }
    }

    // Replace <img ... src="/blog/assets/NAME.(webp|png|jpg)" ...> that is NOT already inside a <picture>
    // Match img tag
    const imgRegex = /<img\s+([^>]*?)src=["']\/blog\/assets\/([^"'?#]+)\.(webp|png|jpe?g)(\?[^"']*)?["']([^>]*?)>/gi;

    html = html.replace(imgRegex, (match, prefix, assetName, ext, query, suffix) => {
      // Check if match is preceded by <picture> or <source
      // We do a regex check on full string around the match
      const imgName = assetName;
      const q = query || '?v=2';
      const avifSrc = `/blog/assets/${imgName}.avif${q}`;
      const webpSrc = `/blog/assets/${imgName}.webp${q}`;

      // Construct picture element
      changed = true;
      return `<picture><source srcset="${avifSrc}" type="image/avif"><source srcset="${webpSrc}" type="image/webp">${match}</picture>`;
    });

    // Fix any double picture tags if ran multiple times
    html = html.replace(/<picture>\s*<picture>/gi, '<picture>');
    html = html.replace(/<\/picture>\s*<\/picture>/gi, '</picture>');

    if (changed) {
      fs.writeFileSync(filePath, html, 'utf8');
      updatedCount++;
    }
  }

  console.log(`[Blog Thumbnails] Updated ${updatedCount} HTML files with AVIF + WebP fallback <picture> tags.`);
}

processImages().catch(err => {
  console.error('[Blog Thumbnails] Error:', err);
  process.exit(1);
});
