import assert from 'node:assert';
import { calculateOrderTotal } from '../../shared/products-config.js';

const rows = [
  [1, 'prepaid', 229, 0, 229],
  [1, 'cod', 229, 60, 289],
  [2, 'prepaid', 429, 0, 429],
  [2, 'cod', 429, 60, 489],
  [3, 'prepaid', 599, 0, 599],
  [3, 'cod', 599, 60, 659],
  [4, 'prepaid', 916, 0, 916],
  [5, 'cod', 1145, 60, 1205]
];

let passed = 0;
for (const [qty, method, subtotal, fee, total] of rows) {
  const r = calculateOrderTotal(qty, method);
  assert.strictEqual(r.qty, qty, `qty ${qty}`);
  assert.strictEqual(r.subtotal, subtotal, `${qty} ${method} subtotal`);
  assert.strictEqual(r.codFee, fee, `${qty} ${method} fee`);
  assert.strictEqual(r.total, total, `${qty} ${method} total`);
  passed++;
}

assert.notStrictEqual(calculateOrderTotal(2, 'prepaid').total, 458);
assert.notStrictEqual(calculateOrderTotal(3, 'prepaid').total, 687);
assert.strictEqual(calculateOrderTotal(2, 'cod').codFee, 60);
assert.strictEqual(calculateOrderTotal(1, 'upi').total, 229);

console.log(`purchase-state matrix: ${passed}/${rows.length} rows passed`);
