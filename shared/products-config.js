import { SMELLOFF_PRODUCT_TRUTH as T } from './product-truth.js';
export { SMELLOFF_PRODUCT_TRUTH } from './product-truth.js';
import rawConfig from '../config/product.json' with { type: 'json' };
const { product: P, brand: B, shipping: S, formula: F } = rawConfig;

// Centralized commercial single source of truth for Smelloff / ODORSTRIKE.
// Authoritative definitions for SKU, pricing, MRP, COD fee, quantity limits,
// approved claims, order states, and server calculation logic.
// Customer-facing facts live in /config/product.json (and shared/product-truth.js).

export const BASE_PRODUCT = {
  id: 'odorstrike-50ml',
  sku: P.sku,
  mpn: P.mpn,
  title: P.title,
  shortTitle: P.shortTitle,
  brand: B.name,
  category: P.categoryDisplay || 'Fabric Odor Eliminator Spray for Clothes',
  size: P.size,
  netQuantity: P.netQuantity,
  price: P.price,
  mrp: P.mrp,
  currency: P.currency,
  shippingCost: S.prepaid.rate,
  codFee: P.codFee,
  allowedQuantities: P.allowedQuantities,
  minQuantity: P.minQuantity,
  maxQuantity: P.maxQuantity,
  availability: P.availabilityStatus,
  countryOfOrigin: B.country,
  sprayCapacity: `~${P.spraysApprox} fine mist sprays per ${P.size} bottle`,
  ingredientsSummary: `Formula ${F.version} — ${F.heroActives.join(' and ')} as hero actives in an 11-ingredient INCI, not the only ingredients`,
  usageInstructions: `Hold bottle ${T.sprayDistance} from clothing. ${T.targetedDose} for a targeted/midday reset; ${T.fullShirtDose} for a full shirt; ${T.jacketDose} for a jacket. Allow ${T.dryTime} to air-dry.`,
  manufacturer: {
    name: B.founder,
    address: B.address,
    email: B.supportEmail,
    phone: B.whatsappNumber
  }
};

export const BUNDLES_CONFIG = {
  enabled: false, // Pure single-SKU configuration (₹229 per 50ml unit)
  variants: {
    solo: { id: 'solo', qty: 1, title: '1 × 50ml Bottle', sku: P.sku, price: P.price, mrp: P.mrp, badge: 'Standard' }
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
    claim: 'Light fresh fabric scent — not a perfume. ODORSTRIKE is a fabric-only odor-control mist with a light, crisp fabric scent that provides sensory confirmation of clean fabric while targeting unwanted odor in the weave.',
    status: 'VERIFIED',
    source: 'Formulation Architecture (Light fresh fabric scent + HPβCD/Zinc PCA actives)'
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
    claim: 'Dries clear with no stiff residue when sprayed from recommended 15–20 cm distance.',
    status: 'VERIFIED',
    source: 'Aqueous mist dispersion testing'
  },
  PROHIBITED_CLAIMS: [
    'anti-regrowth / anti regrowth',
    'instant / instantly kills smell',
    'kills bacteria / antimicrobial / antibacterial / biocidal drug claim',
    'skin-safe / dermatologically tested / cosmetic skin claim',
    'zero residue / no white marks absolute claim',
    'cabin-safe / guaranteed airport-security clearance',
    'week-of-travel guarantee / 1 bottle for full trip guarantee',
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
  MAGIC_CHECKOUT: {
    initialStatus: 'checkout_pending',
    validTransitions: [
      'checkout_pending',
      'confirmed',
      'placed',
      'failed',
      'cancelled',
      'packed',
      'dispatched',
      'out_for_delivery',
      'delivered'
    ],
    transitionMap: {
      checkout_pending: ['confirmed', 'placed', 'failed', 'cancelled'],
      confirmed: ['packed', 'dispatched', 'cancelled'],
      placed: ['confirmed', 'packed', 'dispatched', 'cancelled'],
      failed: ['checkout_pending', 'cancelled'],
      cancelled: [],
      packed: ['dispatched', 'cancelled'],
      dispatched: ['out_for_delivery', 'delivered', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: []
    }
  },
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

  const method = String(paymentMethod || '').toLowerCase();
  let lifecycle = ORDER_LIFECYCLE.PREPAID_UPI;
  if (method === 'cod') lifecycle = ORDER_LIFECYCLE.COD;
  else if (method === 'pending' || currentStatus === 'checkout_pending') lifecycle = ORDER_LIFECYCLE.MAGIC_CHECKOUT;

  const allowedNext = lifecycle.transitionMap[currentStatus];
  if (!allowedNext || !Array.isArray(allowedNext)) return false;
  return allowedNext.includes(targetStatus);
}

/**
 * Authoritative Server-side Price & Total Calculator
 * Enforces strict quantity bounds [1..BASE_PRODUCT.maxQuantity], recomputes all sums and taxes server-side.
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
