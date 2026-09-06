import test from 'node:test';
import assert from 'node:assert';
import handler from '../../api/create-order.js';

test('create-order responds with 502 on upstream fetch failure', async (t) => {
  // Mock global fetch
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('Network failure');
  };

  try {
    let statusCode = 200;
    let responseBody = '';

    const req = {
      method: 'POST',
      headers: { origin: 'https://smelloff.in' },
      body: { some: 'data' }
    };

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseBody = data;
          },
          end: (data) => {
            responseBody = data;
          }
        };
      }
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 502);
    assert.deepStrictEqual(responseBody, { error: 'Order service unavailable. Please try again.' });
  } finally {
    global.fetch = originalFetch;
  }
});
