#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

// Load truth data
const productsJsonPath = path.join(REPO, 'products.json');
const truthProduct = fs.existsSync(productsJsonPath) ? JSON.parse(fs.readFileSync(productsJsonPath, 'utf8')) : null;

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase', '.vercel', '.thumbnail-sources', '_shared', 'emails'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(REPO);

let errors = 0;
let productNodes = 0;
let orgNodes = 0;

for (const file of htmlFiles) {
  const rel = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8');

  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of matches) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      console.error(`[ERROR] Invalid JSON-LD syntax in ${rel}: ${e.message}`);
      errors++;
      continue;
    }

    const checkNode = (node) => {
      if (!node || typeof node !== 'object') return;
      
      const type = node['@type'];
      
      if (type === 'Organization') {
        orgNodes++;
        if (node.name && node.name !== 'Smelloff') {
          console.error(`[ERROR] Conflicting Organization name in ${rel}: ${node.name}`);
          errors++;
        }
      }
      
      if (type === 'Product' || type === 'ProductGroup') {
        productNodes++;
        
        // Validation against single source of truth if applicable
        if (truthProduct && truthProduct.items && truthProduct.items.length > 0 && node.name && node.name.includes('ODORSTRIKE')) {
          const truthItem = truthProduct.items[0];
          if (node.offers) {
            const offers = Array.isArray(node.offers) ? node.offers : (node.offers.offers || [node.offers]);
            const offer = offers[0]; // Check first offer
            if (offer && offer.price && parseFloat(offer.price) !== parseFloat(truthItem.price)) {
               if (node.offers['@type'] !== 'AggregateOffer') {
                  console.error(`[ERROR] Product price mismatch in ${rel}: JSON-LD says ${offer.price}, products.json says ${truthItem.price}`);
                  errors++;
               }
            }
          }
        }
      }
      
      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach(checkNode);
        } else if (typeof node[key] === 'object') {
          checkNode(node[key]);
        }
      }
    };

    if (Array.isArray(data)) {
      data.forEach(checkNode);
    } else {
      checkNode(data);
    }
  }
}

console.log(`Structured data audit: Checked ${htmlFiles.length} files. Found ${orgNodes} Organization nodes, ${productNodes} Product nodes.`);

if (errors > 0) {
  console.error(`\nFAILED: Found ${errors} structured data errors.`);
  process.exit(1);
} else {
  console.log('PASSED: Structured data validation clean.');
}
