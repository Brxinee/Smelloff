import fs from 'fs';
import path from 'path';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const redirects = vercel.redirects.map(r => r.source);

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'scripts', 'docs', 'api', 'supabase', '_shared', 'emails', 'admin', 'outreach', '.thumbnail-sources', '.vercel'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk('.');

for (const file of htmlFiles) {
  let rel = path.relative('.', file).split(path.sep).join('/');
  rel = rel.replace(/\.html$/, '');
  if (rel === 'index') rel = '/';
  else rel = '/' + rel.replace(/\/index$/, '');
  
  if (redirects.includes(rel)) {
    console.log('File matches redirect source:', file, rel);
  }
}
