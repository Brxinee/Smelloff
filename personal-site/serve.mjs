// Local preview of ./dist with the clean URLs Cloudflare serves on smelloff.in:
// /NikhilPatil → NikhilPatil/index.html, /NikhilPatil/about → about.html. No dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.vcf': 'text/vcard; charset=utf-8' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url !== '/' && url.endsWith('/')) { res.writeHead(301, { Location: url.slice(0, -1) }); return res.end(); }
  if (url === '/') { res.writeHead(302, { Location: '/NikhilPatil' }); return res.end(); }
  const candidates = [url.slice(1), url.slice(1) + '.html', url.slice(1) + '/index.html'];
  for (const c of candidates) {
    const file = path.join(DIST, c);
    if (!file.startsWith(DIST)) break;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}).listen(PORT, () => console.log(`Serving ${DIST} at http://localhost:${PORT}`));
