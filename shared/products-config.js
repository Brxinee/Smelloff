// Centralized product & offer configuration for Smelloff / ODORSTRIKE.
// Single source of truth for SKUs, pricing, MRP, COD fee, and bundle rules.

export const BASE_PRODUCT = {
  sku: 'OS-001-50ML',
  mpn: 'SMLF-ODST-50',
  title: 'Smelloff ODORSTRIKE Fabric Odor Eliminator Spray (50ml)',
  shortTitle: 'ODORSTRIKE 50ml',
  brand: 'Smelloff',
  size: '50ml',
  netQuantity: '50ml / 1.69 fl oz',
  price: 229,
  mrp: 499,
  currency: 'INR',
  shippingCost: 0,
  codFee: 60,
  availability: 'in_stock',
  countryOfOrigin: 'India',
  manufacturer: {
    name: 'Smelloff',
    address: 'Hyderabad, Telangana 500081, India',
    email: 'smelloffsupport@gmail.com',
    phone: '+919392974031'
  }
};

export const BUNDLES_CONFIG = {
  enabled: false, // Flagged for controlled experimentation; when enabled, maps to pure integer multiples of OS-001-50ML
  variants: {
    solo: { id: 'solo', qty: 1, title: '1 × 50ml Bottle', sku: 'OS-001-50ML', price: 229, mrp: 499, badge: 'Standard' },
    duo:  { id: 'duo',  qty: 2, title: '2 × 50ml Bottles', sku: 'OS-001-50ML', price: 458, mrp: 998, badge: 'Home & Commute' },
    trio: { id: 'trio', qty: 3, title: '3 × 50ml Bottles', sku: 'OS-001-50ML', price: 687, mrp: 1497, badge: 'Triple Pack' }
  }
};

/**
 * Authoritative Server-side Price & Total Calculator
 * Prevents client-side price tampering by recalculating total strictly from quantity and method.
 */
export function calculateOrderTotal(quantity = 1, paymentMethod = 'prepaid') {
  const qty = Math.max(1, Math.min(20, Math.round(Number(quantity) || 1)));
  const unitPrice = BASE_PRODUCT.price;
  const unitMrp = BASE_PRODUCT.mrp;
  const subtotal = qty * unitPrice;
  const mrpTotal = qty * unitMrp;
  const shipping = BASE_PRODUCT.shippingCost;
  const isCod = String(paymentMethod || '').toLowerCase() === 'cod';
  const codFee = isCod ? BASE_PRODUCT.codFee : 0;
  const total = subtotal + shipping + codFee;
  const amountPaise = total * 100;

  return {
    sku: BASE_PRODUCT.sku,
    title: BASE_PRODUCT.title,
    qty,
    unitPrice,
    unitMrp,
    subtotal,
    mrpTotal,
    shipping,
    codFee,
    total,
    amountPaise,
    currency: BASE_PRODUCT.currency,
    isCod
  };
}
