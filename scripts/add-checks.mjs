import fs from 'node:fs';

const v = JSON.parse(fs.readFileSync('package.json', 'utf8'));

v.scripts["check:claims"] = "node scripts/seo/check-claims.mjs";
v.scripts["check:llms"] = "node scripts/seo/generate-llms.mjs";
v.scripts["check:ai-retrieval"] = "node scripts/seo/check-ai-retrieval.mjs";
v.scripts["check:search-intent"] = "node scripts/seo/check-search-intent.mjs";
v.scripts["check:cannibalization"] = "node scripts/seo/check-cannibalization.mjs";
v.scripts["check:content-quality"] = "node scripts/seo/check-content-quality.mjs";
v.scripts["check:organic-path"] = "node scripts/seo/check-organic-path.mjs";
v.scripts["check:content"] = "node scripts/seo/check-content.mjs";

fs.writeFileSync('package.json', JSON.stringify(v, null, 2));
