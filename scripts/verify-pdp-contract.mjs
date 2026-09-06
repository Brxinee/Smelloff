/* PDP checkout contract guard — no runtime side effects. */
import { readFileSync } from 'node:fs';

const html = readFileSync('odorstrike.html', 'utf8');
const track = readFileSync('assets/js/track.js', 'utf8');

if (!/onclick="submitOrder\(\)"/.test(html)) throw new Error('PDP submit button is missing submitOrder().');
if (!/window\.submitOrder\s*=\s*pdpSubmitOrder/.test(track)) throw new Error('PDP checkout override is missing from track.js.');
if (!/fetch\(['"]\/api\/create-order['"]/.test(track)) throw new Error('PDP is not using the same-origin order API.');
if (!/payment_method:\s*order\.paymentMethod/.test(track)) throw new Error('PDP payment method contract is missing.');
if (!/amount:\s*Math\.round\(Number\(order\.total\) \* 100\)/.test(track)) throw new Error('PDP amount must be sent in paise.');

const m = html.match(/<script\s+src="\/assets\/js\/track\.js\?v=([^"]+)"/);
if (!m) throw new Error('PDP track.js must have a cache-busting version.');
const expected = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(track).digest('hex').slice(0, 8));
if (m[1] !== expected) throw new Error(`PDP track.js cache hash ${m[1]} does not match ${expected}.`);

console.log(`PDP checkout contract OK (${expected})`);
