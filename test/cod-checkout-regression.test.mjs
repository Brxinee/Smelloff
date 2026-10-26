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

// Owner's call (2026-10-26, second pass): COD pays two charges by delivery
// pincode, shipping and COD handling, so a COD order never costs more than it
// collects (North India COD costs the owner ₹130–150). Prepaid ships free.
test('product pricing keeps prepaid at ₹229 and COD at shipping + handling by pincode', () => {
  const p = product.product;
  assert.equal(p.price, 229);
  const d = p.codShipping.default;
  assert.deepEqual([d.shipping, d.handling, d.fee], [99, 50, 149]);
  assert.equal(p.codFee, d.fee);
  assert.equal(p.priceCod, p.price + d.fee);
  const zones = Object.fromEntries(p.codShipping.zones.map((z) => [z.name.split(' ')[0], [z.shipping, z.handling, z.fee]]));
  assert.deepEqual(zones, { Telangana: [59, 30, 89], South: [79, 40, 119], Remote: [129, 50, 179] });
  for (const z of [d, ...p.codShipping.zones]) assert.equal(z.fee, z.shipping + z.handling, `${z.name}: fee = shipping + handling`);
  assert.equal(product.shipping.cod.fee, d.fee);
  const all = [d, ...p.codShipping.zones].map((z) => z.fee);
  assert.deepEqual([p.codShipping.min, p.codShipping.max], [Math.min(...all), Math.max(...all)]);
});

test('no stale price or COD figure survives anywhere a customer or crawler can read', () => {
  const { price, codFee, priceCod } = product.product;
  // Every hard-coded copy of the numbers matches config/product.json.
  assert.match(checkout, new RegExp('PRICES: \\{ solo: ' + price + ', pair: ' + product.product.pairPrice + ', five: ' + product.product.fivePackPrice + ' \\}'));
  assert.match(checkout, new RegExp('COD_FEE: ' + codFee + ','));
  // The page's zone table is the config's.
  const zones = product.product.codShipping.zones.map((z) => ({ shipping: z.shipping, handling: z.handling, prefixes: z.prefixes }));
  assert.ok(checkout.includes('COD_ZONES: ' + JSON.stringify(zones) + ','), 'CFG.COD_ZONES matches config codShipping');
  const d = product.product.codShipping.default;
  assert.ok(checkout.includes('COD_DEFAULT: ' + JSON.stringify({ shipping: d.shipping, handling: d.handling }) + ','), 'CFG.COD_DEFAULT matches config');
  assert.match(chrome, new RegExp('\\|\\| ' + price + ';'));
  assert.match(chrome, new RegExp('n : ' + codFee + ';'));
  // Retired prices (₹299 / 40% off) are not even in comments: answer engines
  // read the raw HTML and quote them as live. (₹89 is the Telangana COD total
  // again since 2026-10-26.)
  for (const stale of [/₹299(?!\d)/, /40% off/, /₹60–130/]) {
    assert.ok(!stale.test(checkout), `odorstrike.html still says ${stale}`);
  }
  assert.ok(checkout.includes('₹' + priceCod));
});

test('the summary shows the COD row whenever its Total includes the fee', () => {
  const fn = checkout.match(/function renderCheckoutPrices\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(fn, /feeRow\.style\.display = t\.codFee \? 'flex' : 'none'/);
  assert.match(fn, /set\('codFeeAmount', '₹' \+ codChargesNow\(\)\.handling\)/);
  // COD pays shipping on the Shipping line; prepaid reads Free.
  assert.match(fn, /set\('checkoutShipping', charges \? '₹' \+ charges\.shipping : 'Free'\)/);
});

test('Order API has an explicit COD branch and preserves prepaid Razorpay', () => {
  assert.match(api, /const COD_PAYMENT_METHOD = 'cod';/);
  assert.match(api, /const COD_INITIAL_STATUS = 'placed';/);
  assert.match(api, /const codFeePaise = isCod \? Math\.round\(codFeeForPincode\(feePincode\) \* 100\) : 0;/);
  assert.match(api, /const totalPaise = subtotalPaise \+ codFeePaise;/);
  assert.match(api, /payment_method: COD_PAYMENT_METHOD/);
  assert.match(api, /status: COD_INITIAL_STATUS/);
  assert.match(api, /cod_fee: payload\.cod_fee/);
  assert.match(api, /const localOrder = await ensureCodLocalOrder\(sanitizedPayload, owned\.existing\);/);
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

test('COD shipping is one order-level charge by delivery pincode, not per bottle', () => {
  assert.match(api, /const feePincode = String\(\(body\.address && body\.address\.pincode\) \|\| ''\)/);
  assert.match(api, /const codFeePaise = isCod \? Math\.round\(codFeeForPincode\(feePincode\) \* 100\) : 0;/);
  assert.doesNotMatch(api, /codFeeForPincode\([^)]*\) \* quantity/);
});

// Owner's call (2026-10-26): the COD shipping + handling amounts (₹89–179 and
// the totals) appear only in checkout, on the COD option, before the
// order is placed. Policies and every other page say a pincode-based charge
// is shown at checkout. Post-purchase pages may show what an order paid.
test('COD shipping amounts appear only in checkout', () => {
  const { priceCod } = product.product;
  const fees = [...new Set([product.product.codFee, ...product.product.codShipping.zones.map((z) => z.fee)])];
  const amount = new RegExp(`(₹|&#8377;)\\s*(${fees.join('|')}|${priceCod})(?!\\d)`);
  const postPurchase = new Set(['track-order.html', 'payment-failed.html']);
  const pages = fs.readdirSync('.').filter((f) => f.endsWith('.html'))
    .concat(['blog'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)));
  for (const f of pages) {
    if (postPurchase.has(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    if (f === 'odorstrike.html') {
      // Only the checkout modal (and the payment-failed overlay after it) may state it.
      html = html.replace(/<div class="overlay" id="checkoutOverlay"[\s\S]*?<!-- DPDP Consent Bar -->/, '');
      html = html.replace(/<script[\s\S]*?<\/script>/g, '');
    }
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    const cod = /cash on delivery|\bCOD\b/i;
    for (const para of html.split(/<\/(?:p|li|div|td)>/)) {
      if (cod.test(para)) assert.doesNotMatch(para, amount, `${f} must not state a COD amount outside checkout`);
    }
  }
  for (const f of ['shipping.html', 'refund.html', 'faq.html', 'terms.html']) {
    assert.match(fs.readFileSync(f, 'utf8'), /shipping charge and a COD handling charge based on (?:your|the delivery) pincode/, `${f} names both pincode-based COD charges`);
  }
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const { min, max } = product.product.codShipping;
  assert.match(pdp, new RegExp(`data-method="cod"[\\s\\S]{0,300}\\+₹${min}–${max} shipping &amp; handling by pincode[\\s\\S]{0,120}class="pay-opt-price">₹${priceCod}<`),
    'the COD option in checkout states the charge and its own total before the order is placed');
});

// chrome.js re-renders the same summary rows: the COD handling row must hold
// only the handling charge and the Shipping row the shipping charge (it once
// wrote the whole COD charge into the handling row).
test('chrome.js splits COD into its Shipping and COD handling rows', () => {
  assert.match(chrome, /feeAmount\.textContent = '₹' \+ \(charges \? charges\.handling : 0\)/);
  assert.match(chrome, /shipEl\.textContent = charges \? '₹' \+ charges\.shipping : 'Free'/);
  assert.match(chrome, /pre\[j\]\.length > best/, 'longest matching prefix wins, as on the server');
});
