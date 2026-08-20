import fs from 'node:fs';

const files = [
  'vercel.json',
  'scripts/thumbnails/thumbnails.config.mjs',
  'scripts/apply-chrome.mjs',
  'scripts/share/share-templates.config.mjs'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/spray-to-remove-sweat-smell-from-clothes-instantly/g, 'spray-to-remove-sweat-smell-from-clothes-quickly');
  fs.writeFileSync(file, content);
}
