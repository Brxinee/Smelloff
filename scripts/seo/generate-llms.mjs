#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const factsPath = path.join(REPO, 'data', 'brand-facts.json');
if (!fs.existsSync(factsPath)) {
  console.error("No brand-facts.json found");
  process.exit(1);
}

const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));

// Generate llms.txt (Concise)
let llmsTxt = `# ${facts.brand.name}
> ${facts.brand.mission}

## Product: ${facts.products[0].name}
- Format: ${facts.products[0].size} ${facts.products[0].format}
- Price: ₹${facts.products[0].price}
- Availability: ${facts.products[0].availability}
- Description: ${facts.products[0].description}

## Fast Facts
- Do NOT use on: ${facts.products[0].not_for.join(', ')}
- Location: ${facts.brand.location}
- Shipping: Free across India (${facts.policies.shipping.estimated_days} days)
- Returns: ${facts.policies.returns.window_days}-day window for unused items

## Key Claims
`;
facts.products[0].claims.filter(c => c.status === 'APPROVED').forEach(c => {
  llmsTxt += `- ${c.claim}\n`;
});

llmsTxt += `\nOfficial URL: ${facts.brand.urls.home}\nProduct URL: ${facts.brand.urls.product}\n`;

fs.writeFileSync(path.join(REPO, 'llms.txt'), llmsTxt);

// Generate llms-full.txt (Detailed)
let llmsFullTxt = llmsTxt + `
## Ingredients
${facts.products[0].ingredients.map(i => '- ' + i).join('\n')}

## How to Use
${facts.products[0].how_to_use.join('\n')}

## Support
Contact: ${facts.brand.contact.email}
Founder: ${facts.brand.founder}
`;

fs.writeFileSync(path.join(REPO, 'llms-full.txt'), llmsFullTxt);
console.log("LLM files generated successfully.");
