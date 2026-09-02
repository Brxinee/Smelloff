// Centralized commercial single source of truth for Smelloff / ODORSTRIKE.
// Authoritative definitions for SKU, pricing, MRP, COD fee, quantity limits,
// approved claims, order states, and server calculation logic.

export const BASE_PRODUCT = {
  id: 'odorstrike-50ml',
  sku: 'OS-001-50ML',
  mpn: 'SMLF-ODST-50',
  title: 'Smelloff ODORSTRIKE Fabric Odor Eliminator Spray (50ml)',
  shortTitle: 'ODORSTRIKE 50ml',
  brand: 'Smelloff',
  category: 'Fabric Odor Eliminator Spray for Clothes',
  size: '50ml',
  netQuantity: '50ml / 1.69 fl oz',
  price: 229,
  mrp: 499,
  currency: 'INR',
  shippingCost: 0,
  codFee: 60,
  allowedQuantities: [1, 2, 3, 4, 5],
  minQuantity: 1,
  maxQuantity: 5,
  availability: 'in_stock',
  countryOfOrigin: 'India',
  sprayCapacity: '~250 fine mist sprays per 50ml bottle',
  ingredientsSummary: 'Odor-trapping cyclodextrin complex, fabric neutralizers, purified aqueous carrier',
  usageInstructions: 'Hold bottle 10–15cm from clothing. Mist 2–3 sprays evenly over sweat-prone fabric zones (underarms, chest, collar). Allow 30 seconds to air-dry.',
  manufacturer: {
    name: 'Smelloff',
    address: 'Hyderabad, Telangana 500081, India',
    email: 'smelloffsupport@gmail.com',
    phone: '+919392974031'
  }
};

export const BUNDLES_CONFIG = {
  enabled: true, // Enabled for single source of truth bundle pricing
  variants: {
    solo: { id: 'solo', qty: 1, title: '1 × 50ml Bottle', sku: 'OS-001-50ML', price: 229, mrp: 499, badge: 'Standard' },
    duo:  { id: 'duo',  qty: 2, title: '2 × 50ml Bottles', sku: 'OS-001-50ML', price: 429, mrp: 998, badge: 'Home & Commute' },
    trio: { id: 'trio', qty: 3, title: '3 × 50ml Bottles', sku: 'OS-001-50ML', price: 599, mrp: 1497, badge: 'Triple Pack' }
  }
};

/**
 * Authoritative Approved Claims Dictionary
 */
export const APPROVED_CLAIMS = {
  CATEGORY_CLARITY: {
    claim: 'Pocket fabric odor spray for clothing — not a perfume, not a deodorant.',
    status: 'VERIFIED',
    source: 'Product Specification & Formulation Design'
  },
  TARGETED_ELIMINATION: {
    claim: 'Targets and traps sweat and environmental odor molecules at the clothing fabric weave.',
    status: 'VERIFIED',
    source: 'Active cyclodextrin mechanism testing'
  },
  PROTECTION_DURATION: {
    claim: 'Up to 8 hours of odor protection on fabric under typical daily wear.',
    status: 'QUALIFIED',
    source: 'Fabric wear retention testing (qualified conditions)'
  },
  FABRIC_SAFETY: {
    claim: 'Safe for regular use on everyday washable clothing fabrics (cotton, polyester, denim, blends).',
    status: 'VERIFIED',
    source: 'Fabric compatibility audit'
  },
  NON_STAINING: {
    claim: 'Dries clear with zero residue when sprayed from recommended 10–15cm distance.',
    status: 'VERIFIED',
    source: 'Aqueous mist dispersion testing'
  },
  PROHIBITED_CLAIMS: [
    'instant / instantly kills smell',
    'kills bacteria / antimicrobial drug claim',
    '10-second miracle cure',
    'works on 100% of all fabrics including raw dry-clean-only silks',
    'guaranteed odor cure',
    'fragrance-free / unscented (contains subtle active neutralizer note)'
  ]
};

/**
 * Authoritative Order Lifecycle States
 */
export const ORDER_LIFECYCLE = {
  PREPAID_UPI: {
    initialStatus: 'upi_pending',
    validTransitions: [
      'upi_pending',
      'confirmed',
      'failed',
      'packed',
      'dispatched',
      'out_for_delivery',
      'delivered',
      'cancelled'
    ],
    transitionMap: {
      upi_pending: ['confirmed', 'failed', 'cancelled'],
      failed: ['upi_pending', 'cancelled'],
      confirmed: ['packed', 'dispatched', 'cancelled'],
      packed: ['dispatched', 'cancelled'],
      dispatched: ['out_for_delivery', 'delivered', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    }
  },
  COD: {
    initialStatus: 'placed',
    validTransitions: [
      'placed',
      'confirmed',
      'packed',
      'dispatched',
      'out_for_delivery',
      'delivered',
      'cancelled'
    ],
    transitionMap: {
      placed: ['confirmed', 'packed', 'dispatched', 'cancelled'],
      confirmed: ['packed', 'dispatched', 'cancelled'],
      packed: ['dispatched', 'cancelled'],
      dispatched: ['out_for_delivery', 'delivered', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    }
  }
};

/**
 * Validate order state transitions strictly against the lifecycle rules.
 */
export function isValidTransition(currentStatus, targetStatus, paymentMethod = 'prepaid') {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true; // Idempotent no-op

  const isCod = String(paymentMethod || '').toLowerCase() === 'cod';
  const lifecycle = isCod ? ORDER_LIFECYCLE.COD : ORDER_LIFECYCLE.PREPAID_UPI;

  const allowedNext = lifecycle.transitionMap[currentStatus];
  if (!allowedNext || !Array.isArray(allowedNext)) return false;
  return allowedNext.includes(targetStatus);
}

/**
 * Authoritative Server-side Price & Total Calculator
 * Enforces strict quantity bounds [1..5], recomputes all sums and taxes server-side.
 */
export function calculateOrderTotal(quantity = 1, paymentMethod = 'prepaid') {
  let qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > BASE_PRODUCT.maxQuantity) qty = BASE_PRODUCT.maxQuantity;

  let subtotal = 0;
  if (qty === 1) {
    subtotal = BUNDLES_CONFIG.variants.solo.price; // 229
  } else if (qty === 2) {
    subtotal = BUNDLES_CONFIG.variants.duo.price; // 429
  } else if (qty === 3) {
    subtotal = BUNDLES_CONFIG.variants.trio.price; // 599
  } else {
    subtotal = qty * BASE_PRODUCT.price;
  }

  const unitPrice = Math.round((subtotal / qty) * 100) / 100;
  const unitMrp = BASE_PRODUCT.mrp;
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
    isCod,
    status: isCod ? ORDER_LIFECYCLE.COD.initialStatus : ORDER_LIFECYCLE.PREPAID_UPI.initialStatus
  };
}

export function getPricingForQuantity(quantity = 1, paymentMethod = 'prepaid') {
  return calculateOrderTotal(quantity, paymentMethod);
}
