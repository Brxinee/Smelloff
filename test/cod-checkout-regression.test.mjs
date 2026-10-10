import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';

const chrome = await readFile(new URL('../assets/js/chrome.js', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../odorstrike.html', import.meta.url), 'utf8');
const api = await readFile(new URL('../api/create-order.js', import.meta.url), 'utf8');
const product = JSON.parse(await readFile(new URL('../config/product.json', import.meta.url), 'utf8'));

test('checkout exposes optional COD without replacing the working Razorpay path', () => {
  assert.match(chrome, /function startRazorpay\(\)/);
  assert.match(chrome, /window\.startRazorpay = startRazorpay;/);
  assert.match(checkout, /checkout-payment/);
  assert.match(chrome, /Prepaid/);
  assert.match(checkout, /Cash on Delivery/);
  assert.match(checkout, /selectPay\('prepaid'\)/);
  assert.match(chrome, /checkoutButton\.onclick = function \(\) \{/);
  assert.match(chrome, /return window\.submitOrder\(\);/);
  assert.doesNotMatch(chrome, /window\.submitOrder = function \(\) \{ return window\.startRazorpay\(\); \};/);
  assert.doesNotMatch(chrome, /\[50, 150, 300, 750, 1500\]\.forEach/);
});

test('product pricing keeps prepaid at ₹299 and COD fee at ₹60', () => {
  assert.equal(product.product.price, 299);
  assert.equal(product.product.codFee, 60);
  assert.equal(product.product.priceCod, 359);
});

test('Order API has an explicit COD branch and preserves prepaid Razorpay', () => {
  assert.match(api, /const COD_FEE_RUPEES = Number\(BASE_PRODUCT\.codFee\);/);
  assert.match(api, /const COD_PAYMENT_METHOD = 'cod';/);
  assert.match(api, /const COD_INITIAL_STATUS = 'placed';/);
  assert.match(api, /const codFeePaise = isCod \? Math\.round\(COD_FEE_RUPEES \* 100\) : 0;/);
  assert.match(api, /const totalPaise = subtotalPaise \+ codFeePaise;/);
  assert.match(api, /payment_method: COD_PAYMENT_METHOD/);
  assert.match(api, /status: COD_INITIAL_STATUS/);
  assert.match(api, /cod_fee: payload\.cod_fee/);
  assert.match(api, /const localOrder = await ensureCodLocalOrder\(sanitizedPayload\);/);
  assert.match(api, /return res\.status\(200\)\.json\(responseForCod\(localOrder\)\);/);
  assert.match(api, /const razorpay = razorpayClient\(\);/);
  assert.match(api, /razorpay\.orders\.create\(/);
  assert.match(api, /persistRazorpayOrderId\(/);
});

test('COD never requires Razorpay credentials before creating the local order', () => {
  const methodIndex = api.indexOf("const requestedPaymentMethod = String(body.payment_method || 'pending')");
  const credentialGuardIndex = api.indexOf("if (!isCod && (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET))");
  const codBranchIndex = api.indexOf('if (isCod) {');
  assert.ok(methodIndex >= 0);
  assert.ok(credentialGuardIndex > methodIndex);
  assert.ok(codBranchIndex > credentialGuardIndex);
});

test('COD fee is one order-level charge, not a per-bottle charge', () => {
  assert.match(api, /const codFeePaise = isCod \? Math\.round\(COD_FEE_RUPEES \* 100\) : 0;/);
  assert.doesNotMatch(api, /COD_FEE_RUPEES \* quantity/);
});

// Owner's call (2026-10-11): outside checkout the site says COD is available
// and nothing more. The amount lives on the COD payment option in checkout
// (its own total, before the order is placed) and in the three policies.
test('COD amount appears only in checkout and on /shipping, /refund, /faq', () => {
  const { codFee, priceCod } = product.product;
  const amount = new RegExp(`(₹|&#8377;)\\s*(${codFee}|${priceCod})\\b`);
  // Policies, plus the post-purchase pages that show what an order was charged.
  const policy = new Set(['shipping.html', 'refund.html', 'faq.html', 'terms.html', 'privacy.html', 'track-order.html', 'payment-failed.html']);
  const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
    .concat(['blog', 'solutions'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of pages) {
    if (policy.has(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    if (f === 'odorstrike.html') {
      // The checkout modal (and the payment-failed policy overlay after it)
      // may state it; nothing else on the page.
      html = html.replace(/<div class="overlay" id="checkoutOverlay"[\s\S]*?<!-- DPDP Consent Bar -->/, '');
      html = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    }
    assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), amount, `${f} must not state the COD amount outside checkout`);
  }
  for (const f of ['shipping.html', 'refund.html', 'faq.html']) {
    const html = fs.readFileSync(f, 'utf8');
    assert.ok(html.includes(`₹${codFee}`) && html.includes(`₹${priceCod}`), `${f} must state the ₹${codFee} COD charge and ₹${priceCod} total`);
  }
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  assert.match(pdp, new RegExp(`data-method="cod"[\\s\\S]{0,300}\\+₹${codFee} handling[\\s\\S]{0,120}class="pay-opt-price">₹${priceCod}<`),
    'the COD option in checkout must state the charge and its own total before the order is placed');
});
