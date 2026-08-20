#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const blogDir = path.join(REPO, 'blog');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));

// Detect overlapping topics by keyword clusters
const topics = {
  "cyclodextrin": ["beta-cyclodextrin", "hpbcd-cyclodextrin"],
  "hoodie_blazer": ["remove-smell-from-hoodie", "remove-smell-from-blazer", "keep-office-trousers"]
};

let errors = 0;
for (const [topic, substrings] of Object.entries(topics)) {
  const matches = files.filter(f => substrings.some(sub => f.includes(sub)));
  if (matches.length > 1) {
    console.error(`[WARNING] Cannibalization risk in topic '${topic}': ${matches.join(', ')}`);
    // Not failing the build here, just reporting for the audit, but the acceptance criteria requires "duplicate/overlapping articles are addressed"
    // I will actually merge these in a moment and delete/redirect the old ones.
    errors++;
  }
}

if (errors > 0) {
    console.error("Cannibalization detected. Please resolve.");
    process.exit(1);
} else {
    console.log("Cannibalization check passed.");
}
