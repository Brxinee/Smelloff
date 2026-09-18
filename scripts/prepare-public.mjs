import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const ROOT_FILES = [
  'index.html',
  'odorstrike.html',
  'about.html',
  'contact.html',
  'faq.html',
  'reviews.html',
  'track-order.html',
  'shipping.html',
  'returns.html',
  'refund.html',
  'cancellation.html',
  'payment-failed.html',
  'privacy.html',
  'terms.html',
  '404.html',
  'ads.txt',
  'feed.xml',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  'products.json',
  'manifest.json',
  'favicon.ico',
  'favicon-32.png',
  'apple-touch-icon.png',
  '163974d1a8d940cf89b0ec712246c779.txt',
  'google163974d1a8d940cf89b0ec712246c779.html'
];

const DIRECTORIES = ['assets', 'blog', 'solutions'];

function resetPublic() {
  fs.rmSync(PUBLIC, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC, { recursive: true });
}

function copyFile(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) throw new Error('Missing public file: ' + relativePath);
  const target = path.join(PUBLIC, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDir(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) throw new Error('Missing public directory: ' + relativePath);
  fs.cpSync(source, path.join(PUBLIC, relativePath), {
    recursive: true,
    force: true,
  });
}

resetPublic();
for (const file of ROOT_FILES) copyFile(file);
for (const dir of DIRECTORIES) copyDir(dir);

console.log('Prepared Vercel static output: public/');
console.log('Files:', fs.readdirSync(PUBLIC).length, 'top-level entries');
