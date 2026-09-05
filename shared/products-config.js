import { SMELLOFF_PRODUCT_TRUTH as T } from './product-truth.js';

export { SMELLOFF_PRODUCT_TRUTH } from './product-truth.js';

// Centralized commercial single source of truth for Smelloff / ODORSTRIKE.
// Authoritative definitions for SKU, pricing, MRP, COD fee, quantity limits,
// approved claims, order states, and server calculation logic.
// Customer-facing facts (dose, distance, dry time, formula, testers) live in
// shared/product-truth.js — keep this file's copy in lockstep.

export const BASE_PRODUCT = {
  id: 'odorstrike-50ml',
  sku: T.sku,
  mpn: T.mpn,
  title: 'Smelloff ODORSTRIKE Fabric Odor Eliminator Spray (50ml)',
  shortTitle: 'ODORSTRIKE 50ml',
  brand: T.brand,
  category: 'Fabric Odor Eliminator Spray for Clothes',
  size: T.size,
  netQuantity: '50ml / 1.69 fl oz',
  price: T.pricePrepaid,
  mrp: T.mrp,
  currency: T.currency,
  shippingCost: 0,
  codFee: T.codFee,
  allowedQuantities: [1, 2, 3, 4, 5],
  minQuantity: 1,
  maxQuantity: 5,
  availability: 'in_stock',
  countryOfOrigin: 'India',
  sprayCapacity: `~${T.spraysApprox} fine mist sprays per 50ml bottle`,
  ingredientsSummary: 'Formula v3.1 — HPβCD and Zinc PCA as hero actives in an 11-ingredient INCI, not the only ingredients',
  usageInstructions: `Hold bottle ${T.sprayDistance} from clothing. ${T.targetedDose} for a targeted/midday reset; ${T.fullShirtDose} for a full shirt; ${T.jacketDose} for a jacket. Allow ${T.dryTime} to air-dry.`,
  manufacturer: {
    name: T.manufacturer.name,
    address: T.manufacturer.address,
    email: T.manufacturer.email,
    phone: T.whatsappNumber
  }
};

export const BUNDLES_CONFIG = {
  enabled: false, // Pure single-SKU configuration (₹229 per 50ml unit)
  variants: {
    solo: { id: 'solo', qty: 1, title: '1 × 50ml Bottle', sku: 'OS-001-50ML', price: 229, mrp: 499, badge: 'Standard' }
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
  FRAGRANCE_POSITIONING: {
    claim: 'Light scent. Serious odor control. ODORSTRIKE is a fabric odor-control mist with a light, short-lasting fragrance. It gives clothes a subtle fresh scent immediately after spraying while targeting unwanted odor in the fabric.',
    status: 'VERIFIED',
    source: 'Formulation Architecture (Subtle fresh top note + HPβCD/Zinc PCA actives)'
  },
  TARGETED_ELIMINATION: {
    claim: 'Targets and traps sweat and environmental odor molecules at the clothing fabric weave.',
    status: 'VERIFIED',
    source: 'Active cyclodextrin mechanism testing'
  },
  PROTECTION_DURATION: {
    claim: 'Up to 8 hours of odor protection on fabric under normal office/commute conditions.',
    status: 'QUALIFIED',
    source: 'Fabric wear retention testing (qualified conditions)'
  },
  FABRIC_SAFETY: {
    claim: 'Safe for regular use on everyday washable clothing fabrics (cotton, polyester, denim, blends, wool). Patch-test silk.',
    status: 'VERIFIED',
    source: 'Fabric compatibility audit'
  },
  NON_STAINING: {
    claim: 'Dries clear with zero residue when sprayed from recommended 15–20 cm distance.',
    status: 'VERIFIED',
    source: 'Aqueous mist dispersion testing'
  },
  PROHIBITED_CLAIMS: [
    'instant / instantly kills smell',
    'kills bacteria / antimicrobial drug claim',
    '10-second miracle cure',
    'works on 100% of all fabrics including raw dry-clean-only silks',
    'guaranteed odor cure',
    'fragrance-free / fragrance free / zero fragrance / no fragrance / unscented / zero scent / scentless / no scent / contains no fragrance / unfragranced (product contains a light fresh scent on spray)'
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

  const subtotal = qty * BASE_PRODUCT.price;

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
