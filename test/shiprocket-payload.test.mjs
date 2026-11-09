import test from 'node:test';
import assert from 'node:assert/strict';

// The courier collects Shiprocket's order total = items + transaction_charges.
// The COD handling fee must travel as transaction_charges or the courier
// collects ₹229 on a ₹318 order (live finding, 2026-10-11).
test('createShiprocketOrder sends the COD fee as transaction_charges; prepaid sends 0', async () => {
  process.env.SHIPROCKET_EMAIL = 'api@example.com';
  process.env.SHIPROCKET_PASSWORD = 'x';
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.endsWith('/auth/login')) return json({ token: 't' });
    if (u.endsWith('/settings/company/pickup')) return json({ data: { shipping_address: [{ pickup_location: 'sanathnagar', pin_code: '500018' }] } });
    if (u.endsWith('/orders/create/adhoc')) { bodies.push(JSON.parse(opts.body)); return json({ order_id: 1, shipment_id: 2 }); }
    throw new Error('unexpected fetch ' + u);
  };
  try {
    const { createShiprocketOrder } = await import('../api/_shiprocket.js');
    const base = { address: { name: 'A', line: 'L', city: 'Hyderabad', state: 'TS', pincode: '500018' }, customer_email: 'a@b.in', customer_phone: '9000000000', items: [{ quantity: 1, price: 229 }] };
    await createShiprocketOrder({ ...base, order_code: 'SMF-20261011-0001', payment_method: 'cod', amount: 31800, cod_fee: 8900 });
    await createShiprocketOrder({ ...base, order_code: 'SMF-20261011-0002', payment_method: 'upi', amount: 22900, cod_fee: 0 });
    await createShiprocketOrder({ ...base, items: [{ quantity: 2, price: 229 }], order_code: 'SMF-20261015-0003', payment_method: 'cod', amount: 50800, cod_fee: 8900 });
    await createShiprocketOrder({ ...base, items: [{ quantity: 3, price: 229 }], order_code: 'SMF-20261015-0004', payment_method: 'upi', amount: 64800, cod_fee: 0 });
    await createShiprocketOrder({ ...base, items: [{ quantity: 6, price: 229 }], order_code: 'SMF-20261018-0005', payment_method: 'cod', amount: 121700, cod_fee: 8900 });
    // Free COD on 2+ bottles (owner, 2026-11-08): create-order saves cod_fee 0.
    await createShiprocketOrder({ ...base, items: [{ quantity: 2, price: 229 }], order_code: 'SMF-20261108-0006', payment_method: 'cod', amount: 41900, cod_fee: 0 });
    const [cod, prepaid, codPair, prepaidThree, codSix, freeCodPair] = bodies;
    const itemsTotal = (b) => b.order_items.reduce((n, i) => n + i.selling_price * i.units, 0);
    assert.equal(freeCodPair.payment_method, 'COD');
    assert.equal(freeCodPair.transaction_charges, 0);
    assert.equal(freeCodPair.sub_total, 419);
    assert.equal(itemsTotal(freeCodPair) + freeCodPair.transaction_charges, 419, 'the courier collects exactly ₹419');
    // 2 for ₹419: the courier must collect 419 + 89, not 2 × 229 + 89.
    assert.equal(itemsTotal(codPair) + codPair.transaction_charges, 508);
    assert.equal(codPair.order_items.length, 1);
    assert.equal(codPair.order_items[0].selling_price, 419);
    assert.equal(codPair.order_items[0].units, 1);
    assert.equal(codPair.sub_total, 419);
    // 3 bottles: one pair line + one single line = ₹648.
    assert.equal(itemsTotal(prepaidThree), 648);
    assert.equal(prepaidThree.order_items.length, 2);
    assert.equal(prepaidThree.sub_total, 648);
    // 6 bottles: a pack-of-5 line (₹899) + one single (₹229); COD adds ₹89.
    assert.deepEqual(codSix.order_items.map((i) => [i.sku.slice(-3), i.units, i.selling_price]), [['-X5', 1, 899], ['0ML', 1, 229]]);
    assert.equal(itemsTotal(codSix) + codSix.transaction_charges, 1217);
    assert.equal(cod.payment_method, 'COD');
    assert.equal(cod.sub_total, 229);
    assert.equal(cod.transaction_charges, 89);
    assert.equal(cod.order_items[0].selling_price * cod.order_items[0].units + cod.transaction_charges, 318);
    assert.equal(cod.pickup_location, 'sanathnagar');
    assert.equal(cod.channel_id, 12051492);
    assert.equal(prepaid.payment_method, 'Prepaid');
    assert.equal(prepaid.transaction_charges, 0);
    assert.equal(prepaid.sub_total, 229);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Shiprocket caps address + address_2 COMBINED at 190 characters
// (SMF-20261102-9285: "Oops! Invalid Data." for a 200-character line on
// 2026-11-02, then "Address 1 and Address 2 combined cannot be greater 190
// than characters" on 2026-11-05 once the tail was spilled into address_2).
test('long or multi-line addresses fit Shiprocket\'s 190-character combined limit', async () => {
  const { splitAddressForShiprocket, SR_ADDRESS_MAX } = await import('../api/_shiprocket.js');
  assert.equal(SR_ADDRESS_MAX, 190);
  const fits = (r) => assert.ok(r.line1.length + r.line2.length <= 190, `${r.line1.length}+${r.line2.length}`);

  // City, state, pincode and "India" repeated in the line are dropped first
  // (they travel in their own fields), so nothing else is lost.
  const street = 'Flat 402, Sunshine Residency, Lane 7 near the old temple behind the bus depot, Opp. Ganesh Medicals, Ward 12, Kothrud Gaon, Paud Road Extension, Sector 3, near Kumar Park bus stop';
  const withTail = `${street}, Pune, Maharashtra, 411038, India`;
  assert.ok(withTail.length > 190);
  const a = splitAddressForShiprocket(withTail, { city: 'Pune', state: 'Maharashtra', pincode: '411038' });
  fits(a);
  assert.equal(a.line1, `${street}, India`, "stops dropping as soon as it fits");
  assert.equal(a.line2, '');

  // A street name containing the city stays intact.
  const b = splitAddressForShiprocket('12 Hyderabad Road, Kukatpally', { city: 'Hyderabad' });
  assert.equal(b.line1, '12 Hyderabad Road, Kukatpally');

  // Still too long: cut at a word boundary, never over the combined limit.
  const long = ('Flat 402, Sunshine Residency, Lane 7 near the old temple, Kothrud ').repeat(4);
  const cut = (long + '\n😀').slice(0, 200).replace(/.$/, '\uD83D'); // checkout's 200-char cut splitting an emoji
  const r = splitAddressForShiprocket(cut);
  fits(r);
  assert.ok(r.line1.length > 150, 'keeps as much as fits');
  assert.ok(cut.startsWith(r.line1.replace(/,$/, '')), 'a prefix of the original');
  assert.doesNotMatch(r.line1 + r.line2, /[\uD800-\uDFFF]/, 'no lone surrogate');

  assert.deepEqual(splitAddressForShiprocket('H.No 4-56\nMain road,\n\nNear school'), { line1: 'H.No 4-56, Main road, Near school', line2: '' });
  assert.deepEqual(splitAddressForShiprocket('Short street, Hyderabad, 500018', { city: 'Hyderabad', pincode: '500018' }), { line1: 'Short street, Hyderabad, 500018', line2: '' }, 'short lines are left alone');
});
