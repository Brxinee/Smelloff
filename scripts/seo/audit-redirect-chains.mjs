import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const vercelJson = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));

const redirects = new Map();
if (vercelJson.redirects) {
  for (const r of vercelJson.redirects) {
    if (r.source && r.destination && !r.has) {
      redirects.set(r.source, r.destination);
    }
  }
}

console.log(`Checking ${redirects.size} vercel.json redirect rules for chains & validity...\n`);

let chains = 0;
let invalidDestinations = 0;

for (const [source, dest] of redirects.entries()) {
  if (source.includes(':') || source.includes('*') || source.includes('(')) continue;

  // Check if dest is another redirect
  if (redirects.has(dest)) {
    console.error(`REDIRECT CHAIN DETECTED: ${source} -> ${dest} -> ${redirects.get(dest)}`);
    chains++;
  }

  // Check if dest ends with .html or trailing slash or has /policies/
  if (dest.endsWith('.html')) {
    console.error(`INVALID DESTINATION (.html): ${source} -> ${dest}`);
    invalidDestinations++;
  }
  if (dest.length > 1 && dest.endsWith('/')) {
    console.error(`INVALID DESTINATION (trailing slash): ${source} -> ${dest}`);
    invalidDestinations++;
  }

  // Check if file exists for clean dest URL
  if (dest.startsWith('/') && !dest.includes(':')) {
    const cleanPath = dest.split('?')[0].replace(/^\//, '');
    let targetFile = path.join(REPO, cleanPath + '.html');
    if (cleanPath === '' || cleanPath === '/') targetFile = path.join(REPO, 'index.html');
    if (cleanPath.endsWith('/index')) targetFile = path.join(REPO, cleanPath.replace(/\/index$/, '/index.html'));

    if (!fs.existsSync(targetFile) && !fs.existsSync(path.join(REPO, cleanPath, 'index.html'))) {
      console.error(`DESTINATION FILE NOT FOUND: ${source} -> ${dest} (Expected file: ${targetFile})`);
      invalidDestinations++;
    }
  }
}

if (chains === 0 && invalidDestinations === 0) {
  console.log('All literal redirect rules are 1-step and resolve to existing 200 OK target files!');
} else {
  console.error(`Audit failed with ${chains} chains and ${invalidDestinations} invalid destinations.`);
}
