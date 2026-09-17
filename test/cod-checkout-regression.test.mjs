import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const chrome = await readFile(new URL('../assets/js/chrome.js', import.meta.url), 'utf8');
const api = await readFile(new URL('../api/create-order.js', import.meta.url), 'utf8');
const product = JSON.parse(await readFile(new URL('../config/product.json', import.meta.url), 'utf8'));

test('checkout keeps prepaid as the default and exposes optional COD without replacing Razorpay', () => {
  assert.match(chrome, /function startRazorpay\(\)/);
  assert.match(chrome, /payment_method: 'pending'/);
  assert.match(chrome, /window\.startRazorpay = startRazorpay;/);
  assert.match(chrome, /smf-payment-choice/);
  assert.match(chrome, /PREPAID/);
  assert.match(chrome, /CASH ON DELIVERY/);
  assert.match(chrome, /window\.selectPay\(method\)/);
  assert.doesNotMatch(chrome, /window\.submitOrder = function \(\) \{ return window\.startRazorpay\(\); \};/);
  assert.doesNotMatch(chrome, /\[50, 150, 300, 750, 1500\]\.forEach/);
});

test('canonical product config keeps the COD fee and prepaid price aligned', () => {
  assert.equal(product.product.price, 229);
  assert.equal(product.product.codFee, 60);
  assert.equal(product.product.priceCod, 289);
});

test('Vercel order API has explicit prepaid and COD branches', () => {
  assert.match(api, /COD_FEE_RUPEES/);
  assert.match(api, /paymentMethod === 'cod'/);
  assert.match(api, /payment_method: 'cod'/);
  assert.match(api, /status: 'placed'/);
  assert.match(api, /cod_fee: codFeePaise/);
  assert.match(api, /if \(isCod\) \{/);
  assert.match(api, /return res\.status\(200\)\.json\(responseForCod/);
});

test('prepaid path still creates a Razorpay order', () => {
  assert.match(api, /const razorpay = razorpayClient\(\);/);
  assert.match(api, /razorpay\.orders\.create\(/);
  assert.match(api, /persistRazorpayOrderId\(/);
});

test('COD fee is once per order, not once per bottle', () => {
  assert.match(api, /const codFeePaise = isCod \? COD_FEE_RUPEES \* 100 : 0;/);
  assert.match(api, /const totalPaise = subtotalPaise \+ codFeePaise;/);
});
