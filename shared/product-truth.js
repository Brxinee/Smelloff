// SMELLOFF_PRODUCT_TRUTH
// Single customer-facing source of truth for Smelloff / ODORSTRIKE.
// Commercial checkout math still lives in products-config.js and must stay in sync.
// Do not encode month-based bottle life. Do not invent reviews, counts, or ratings.

export const SMELLOFF_PRODUCT_TRUTH = {
  productName: 'ODORSTRIKE',
  brand: 'Smelloff',
  sku: 'OS-001-50ML',
  mpn: 'SMLF-ODST-50',
  size: '50ml',
  category: 'Fabric-only odor mist',
  pricePrepaid: 229,
  mrp: 499,
  codFee: 60,
  priceCod: 289,
  freeShippingPrepaid: true,
  currency: 'INR',
  spraysApprox: 250,
  refreshesApprox: 100,
  targetedDose: '2–3 sprays',
  fullShirtDose: '4–5 sprays',
  jacketDose: '5–6 sprays',
  lightDose: '2–3 sprays',
  sprayDistance: '15–20 cm',
  dryTime: 'approximately 10 seconds',
  dryTimeConservativeNote:
    'In high humidity, wait until the fabric is fully dry before wearing. A conservative wait can take up to 30–60 seconds.',
  performanceWindow: 'Up to 8 hours under normal office/commute conditions',
  formulaVersion: 'v3.1',
  heroActives: ['HPβCD', 'Zinc PCA'],
  fourLayerSystem: [
    { id: 'trap', ingredient: 'HPβCD', role: 'Trap' },
    { id: 'neutralize', ingredient: 'Zinc PCA', role: 'Neutralize' },
    { id: 'prevent', ingredient: 'triethyl citrate', role: 'Prevent' },
    { id: 'antiregrowth', ingredient: 'zinc gluconate', role: 'Anti-regrowth' },
  ],
  inci: [
    { name: 'Water', role: 'Base' },
    { name: 'Isopropyl Alcohol', role: 'Solvent' },
    { name: 'Triethyl Citrate', role: 'Prevent' },
    { name: 'HPβCD (hydroxypropyl-β-cyclodextrin)', role: 'Trap' },
    { name: 'Polysorbate 20', role: 'Emulsifier' },
    { name: 'Zinc PCA', role: 'Neutralize' },
    { name: 'PE9010', role: 'Preservative' },
    { name: 'Fragrance', role: 'Light scent' },
    { name: 'Zinc Gluconate', role: 'Anti-regrowth' },
    { name: 'Ethylhexylglycerin', role: 'Preservative booster' },
    { name: 'Citric Acid', role: 'pH balancer' },
  ],
  compatibleFabrics: ['cotton', 'polyester', 'blends', 'denim', 'wool'],
  restrictedFabrics: {
    skin: 'Never. Fabric only. Not for skin, face, hair, or eyes.',
    leatherSuede: 'Do not use on leather or suede.',
    dryCleanOnly: 'Do not use on dry-clean-only garments.',
    silk: 'Patch-test silk, zari, and heavy embroidery on a hidden seam first.',
  },
  dispatchWindow: 'Within 48 hours of confirmation',
  dispatchCodNote: 'COD orders are dispatched after phone confirmation.',
  transit: {
    metros: '3–5 business days',
    tier23: '5–7 business days',
    remoteNortheast: '7–10 business days',
  },
  returnsPolicy: {
    source: '/returns',
    windowDays: 7,
    minimumFull: '80% full',
    reversePickup: true,
    summary:
      '7-day return window from delivery. Bottle must be at least 80% full and in original packaging. Reverse pickup where serviceable.',
  },
  madeIn: 'Hyderabad, India',
  manufacturer: {
    name: 'Jogdhande Nikhil Patil',
    operator: 'Smelloff (Sole Proprietorship)',
    address: 'Sanathnagar, Erragadda, Hyderabad, Telangana 500018, India',
    email: 'smelloffsupport@gmail.com',
  },
  whatsappNumber: '+919392974031',
  whatsappDisplay: '+91 93929 74031',
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
