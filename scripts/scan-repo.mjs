import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist' || e.name === 'coverage') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const prodExts = ['.html', '.xml', '.txt', '.json', '.js', '.mjs', '.ts'];
const prodFiles = walk('.').filter(f => {
  if (f.startsWith('test/')) return false;
  if (f.startsWith('docs/')) return false;
  if (f === 'scripts/scan-repo.mjs' || f === 'scan-results.json') return false;
  return prodExts.some(ext => f.endsWith(ext));
});

const patterns = [
  { name: '579 (price)', regex: /₹\s*579\b|\b579\s*(?:rs|rupees|\/-)/i },
  { name: '10% off', regex: /10%\s*off/i },
  { name: "India's first", regex: /India['’]s\s*#?1|India['’]s\s*first/i },
  { name: 'kill/kills odor', regex: /\bkills?\s+(?:the\s+)?(?:sweat\s+)?odor/i },
  { name: 'kill/kills bacteria', regex: /\bkills?\s+(?:the\s+)?(?:skin\s+|clothing\s+)?bacteria/i },
  { name: 'kill/kills smell', regex: /\bkills?\s+(?:the\s+)?(?:sweat\s+)?smell/i },
  { name: 'antibacterial', regex: /\bantibacterial\b/i },
  { name: 'antimicrobial', regex: /\bantimicrobial\b/i },
  { name: 'biocide/biocidal', regex: /\bbiocid(?:e|al)\b/i },
  { name: 'miracle', regex: /\bmiracle\b/i },
  { name: 'odor-proof', regex: /\bodor-proof\b/i },
  { name: 'zero smell', regex: /\bzero\s+smell\b/i },
  { name: 'never stains', regex: /\bnever\s+stains\b/i },
  { name: 'award-winning', regex: /\baward-winning\b/i },
  { name: 'clinically tested', regex: /\bclinically\s+tested\b/i },
  { name: 'dermatologist tested', regex: /\bdermatologist\s+tested\b/i },
  { name: 'lab tested/certified', regex: /\blab\s+(?:tested|certified)\b/i },
  { name: 'scientifically proven', regex: /\bscientifically\s+proven\b/i },
  { name: 'four months', regex: /\bfour\s+months\b/i },
  { name: 'manual upi', regex: /\bmanual\s+upi\b/i },
  { name: 'UTR requirement', regex: /\b(?:enter|send|share|provide)\s+(?:the\s+)?UTR\b|\bUTR\s+number\b/i },
  { name: 'payment screenshot', regex: /\bpayment\s+screenshot\b/i },
  { name: 'upiInlineId', regex: /\bupiInlineId\b/i }
];

const results = [];
for (const f of prodFiles) {
  const c = fs.readFileSync(f, 'utf8');
  for (const pat of patterns) {
    const matches = [...c.matchAll(new RegExp(pat.regex, 'gi'))];
    for (const m of matches) {
      const idx = m.index;
      const snippet = c.slice(Math.max(0, idx - 40), Math.min(c.length, idx + 60)).replace(/\n/g, ' ');
      results.push({
        file: f,
        line: c.slice(0, idx).split('\n').length,
        pattern: pat.name,
        match: m[0],
        snippet
      });
    }
  }
}

fs.writeFileSync('scan-results.json', JSON.stringify(results, null, 2));
console.log(`Scan completed: ${results.length} total matches saved to scan-results.json`);
