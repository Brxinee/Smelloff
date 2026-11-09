// Free COD on 2+ bottles (owner, 2026-11-08): "Cash on Delivery is free when
// the order has 2 or more bottles." One bottle on COD keeps its pincode-zone
// shipping + COD handling (₹89 / ₹119 / ₹149 / ₹179). Prepaid is free at
// every quantity. The server is the authority; the page, chrome.js, the admin
// form and scripts/product-config.mjs must price every order the same way.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {
  calculateOrderTotal, codChargesForPincode, codFeeRupeesFromOrder, COD_FREE_FROM_QUANTITY,
} from '../shared/products-config-workers.js';
import { calculateOrderTotal as scriptOrderTotal } from '../scripts/product-config.mjs';
import { orderConfirmation } from '../api/_email-templates.js';

const product = JSON.parse(fs.readFileSync('config/product.json', 'utf8'));
const pdp = fs.readFileSync('odorstrike.html', 'utf8');
const chrome = fs.readFileSync('assets/js/chrome.js', 'utf8');

// One pincode per zone: Telangana, South & West, rest of India, remote.
const PINS = { telangana: '500018', south: '560001', rest: '110001', remote: '795001' };
const ONE_BOTTLE_COD = { telangana: 318, south: 348, rest: 378, remote: 408 };
const PREPAID = { 1: 229, 2: 419, 3: 648, 5: 899 };

test('the threshold lives in config and the page copies it', () => {
  assert.equal(product.product.codShipping.freeFromQuantity, 2);
  assert.equal(COD_FREE_FROM_QUANTITY, 2);
  assert.match(pdp, new RegExp(`COD_FREE_FROM: ${product.product.codShipping.freeFromQuantity},`), 'CFG.COD_FREE_FROM matches config');
});

test('the server charges COD on one bottle only', () => {
  for (const [zone, pin] of Object.entries(PINS)) {
    assert.equal(calculateOrderTotal(1, 'cod', pin).total, ONE_BOTTLE_COD[zone], `1 bottle COD, ${zone}`);
    for (const q of [2, 3, 5, 10]) {
      const t = calculateOrderTotal(q, 'cod', pin);
      assert.equal(t.codFee, 0, `${q} bottles COD, ${zone}: free`);
      assert.equal(t.total, t.subtotal);
    }
    assert.deepEqual(codChargesForPincode(pin, 2), { zone: codChargesForPincode(pin).zone, shipping: 0, handling: 0, total: 0 });
  }
  assert.equal(calculateOrderTotal(1, 'cod', '110001').total, 378, 'one bottle to Delhi is still ₹378');
  for (const [q, total] of Object.entries(PREPAID)) assert.equal(calculateOrderTotal(Number(q), 'prepaid', '110001').total, total, `prepaid ${q}`);
});

// Pull the pricing functions out of the page and chrome.js and run them as a
// browser would, with a pincode typed into checkout.
function pageCheckout(pin, qty) {
  const cfgScript = pdp.match(/<script>\s*window\.SMELLOFF_CONFIG = \{[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
  const grab = (re) => { const m = pdp.match(re); assert.ok(m, String(re)); return m[0]; };
  const fns = [
    grab(/function codChargesNow\(q\) \{[\s\S]*?\n  \}/),
    grab(/function codFreeFor\(q\) \{.*\}/),
    grab(/function codFeeNow\(q\) \{.*\}/),
    grab(/function subtotalFor\(q\) \{[\s\S]*?\n  \}/),
  ].join('\n');
  const win = {};
  const ctx = { window: win, document: { getElementById: (id) => (id === 'f_pin' ? { value: pin } : null) } };
  vm.runInNewContext(`${cfgScript}\nvar CFG = window.SMELLOFF_CONFIG; var cartQty = ${qty};\n${fns}\nthis.total = subtotalFor(${qty}) + codFeeNow(${qty}); this.cc = codChargesNow(${qty});`, ctx);
  return ctx;
}
function chromeCheckout(pin, qty) {
  const cfgScript = pdp.match(/<script>\s*window\.SMELLOFF_CONFIG = \{[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
  const grab = (re) => { const m = chrome.match(re); assert.ok(m, String(re)); return m[0]; };
  const fns = [
    grab(/function unitPriceRupees\(\) \{[\s\S]*?\n  \}/),
    grab(/function subtotalRupees\(qty\) \{[\s\S]*?\n  \}/),
    grab(/function codIsFreeFor\(qty\) \{[\s\S]*?\n  \}/),
    grab(/function codChargesRupees\(qty\) \{[\s\S]*?\n  \}/),
  ].join('\n');
  const win = {};
  const ctx = { window: win, document: { getElementById: (id) => (id === 'f_pin' ? { value: pin } : null) } };
  vm.runInNewContext(`${cfgScript}\nfunction quantityFromCheckout(){ return ${qty}; }\n${fns}\nthis.total = subtotalRupees(${qty}) + codChargesRupees(${qty}).total; this.cc = codChargesRupees(${qty});`, ctx);
  return ctx;
}

test('page, chrome.js, admin/scripts and the server agree for 1, 2, 3 and 5 bottles in every zone', () => {
  for (const [zone, pin] of Object.entries(PINS)) {
    for (const q of [1, 2, 3, 5]) {
      const server = calculateOrderTotal(q, 'cod', pin).total;
      assert.equal(pageCheckout(pin, q).total, server, `odorstrike.html, ${q} bottles, ${zone}`);
      assert.equal(chromeCheckout(pin, q).total, server, `chrome.js, ${q} bottles, ${zone}`);
      assert.equal(scriptOrderTotal(q, 'cod', pin).total, server, `scripts/product-config.mjs, ${q} bottles, ${zone}`);
      assert.equal(server, q === 1 ? ONE_BOTTLE_COD[zone] : PREPAID[q]);
    }
  }
  assert.equal(pageCheckout('110001', 2).cc.free, true);
  assert.equal(chromeCheckout('110001', 2).cc.free, true);
  assert.equal(pageCheckout('110001', 1).cc.free, false);
});

test('checkout copy: free COD at 2+, the one-bottle charge names the free option, the upsell says it too', () => {
  const fn = pdp.match(/function renderCheckoutPrices\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(fn, /'Free COD on ' \+ freeAt \+ ' or more bottles · pay when it arrives'/);
  assert.match(fn, /' · free with ' \+ freeAt \+ ' bottles'/);
  assert.match(fn, /'Add a second · 2 for ' \+ inr\(subtotalFor\(2\)\) \+ \(payMethod === 'cod' && codFreeFor\(2\) \? ' · free COD' : ''\)/);
  // The pay button keeps chrome.js's words.
  assert.match(fn, /'Place COD order · ₹' \+ t\.total : 'Pay ₹' \+ t\.total \+ ' securely'/);
  assert.match(pdp, /data-method="cod"[\s\S]{0,300}free with 2 bottles · pay when it arrives<\/small>/);
  // chrome.js shows free COD like prepaid: Shipping Free, no handling row.
  assert.match(chrome, /if \(charges && charges\.free\) charges = null;/);
  // The exit question's COD answer points at free COD on 2+ bottles.
  assert.match(pdp, /k: 'cod'[^\n]*Cash on Delivery is free too/);
});

test('outside checkout, packs of 2 and 5 say "Free COD" with no amount', () => {
  const home = fs.readFileSync('index.html', 'utf8');
  for (const q of [2, 5]) {
    assert.match(home, new RegExp(`qty=${q}"><b>[^<]+</b><span>[^<]+</span><small>[^<]+</small><small>Free COD</small></a>`), `homepage ${q}-pack link`);
    assert.equal([...pdp.matchAll(new RegExp(`data-qty="${q}"[^\\n]*<span class="pd-pk__cod">Free COD</span></button>`, 'g'))].length, 2, `PDP ${q}-pack cards (hero + #buy)`);
  }
  assert.doesNotMatch(pdp, /data-qty="1"[^\n]*pd-pk__cod/, 'one bottle is not free COD');
  for (const f of ['faq.html', 'shipping.html', 'refund.html', 'terms.html', 'privacy.html']) {
    assert.match(fs.readFileSync(f, 'utf8'), /free on orders of 2 or more bottles/, `${f} states free COD on 2+ bottles`);
  }
  for (const f of ['index.html', 'odorstrike.html']) {
    assert.match(fs.readFileSync(f, 'utf8'), /Cash on Delivery is available across India, and it is free on orders of 2 or more bottles\./, `${f} FAQ`);
  }
  assert.match(fs.readFileSync('llms.txt', 'utf8'), /Cash on Delivery: available across India, free on orders of 2 or more bottles/);
  assert.match(fs.readFileSync('shipping.html', 'utf8'), /"description":"[^"]*Cash on Delivery is free on orders of 2 or more bottles/, 'ShippingService JSON-LD');
});

test('emails read a free-COD order as ₹0 COD charges, never the default', () => {
  assert.equal(codFeeRupeesFromOrder({ payment_method: 'cod', amount: 41900, cod_fee: 0, items: [{ quantity: 2 }] }), 0);
  assert.equal(codFeeRupeesFromOrder({ payment_method: 'cod', amount: 31800, cod_fee: 8900, items: [{ quantity: 1 }] }), 89);
  assert.equal(codFeeRupeesFromOrder({ payment_method: 'cod', amount: 28900, cod_fee: 0, items: [{ quantity: 1 }] }), 60, 'older rows folded the fee into amount');
  assert.equal(codFeeRupeesFromOrder({ payment_method: 'upi', amount: 22900, cod_fee: 0 }), 0);
  const mail = orderConfirmation({ orderId: 'SMF-20261108-1234', customerName: 'Asha', amount: '419', codFee: 0, paymentMethod: 'Cash on Delivery', quantity: 2 });
  assert.doesNotMatch(mail.html, /COD handling/);
  assert.match(mail.html, /Amount due/);
  assert.match(mail.text, /Amount due: ₹419/);
});
