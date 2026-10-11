import test from 'node:test';
import assert from 'node:assert/strict';

// A cancellation made in the Shiprocket panel must close the order on the
// site (it has no AWB, so tracking never sees it), but only before dispatch.
test('sync mirrors a Shiprocket CANCELED order to cancelled; dispatched orders are left alone', async () => {
  process.env.SHIPROCKET_EMAIL = 'api@example.com';
  process.env.SHIPROCKET_PASSWORD = 'x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  process.env.CRON_SECRET = 'cron-test';
  const orders = [
    { order_code: 'SMF-20261011-1001', status: 'confirmed', shiprocket_order_id: 11, payment_method: 'upi' },
    { order_code: 'SMF-20261011-1002', status: 'dispatched', shiprocket_order_id: 12, payment_method: 'cod' },
  ];
  const patches = [];
  const realFetch = globalThis.fetch;
  const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/orders?') && (opts.method || 'GET') === 'GET') return json(orders);
    if (u.includes('/rest/v1/orders?') && opts.method === 'PATCH') {
      patches.push({ code: decodeURIComponent(u.split('order_code=eq.')[1]), body: JSON.parse(opts.body) });
      return new Response('', { status: 204 });
    }
    if (u.includes('/rest/v1/')) return json([]);
    if (u.endsWith('/auth/login')) return json({ token: 't' });
    if (u.includes('/orders/show/')) return json({ data: { status: 'CANCELED', shipments: { awb: null, courier: '' } } });
    throw new Error('unexpected fetch ' + u);
  };
  try {
    const { default: handler } = await import('../api/shiprocket-sync.js');
    const res = { headers: {}, statusCode: 0, body: null,
      setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; }, end() { return this; } };
    await handler({ method: 'GET', headers: { authorization: 'Bearer cron-test' }, socket: { remoteAddress: 't' } }, res);
    assert.equal(res.statusCode, 200);
    const p1 = patches.find((p) => p.code === 'SMF-20261011-1001');
    assert.equal(p1?.body.status, 'cancelled', 'unshipped order closes');
    assert.equal(p1.body.shiprocket_status, 'CANCELED');
    const p2 = patches.find((p) => p.code === 'SMF-20261011-1002');
    assert.notEqual(p2?.body.status, 'cancelled', 'dispatched order is not cancelled by the sync');
  } finally {
    globalThis.fetch = realFetch;
  }
});
