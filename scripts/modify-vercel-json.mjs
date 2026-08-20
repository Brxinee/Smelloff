import fs from 'node:fs';

const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
if (!v.redirects) v.redirects = [];
v.redirects.push(
  {"source": "/blog/beta-cyclodextrin-odor-removal-science", "destination": "/blog/hpbcd-cyclodextrin-fabric-odor", "permanent": true},
  {"source": "/blog/remove-smell-from-blazer-without-dry-cleaning", "destination": "/blog/keep-office-trousers-fresh-without-washing", "permanent": true},
  {"source": "/blog/remove-smell-from-hoodie-without-washing", "destination": "/blog/keep-office-trousers-fresh-without-washing", "permanent": true}
);
fs.writeFileSync('vercel.json', JSON.stringify(v, null, 2));
