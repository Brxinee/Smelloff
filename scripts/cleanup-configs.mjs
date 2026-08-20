import fs from 'node:fs';

let tm = fs.readFileSync('scripts/thumbnails/thumbnails.config.mjs', 'utf8');
tm = tm.replace(/\{\s*slug:\s*'remove-smell-from-blazer-without-dry-cleaning'[\s\S]*?\},/g, '');
tm = tm.replace(/\{\s*slug:\s*'remove-smell-from-hoodie-without-washing'[\s\S]*?\},/g, '');
tm = tm.replace(/\{\s*slug:\s*'beta-cyclodextrin-odor-removal-science'[\s\S]*?\},/g, '');
fs.writeFileSync('scripts/thumbnails/thumbnails.config.mjs', tm);

let sh = fs.readFileSync('scripts/share/share-templates.config.mjs', 'utf8');
sh = sh.replace(/'remove-smell-from-blazer-without-dry-cleaning':\s*\{[\s\S]*?\},/g, '');
sh = sh.replace(/'remove-smell-from-hoodie-without-washing':\s*\{[\s\S]*?\},/g, '');
sh = sh.replace(/'beta-cyclodextrin-odor-removal-science':\s*\{[\s\S]*?\},/g, '');
fs.writeFileSync('scripts/share/share-templates.config.mjs', sh);

let ac = fs.readFileSync('scripts/apply-chrome.mjs', 'utf8');
ac = ac.replace(/'remove-smell-from-blazer-without-dry-cleaning', /g, '');
ac = ac.replace(/'remove-smell-from-hoodie-without-washing', /g, '');
ac = ac.replace(/'beta-cyclodextrin-odor-removal-science', /g, '');
fs.writeFileSync('scripts/apply-chrome.mjs', ac);
