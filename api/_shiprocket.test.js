import test from 'node:test';
import assert from 'node:assert/strict';
import { createShiprocketOrder } from './_shiprocket.js';

test('createShiprocketOrder mapping logic', async (t) => {
  const originalEnv = { ...process.env };

  t.beforeEach(() => {
    process.env.SHIPROCKET_EMAIL = 'test@example.com';
    process.env.SHIPROCKET_PASSWORD = 'password';
    process.env.SHIPROCKET_PICKUP_LOCATION = 'Opposite ANcorner bakery';
    process.env.SHIPROCKET_CHANNEL_ID = '12345';
  });

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  await t.test('maps happy path correctly', async (t) => {
    let capturedPayload = null;
    t.mock.method(global, 'fetch', async (url, options) => {
      const urlString = String(url);
      if (urlString.includes('/auth/login')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ token: 'mock-token' })
        };
      }
      if (urlString.includes('/settings/company/pickup')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: {
              shipping_address: [
                {
                  pickup_location: 'Opposite ANcorner bakery',
                  address: '123 Test St',
                  city: 'Test City',
                  state: 'Test State',
                  pin_code: '123456',
                  id: 123
                }
              ]
            }
          })
        };
      }
      if (urlString.includes('/orders/create/adhoc')) {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ order_id: 999 })
        };
      }
      throw new Error(`Unexpected fetch call to ${urlString}`);
    });

    const order = {
      order_code: 'ORD-123',
      created_at: '2023-10-01T12:00:00Z',
      amount: 100000,
      cod_fee: 5000,
      payment_method: 'cod',
      customer_email: 'customer@example.com',
      customer_phone: '+91-9876543210',
      address: {
        name: 'John Doe',
        line: '456 Buyer St',
        city: 'Buyer City',
        pincode: '654321',
        state: 'Buyer State'
      },
      items: [
        {
          name: 'Awesome Product',
          sku: 'AP-001',
          quantity: 2,
          unit_price: 499
        }
      ]
    };

    await createShiprocketOrder(order);

    assert.ok(capturedPayload);
    assert.equal(capturedPayload.order_id, 'ORD-123');
    assert.equal(capturedPayload.order_date, '2023-10-01');
    assert.equal(capturedPayload.pickup_location, 'Opposite ANcorner bakery');
    assert.equal(capturedPayload.billing_customer_name, 'John Doe');
    assert.equal(capturedPayload.billing_city, 'Buyer City');
    assert.equal(capturedPayload.billing_phone, '9876543210');
    assert.equal(capturedPayload.payment_method, 'COD');
    assert.equal(capturedPayload.sub_total, 950);
    assert.equal(capturedPayload.weight, 0.5);

    assert.equal(capturedPayload.order_items.length, 1);
    assert.equal(capturedPayload.order_items[0].name, 'Awesome Product');
    assert.equal(capturedPayload.order_items[0].sku, 'AP-001');
    assert.equal(capturedPayload.order_items[0].units, 2);
    assert.equal(capturedPayload.order_items[0].selling_price, 499);
    assert.equal(capturedPayload.channel_id, 12345);
  });

  await t.test('handles missing fields and defaults correctly', async (t) => {
    let capturedPayload = null;
    t.mock.method(global, 'fetch', async (url, options) => {
      const urlString = String(url);
      if (urlString.includes('/auth/login')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ token: 'mock-token' }) };
      }
      if (urlString.includes('/settings/company/pickup')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: { shipping_address: [{ pickup_location: 'Opposite ANcorner bakery', id: 123 }] } }) };
      }
      if (urlString.includes('/orders/create/adhoc')) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true, status: 200, text: async () => JSON.stringify({ order_id: 999 }) };
      }
      throw new Error(`Unexpected fetch call to ${urlString}`);
    });

    const order = {
      order_code: 'ORD-999'
    };

    await createShiprocketOrder(order);

    assert.ok(capturedPayload);
    assert.equal(capturedPayload.order_id, 'ORD-999');

    assert.equal(capturedPayload.order_items.length, 1);
    assert.equal(capturedPayload.order_items[0].name, 'Smelloff ODORSTRIKE 50ml');
    assert.equal(capturedPayload.order_items[0].sku, 'OS-001-50ML');
    assert.equal(capturedPayload.order_items[0].units, 1);
    assert.equal(capturedPayload.order_items[0].selling_price, 229);

    assert.equal(capturedPayload.weight, 0.5);
    assert.equal(capturedPayload.sub_total, 0);
    assert.equal(capturedPayload.payment_method, 'Prepaid');
  });

  await t.test('calculates weight correctly for many items', async (t) => {
    let capturedPayload = null;
    t.mock.method(global, 'fetch', async (url, options) => {
      const urlString = String(url);
      if (urlString.includes('/auth/login')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ token: 'mock-token' }) };
      }
      if (urlString.includes('/settings/company/pickup')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: { shipping_address: [{ pickup_location: 'Opposite ANcorner bakery', id: 123 }] } }) };
      }
      if (urlString.includes('/orders/create/adhoc')) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true, status: 200, text: async () => JSON.stringify({ order_id: 999 }) };
      }
      throw new Error(`Unexpected fetch call to ${urlString}`);
    });

    const order = {
      order_code: 'ORD-BIG',
      items: [{ quantity: 10 }]
    };

    await createShiprocketOrder(order);

    assert.ok(capturedPayload);
    assert.equal(capturedPayload.weight, 1.2);
  });

  await t.test('handles negative subtotal', async (t) => {
    let capturedPayload = null;
    t.mock.method(global, 'fetch', async (url, options) => {
      const urlString = String(url);
      if (urlString.includes('/auth/login')) return { ok: true, status: 200, text: async () => JSON.stringify({ token: 'mock-token' }) };
      if (urlString.includes('/settings/company/pickup')) return { ok: true, status: 200, text: async () => JSON.stringify({ data: { shipping_address: [{ pickup_location: 'Opposite ANcorner bakery', id: 123 }] } }) };
      if (urlString.includes('/orders/create/adhoc')) { capturedPayload = JSON.parse(options.body); return { ok: true, status: 200, text: async () => JSON.stringify({ order_id: 999 }) }; }
      throw new Error(`Unexpected fetch call to ${urlString}`);
    });

    const order = { order_code: 'ORD-NEG', amount: 1000, cod_fee: 2000 };
    await createShiprocketOrder(order);
    assert.equal(capturedPayload.sub_total, 0);
  });
});
