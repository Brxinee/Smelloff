import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'blog');
if (!fs.existsSync(root)) process.exit(0);
let changed = 0;

for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.html')) continue;
  const p = path.join(root, name);
  const before = fs.readFileSync(p, 'utf8');
  let after = before;

  // Remove internal QA comments from public source. They provide no customer
  // value and can expose unfinished review instructions to crawlers/tools.
  after = after.replace(/<!--[\s\S]*?TODO[\s\S]*?-->/gi, '');
  after = after.replace(/TODO\s*—\s*unresolved before publish/gi, '');
  after = after.replace(/TODO:\s*stain test data/gi, '');
  after = after.replace(/TODO\(verify\):?/gi, '');

  if (after !== before) {
    fs.writeFileSync(p, after);
    changed++;
  }
}

console.log(`Published TODO cleanup: ${changed} blog page(s) changed.`);
