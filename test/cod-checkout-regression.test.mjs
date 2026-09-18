import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('product pricing keeps prepaid at ₹229 and COD fee at ₹60', () => {
  assert.equal(product.product.price, 229);
  assert.equal(product.product.codFee, 60);
  assert.equal(product.product.priceCod, 289);
});

test('Vercel order API has an explicit COD branch and preserves prepaid Razorpay', () => {
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
