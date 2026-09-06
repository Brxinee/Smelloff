import { test } from 'node:test';
import assert from 'node:assert';
import { shiprocketRequest } from './_shiprocket.js';

test('shiprocketRequest handles malformed JSON response (parseResponse catch block)', async () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    process.env = { ...originalEnv, SHIPROCKET_EMAIL: 'test@example.com', SHIPROCKET_PASSWORD: 'password' };

    let callCount = 0;
    global.fetch = async (url) => {
        callCount++;
        if (url.includes('/auth/login')) {
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ token: 'mock-token' })
            };
        }

        return {
            ok: false,
            status: 400,
            text: async () => '<html>Not JSON</html>'
        };
    };

    try {
        await shiprocketRequest('/some-path');
        assert.fail('Should have thrown an error');
    } catch (err) {
        assert.strictEqual(err.code, 'SHIPROCKET_API_ERROR');
        assert.strictEqual(err.status, 400);
        assert.deepStrictEqual(err.data, { raw: '<html>Not JSON</html>' });
        assert.match(err.message, /<html>Not JSON<\/html>/);
    } finally {
        global.fetch = originalFetch;
        process.env = originalEnv;
    }
});
