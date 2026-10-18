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
    const [cod, prepaid, codPair, prepaidThree, codSix] = bodies;
    const itemsTotal = (b) => b.order_items.reduce((n, i) => n + i.selling_price * i.units, 0);
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
