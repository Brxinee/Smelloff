import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('production performance hardening configuration', () => {
  const routing = JSON.parse(fs.readFileSync('config/routing.json', 'utf8'));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  // Production deploys to Cloudflare Workers via `npm run build`; it must do
  // its asset work (optimize, stamp chrome, stage public/), or /assets/optimized/*
  // 404s and pages ship without stamped chrome.
  assert.equal(fs.existsSync('vercel.json'), false, 'Cloudflare-only: vercel.json must not come back');
  for (const [name, command] of [['npm run build', pkg.scripts.build]]) {
    const steps = ['optimize:critical', 'apply:chrome', 'prepare'];
    const at = steps.map((step) => command.indexOf(step));
    assert.ok(at.every((i) => i >= 0), `${name} must generate responsive assets, stamp chrome, and stage static output`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${name} must run those steps in that order`);
  }

  const globalHeader = (routing.headers || []).find((h) => h.source === '/(.*)');
  const csp = (globalHeader?.headers || []).find((h) => h.key === 'Content-Security-Policy');
  assert.ok(csp, 'global CSP must exist');
  assert.ok(
    csp.value.includes('https://static.cloudflareinsights.com'),
    'CSP must permit the Cloudflare Web Analytics beacon script',
  );

  const homepage = fs.readFileSync('index.html', 'utf8');
  assert.equal(
    homepage.includes('preconnect" href="https://tnuqjydmoxczdjnsgpci.supabase.co'),
    false,
    'homepage must not preconnect to checkout-only Supabase',
  );
  assert.ok(
    homepage.includes('/assets/odorstrike-bottle-cutout.webp'),
    'hero bottle must preserve its native high-resolution source',
  );
  const levels = [...homepage.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  levels.forEach((level, i) => {
    if (i) assert.ok(level <= levels[i - 1] + 1, `homepage heading outline skips from h${levels[i - 1]} to h${level}`);
  });

  const generator = fs.readFileSync('scripts/apply-chrome.mjs', 'utf8');
  assert.ok(generator.includes('assets/css/soft.css'), 'shared soft CSS must have a delivery path');
  assert.ok(generator.includes('assets/css/chrome.css'), 'shared chrome CSS must have a delivery path');
  assert.ok(generator.includes('rel="preload"'), 'shared CSS should start as non-render-blocking preloads');
  assert.ok(generator.includes('sf-critical-chrome'), 'critical chrome styles must remain inline for first paint');
  assert.ok(generator.includes('/assets/optimized/logo-smelloff-white-160.webp'), 'chrome generator must use optimized logo assets');
});

test('checkout markup is semantic, static, and payment-method-first', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.ok(html.includes('<h2 id="checkoutTitle">ODORSTRIKE 50ml</h2>'), 'checkout title must be an h2');
  assert.ok(html.includes('<fieldset class="pay-toggle checkout-payment"'), 'payment selector must be present in HTML');
  assert.ok(html.includes('onclick="selectPay(\'prepaid\')"'), 'prepaid must be directly actionable');
  assert.ok(html.includes('onclick="selectPay(\'cod\')"'), 'COD must be directly actionable');
  assert.ok(html.includes('id="codFeeRow"'), 'COD handling fee must be explicit in the summary');
  assert.ok(html.includes('₹60 handling · ₹289 total'), 'COD total must disclose the handling charge before checkout');
  assert.ok(html.includes('checkout-action-bar'), 'primary checkout action should remain reachable on long mobile forms');

  const chrome = fs.readFileSync('assets/js/chrome.js', 'utf8');
  assert.equal(
    chrome.includes('smf-payment-choice-style'),
    false,
    'payment UI styles must not be injected into the DOM at runtime',
  );
  assert.equal(
    chrome.includes('function injectPaymentStyles'),
    false,
    'payment UI should use static CSS rather than runtime style generation',
  );
  assert.ok(
    chrome.includes('form.querySelector(\'.checkout-payment\')'),
    'shared checkout behavior must bind to the static payment selector',
  );
});
