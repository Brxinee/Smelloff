import assert from 'node:assert';
import { calculateOrderTotal } from '../../shared/products-config.js';

const rows = [
  [1, 'prepaid', 229, 0, 229],
  [1, 'cod', 229, 60, 289],
  [2, 'prepaid', 458, 0, 458],
  [2, 'cod', 458, 60, 518],
  [3, 'prepaid', 687, 0, 687],
  [3, 'cod', 687, 60, 747],
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

assert.strictEqual(calculateOrderTotal(2, 'prepaid').total, 458);
assert.strictEqual(calculateOrderTotal(3, 'prepaid').total, 687);
assert.strictEqual(calculateOrderTotal(2, 'cod').codFee, 60);
assert.strictEqual(calculateOrderTotal(1, 'upi').total, 229);

console.log(`purchase-state matrix: ${passed}/${rows.length} rows passed`);
