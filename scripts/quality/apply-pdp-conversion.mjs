import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'odorstrike.html');
const START = '<!-- PDP-CONVERSION-LAYER:START -->';
const END = '<!-- PDP-CONVERSION-LAYER:END -->';

function apply() {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = html.replace(/\n?<!-- PDP-CONVERSION-LAYER:START -->[\s\S]*?<!-- PDP-CONVERSION-LAYER:END -->\n?/g, '\n');
  html = html.replace(/\n?\s*<link rel="stylesheet" href="\/assets\/css\/pdp-conversion\.css[^"]*">\n?/g, '\n');

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('PDP conversion layer stripped (Stage 6 so-pdp is canonical).');
  } else {
    console.log('PDP conversion layer already absent.');
  }
}

function check() {
  const html = fs.readFileSync(file, 'utf8');
  const errors = [];

  if (html.includes(START) || html.includes(END) || /class="pdp-conv/.test(html)) {
    errors.push('Legacy PDP conversion layer still present.');
  }
  if (/pdp-conversion\.css/.test(html)) {
    errors.push('pdp-conversion.css still linked.');
  }
  if (!/\bso-pdp\b/.test(html)) errors.push('so-pdp landmark missing.');
  if (!html.includes('id="gallery"')) errors.push('#gallery missing.');
  if (!html.includes('id="buy"')) errors.push('#buy missing.');
  if (!html.includes('id="checkoutOverlay"')) errors.push('#checkoutOverlay missing.');
  if (!html.includes('window.buyNow')) errors.push('window.buyNow missing.');
  if (!html.includes('window.selectPay')) errors.push('window.selectPay missing.');
  if (!html.includes('pdp-01-hero')) errors.push('hero gallery asset missing.');
  if (!html.includes('function pdpBuy') && !html.includes('window.pdpBuy')) {
    errors.push('pdpBuy bridge missing.');
  }
  if (/Your shirt smells/.test(html)) errors.push('Legacy conversion hero remains.');
  if (/kills sweat smell in seconds|eliminate odor from clothes instantly/i.test(html)) {
    errors.push('Legacy instant-performance language remains on the PDP.');
  }
  if (/no-questions-asked|no questions asked/i.test(html)) {
    errors.push('No-questions-asked language remains on the PDP.');
  }
  if (/Triethyl Citrate prevents new odor|Zinc Gluconate stops regrowth/i.test(html)) {
    errors.push('Unapproved formulation language remains on the PDP.');
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('ODORSTRIKE PDP Stage 6 check passed.');
}

const checkOnly = process.argv.includes('--check');
if (checkOnly) check(); else apply();
