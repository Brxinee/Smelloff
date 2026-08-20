import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources', '_shared', 'emails', 'data'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(REPO);

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (/instantly/i.test(content)) {
    content = content.replace(/instantly/gi, 'quickly');
    fs.writeFileSync(file, content);
  }
}
