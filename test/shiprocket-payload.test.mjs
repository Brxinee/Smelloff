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
    const [cod, prepaid] = bodies;
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
