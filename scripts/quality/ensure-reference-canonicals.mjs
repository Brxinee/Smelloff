import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pages = [
  { file: 'index.html', canonical: 'https://smelloff.in/' },
  { file: 'odorstrike.html', canonical: 'https://smelloff.in/odorstrike' },
];

for (const { file, canonical } of pages) {
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, 'utf8');
  const tag = `<link rel="canonical" href="${canonical}">`;

  if (/<link\s+[^>]*rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i, tag);
  } else if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  } else {
    throw new Error(`${file}: missing </head> and cannot insert canonical`);
  }

  fs.writeFileSync(fullPath, html);
  console.log(`Canonical ensured: ${file} -> ${canonical}`);
}
