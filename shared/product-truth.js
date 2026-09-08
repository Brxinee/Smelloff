// SMELLOFF_PRODUCT_TRUTH
// Single customer-facing source of truth for Smelloff / ODORSTRIKE.
// Derived directly from the canonical /config/product.json single source of truth.
// Do not encode month-based bottle life. Do not invent reviews, counts, or ratings.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '..', 'config', 'product.json');

const rawConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const { brand: B, product: P, shipping: S, returns: R, usage: U, formula: F } = rawConfig;

export const SMELLOFF_PRODUCT_TRUTH = {
  productName: P.shortName,
  brand: B.name,
  sku: P.sku,
  mpn: P.mpn,
  size: P.size,
  category: 'Fabric-only odor mist',
  pricePrepaid: P.price,
  mrp: P.mrp,
  codFee: P.codFee,
  priceCod: P.priceCod,
  freeShippingPrepaid: S.prepaid.free,
  currency: P.currency,
  spraysApprox: P.spraysApprox,
  refreshesApprox: P.refreshesApprox,
  targetedDose: U.doses.targeted,
  fullShirtDose: U.doses.fullShirt,
  jacketDose: U.doses.jacket,
  lightDose: U.doses.light,
  sprayDistance: U.sprayDistance,
  dryTime: U.dryTime,
  dryTimeConservativeNote: U.dryTimeConservativeNote,
  performanceWindow: U.performanceWindow,
  formulaVersion: F.version,
  heroActives: F.heroActives,
  fourLayerSystem: F.fourLayerSystem,
  inci: F.inci,
  compatibleFabrics: F.compatibleFabrics,
  restrictedFabrics: F.restrictedFabrics,
  dispatchWindow: S.dispatchWindow,
  dispatchCodNote: S.dispatchCodNote,
  transit: {
    metros: S.transitMetros,
    tier23: S.transitTier23,
    remoteNortheast: S.transitRemote,
  },
  returnsPolicy: {
    source: '/returns',
    windowDays: R.windowDays,
    minimumFull: R.condition.split(' ')[4] ? `${R.condition.split(' ')[4]} full` : '80% full',
    reversePickup: R.reversePickup,
    summary: R.summary,
  },
  madeIn: `${B.city}, ${B.country}`,
  manufacturer: {
    name: B.founder,
    operator: B.operator,
    address: B.address,
    email: B.supportEmail,
  },
  whatsappNumber: B.whatsappNumber,
  whatsappDisplay: B.whatsappDisplay,
  testerProfiles: [
    {
      id: 'karthik-r-hyderabad',
      name: 'Karthik R.',
      context: 'Software Engineer · Hyderabad Metro commute',
      source: 'homepage',
    },
    {
      id: 'rohit-m-banjara',
      name: 'Rohit M.',
      context: 'Fitness Enthusiast · Banjara Hills',
      source: 'homepage',
    },
    {
      id: 'ananya-v-hitec',
      name: 'Ananya V.',
      context: 'Product Lead · Hitec City',
      source: 'homepage',
    },
    {
      id: 'rohit-26-bengaluru',
      name: 'Rohit',
      context: '26 / Bengaluru · early tester',
      source: 'pdp',
    },
    {
      id: 'aakash-24-pune',
      name: 'Aakash',
      context: '24 / Pune · early tester',
      source: 'pdp',
    },
    {
      id: 'karan-29-delhi',
      name: 'Karan',
      context: '29 / Delhi · early tester',
      source: 'pdp',
    },
    {
      id: 'rohit-s-hyderabad',
      name: 'Rohit S.',
      context: 'Hyderabad · commute / bike',
      source: 'reviews-feed',
    },
  ],
};

export default SMELLOFF_PRODUCT_TRUTH;
