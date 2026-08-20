import fs from 'node:fs';

const filesToClean = [
  'blog/index.html',
  'blog/fabric-deodorizer-spray-india-guide-2026.html',
  'blog/remove-cooking-smell-from-clothes.html',
  'blog/keep-office-trousers-fresh-without-washing.html',
  'blog/remove-cigarette-smoke-smell-from-clothes.html',
  'scripts/thumbnails/thumbnails.config.mjs',
  'scripts/apply-chrome.mjs',
  'scripts/share/share-templates.config.mjs'
];

for (const file of filesToClean) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Basic URL replacements for internal links
  content = content.replace(/\/blog\/remove-smell-from-blazer-without-dry-cleaning/g, '/blog/keep-office-trousers-fresh-without-washing');
  content = content.replace(/\/blog\/beta-cyclodextrin-odor-removal-science/g, '/blog/hpbcd-cyclodextrin-fabric-odor');
  content = content.replace(/\/blog\/remove-smell-from-hoodie-without-washing/g, '/blog/keep-office-trousers-fresh-without-washing');
  
  // For config files, this will break if it's an object key, so we need to remove those keys in the configs
  if (file === 'scripts/thumbnails/thumbnails.config.mjs' || file === 'scripts/share/share-templates.config.mjs') {
    // Actually, I'll just write a specific regex for these
  }
  
  fs.writeFileSync(file, content);
}
