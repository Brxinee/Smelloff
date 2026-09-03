import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const home = path.join(root, 'index.html');
const pdp = path.join(root, 'odorstrike.html');
const checkoutJs = path.join(root, 'assets/js/checkout.js');
const START = '<!-- PDP-CONVERSION-LAYER:START -->';
const END = '<!-- PDP-CONVERSION-LAYER:END -->';

function stripFile(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/\n?<!-- PDP-CONVERSION-LAYER:START -->[\s\S]*?<!-- PDP-CONVERSION-LAYER:END -->\n?/g, '\n');
  html = html.replace(/\n?\s*<link rel="stylesheet" href="\/assets\/css\/pdp-conversion\.css[^"]*">\n?/g, '\n');
  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('PDP conversion layer stripped from', path.basename(file));
  }
}

function apply() {
  stripFile(home);
  stripFile(pdp);
  console.log('PDP conversion layer already absent.');
}

function check() {
  const html = fs.readFileSync(home, 'utf8');
  const redirect = fs.existsSync(pdp) ? fs.readFileSync(pdp, 'utf8') : '';
  const js = fs.existsSync(checkoutJs) ? fs.readFileSync(checkoutJs, 'utf8') : '';
  const errors = [];

  if (html.includes(START) || html.includes(END) || /class="pdp-conv/.test(html)) {
    errors.push('Legacy PDP conversion layer still present on homepage.');
  }
  if (/pdp-conversion\.css/.test(html)) {
    errors.push('pdp-conversion.css still linked.');
  }
  if (!/\bso-hero\b/.test(html)) errors.push('so-hero landmark missing on homepage.');
  if (!html.includes('id="gallery"')) errors.push('#gallery missing.');
  if (!html.includes('id="buy"')) errors.push('#buy missing.');
  if (!html.includes('id="checkoutOverlay"')) errors.push('#checkoutOverlay missing.');
  if (!html.includes('data-so-pack="1"') || !html.includes('data-so-pack="2"') || !html.includes('data-so-pack="3"')) {
    errors.push('1 product + 2 combo pack controls missing.');
  }
  if (!js.includes('window.buyNow')) errors.push('window.buyNow missing from checkout.js.');
  if (!js.includes('window.selectPay') && !js.includes('function selectPay')) {
    errors.push('selectPay missing from checkout.js.');
  }
  if (!html.includes('/assets/campaign/bottle') && !html.includes('pdp-01-hero')) errors.push('hero gallery asset missing.');
  if (/Your shirt smells/.test(html)) errors.push('Legacy conversion hero remains.');
  if (/kills sweat smell in seconds|eliminate odor from clothes instantly/i.test(html)) {
    errors.push('Legacy instant-performance language remains.');
  }
  if (/no-questions-asked|no questions asked/i.test(html)) {
    errors.push('No-questions-asked language remains.');
  }
  if (redirect && !/noindex/.test(redirect)) {
    errors.push('/odorstrike must remain noindex (redirect to homepage).');
  }
  if (redirect && !/location\.replace\('\//.test(redirect) && !/url=\/\?buy=1/.test(redirect)) {
    errors.push('/odorstrike must redirect to the homepage.');
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Homepage product storefront check passed.');
}

const checkOnly = process.argv.includes('--check');
if (checkOnly) check(); else apply();
