/**
 * scripts/product-config.mjs
 * 
 * Build-time and server-side authoritative utility exposing /config/product.json.
 * Acts as the single source of truth helper across build scripts, API validation,
 * schema generation, and templates.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const CONFIG_PATH = join(ROOT_DIR, 'config', 'product.json');

let cachedConfig = null;

export function getProductConfig() {
  if (!cachedConfig) {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(raw);
  }
  return cachedConfig;
}

export const PRODUCT_CONFIG = getProductConfig();
export const BRAND = PRODUCT_CONFIG.brand;
export const PRODUCT = PRODUCT_CONFIG.product;
export const SHIPPING = PRODUCT_CONFIG.shipping;
export const RETURNS = PRODUCT_CONFIG.returns;
export const USAGE = PRODUCT_CONFIG.usage;
export const FORMULA = PRODUCT_CONFIG.formula;
export const CLAIMS = {
  ...PRODUCT_CONFIG.claims,
  forbidden: [
    ...(PRODUCT_CONFIG.claims.prohibited || []),
    'Zinc-Ricinoleate (formula v3.1 uses Zinc PCA + HPβCD, never describe as Zinc-Ricinoleate)',
    'skin deodorant or antiperspirant',
    'kills bacteria / antimicrobial drug claim'
  ]
};
PRODUCT_CONFIG.claims.forbidden = CLAIMS.forbidden;

const ORG_ID = 'https://smelloff.in/#organization';
const RETURN_POLICY_ID = 'https://smelloff.in/#return-policy';
// The one Person behind every post byline, the Organization's founder and /about.
export const FOUNDER_ID = 'https://smelloff.in/#founder';
// The co-founder: on the Organization and /about, never a post byline.
export const COFOUNDER_ID = 'https://smelloff.in/#cofounder';

/** The store's return policy — on the Organization and on every Offer. */
export function buildReturnPolicyJsonLd() {
  const r = getProductConfig().returns;
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': RETURN_POLICY_ID,
    'applicableCountry': r.applicableCountry,
    // Where a return is sent (Hyderabad). Recommended by Google's return-policy docs.
    'returnPolicyCountry': r.applicableCountry,
    'returnPolicyCategory': r.policyCategory,
    'merchantReturnDays': r.windowDays,
    'returnMethod': r.returnMethod,
    'returnFees': r.returnFees,
    'refundType': 'https://schema.org/FullRefund',
    'merchantReturnLink': 'https://smelloff.in/returns'
  };
}

/**
 * Generate canonical Schema.org Product JSON-LD object.
 *
 * This is what Google reads for product snippets and merchant listings, so
 * every value must match what the page and the policy pages say: dispatch
 * "within 48 hours" (handling 0–2 days, Mon–Sat) and transit "3–5 / 5–7 /
 * 7–10 business days" (3–10) per /shipping.
 */
export function buildProductJsonLd(options = {}) {
  const cfg = getProductConfig();
  const p = cfg.product;
  const b = cfg.brand;
  const s = cfg.shipping;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${b.website}/#odorstrike`,
    'name': p.name,
    'alternateName': p.alternateNames,
    'url': p.url,
    'description': p.description,
    'image': p.images,
    'brand': {
      '@type': 'Brand',
      'name': b.name,
      'logo': b.logo
    },
    'manufacturer': { '@id': ORG_ID },
    'category': p.category,
    'size': p.size,
    'audience': {
      '@type': 'PeopleAudience',
      'suggestedGender': 'male',
      'geographicArea': {
        '@type': 'Country',
        'name': b.country
      }
    },
    'sku': p.sku,
    'mpn': p.mpn,
    'offers': {
      '@type': 'Offer',
      'name': `${p.shortTitle} — Single Bottle`,
      'sku': p.sku,
      'priceCurrency': p.currency,
      'price': `${p.price}.00`,
      // The MRP the page prints ("M.R.P. ₹499 · 54% OFF"), shown struck
      // through beside the offer price. Google's merchant-listing docs: "You
      // must set the priceType to https://schema.org/StrikethroughPrice"
      // (ListPrice was only accepted for a transition period).
      'priceSpecification': {
        '@type': 'UnitPriceSpecification',
        'priceType': 'https://schema.org/StrikethroughPrice',
        'price': `${p.mrp}.00`,
        'priceCurrency': p.currency
      },
      'availability': p.availability,
      'itemCondition': p.itemCondition,
      'url': p.buyUrl,
      'seller': { '@id': ORG_ID },
      'validFrom': p.validFrom,
      'priceValidUntil': p.priceValidUntil,
      'shippingDetails': {
        '@type': 'OfferShippingDetails',
        'shippingRate': {
          '@type': 'MonetaryAmount',
          'value': `${s.prepaid.rate}.00`,
          'currency': p.currency
        },
        'shippingDestination': {
          '@type': 'DefinedRegion',
          'addressCountry': s.destinationCountry
        },
        'deliveryTime': {
          '@type': 'ShippingDeliveryTime',
          'businessDays': {
            '@type': 'OpeningHoursSpecification',
            'dayOfWeek': s.businessDays.map((d) => `https://schema.org/${d}`)
          },
          'handlingTime': {
            '@type': 'QuantitativeValue',
            'minValue': s.handlingTimeDays.min,
            'maxValue': s.handlingTimeDays.max,
            'unitCode': 'DAY'
          },
          'transitTime': {
            '@type': 'QuantitativeValue',
            'minValue': s.transitTimeDays.min,
            'maxValue': s.transitTimeDays.max,
            'unitCode': 'DAY'
          }
        }
      },
      'hasMerchantReturnPolicy': buildReturnPolicyJsonLd()
    }
  };

  if (options.includeRating && options.ratingValue && options.reviewCount) {
    productLd.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': String(options.ratingValue),
      'bestRating': '5',
      'worstRating': '1',
      'ratingCount': options.ratingCount,
      'reviewCount': options.reviewCount
    };
  }

  return productLd;
}

/**
 * Generate canonical Schema.org Organization JSON-LD object.
 *
 * One entity, one @id, identical on / and /odorstrike. It used to be two
 * different blocks sharing "#organization" on the PDP (an Organization and an
 * OnlineStore with a different description and phone format), which hands
 * Google two conflicting versions of the same business. OnlineStore is the
 * Organization subtype Google recommends for merchants; the store-wide return
 * policy lives on it.
 */
export function buildOrganizationJsonLd() {
  const cfg = getProductConfig();
  const b = cfg.brand;

  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': ORG_ID,
    'name': b.name,
    'alternateName': b.alternateNames,
    'legalName': b.legalName,
    'url': b.website,
    'logo': {
      '@type': 'ImageObject',
      'url': b.logo,
      'width': 180,
      'height': 180
    },
    'image': b.image,
    'email': b.supportEmail,
    'telephone': b.supportPhoneRaw,
    'foundingDate': '2026',
    'foundingLocation': {
      '@type': 'Place',
      'name': `${b.city}, ${b.country}`
    },
    'founder': [
      {
        '@type': 'Person',
        '@id': FOUNDER_ID,
        'name': b.founder,
        'jobTitle': b.jobTitle,
        'url': `${b.website}/about`
      },
      {
        '@type': 'Person',
        '@id': COFOUNDER_ID,
        'name': b.coFounder,
        'jobTitle': b.coFounderJobTitle,
        'url': `${b.website}/about`
      }
    ],
    'description': b.description,
    'slogan': b.slogan,
    'knowsAbout': [
      'fabric odor',
      'sweat smell in clothes',
      'fabric odor neutralizer',
      'cyclodextrin',
      'zinc pca',
      'shirt collar odor',
      'polyester odor'
    ],
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Sanathnagar, Erragadda',
      'addressLocality': b.addressLocality,
      'addressRegion': b.addressRegion,
      'postalCode': b.postalCode,
      'addressCountry': b.countryCode
    },
    'areaServed': { '@type': 'Country', 'name': b.country },
    'contactPoint': [
      {
        '@type': 'ContactPoint',
        'telephone': b.supportPhoneRaw,
        'contactType': 'customer service',
        'email': b.supportEmail,
        'areaServed': b.countryCode,
        'availableLanguage': ['English', 'Hindi', 'Telugu']
      }
    ],
    'hasMerchantReturnPolicy': buildReturnPolicyJsonLd(),
    'sameAs': b.sameAs
  };
}

/**
 * WebSite entity. `alternateName` feeds Google's site-name system: people
 * search "smell off" (317 impressions in GSC, 4.7% CTR vs 60% for
 * "smelloff"), so the spaced spelling is declared as ours.
 */
export function buildWebSiteJsonLd() {
  const b = getProductConfig().brand;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${b.website}/#website`,
    'name': b.name,
    'alternateName': ['Smell Off', 'smelloff.in'],
    'url': `${b.website}/`,
    'inLanguage': 'en-IN',
    'publisher': { '@id': ORG_ID }
  };
}

/**
 * Calculate order total with strict server validation.
 */
export function calculateOrderTotal(quantity = 1, paymentMethod = 'prepaid') {
  const cfg = getProductConfig();
  const p = cfg.product;
  const isCod = String(paymentMethod || '').toLowerCase() === 'cod';

  let qty = parseInt(quantity, 10);
  if (isNaN(qty) || !Number.isInteger(qty) || qty < p.minQuantity) {
    qty = p.minQuantity;
  }
  if (qty > p.maxQuantity) {
    qty = p.maxQuantity;
  }

  const unitPrice = p.price;
  const unitMrp = p.mrp;
  // "5 for ₹899" per five, "2 for ₹419" per pair left, an odd bottle at the unit price.
  const pairPrice = Number(p.pairPrice) || unitPrice * 2;
  const fivePrice = Number(p.fivePackPrice) || pairPrice * 2 + unitPrice;
  const rest = qty % 5;
  const subtotal = Math.floor(qty / 5) * fivePrice + Math.floor(rest / 2) * pairPrice + (rest % 2) * unitPrice;
  const mrpTotal = qty * unitMrp;
  const shipping = cfg.shipping.prepaid.rate;
  const codFee = isCod ? p.codFee : 0;
  const total = subtotal + shipping + codFee;
  const amountPaise = total * 100;

  return {
    sku: p.sku,
    mpn: p.mpn,
    title: p.title,
    qty,
    quantity: qty,
    unitPrice,
    unitMrp,
    subtotal,
    mrpTotal,
    shipping,
    codFee,
    total,
    amountPaise,
    totalPaise: amountPaise,
    currency: p.currency,
    isCod
  };
}

/**
 * Generate products.json catalog feed matching JSON Feed spec.
 */
export function buildProductsCatalogFeed() {
  const cfg = getProductConfig();
  const p = cfg.product;
  const b = cfg.brand;
  const s = cfg.shipping;
  const r = cfg.returns;

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${b.name} Product Catalog`,
    home_page_url: `${b.website}/`,
    feed_url: `${b.website}/products.json`,
    items: [
      {
        id: p.sku,
        sku: p.sku,
        mpn: p.mpn,
        title: p.title,
        description: p.description,
        url: p.url,
        image_url: p.images[0],
        brand: b.name,
        price: p.price,
        currency: p.currency,
        availability: p.availabilityStatus,
        condition: 'new',
        shipping: {
          country: s.destinationCountry,
          service: 'Standard',
          price: s.prepaid.rate,
          currency: p.currency
        },
        return_policy: {
          country: r.applicableCountry,
          return_window_days: r.windowDays,
          policy_category: r.policyCategory
        }
      }
    ]
  };
}

export default {
  getProductConfig,
  PRODUCT_CONFIG,
  BRAND,
  PRODUCT,
  SHIPPING,
  RETURNS,
  USAGE,
  FORMULA,
  CLAIMS,
  buildProductJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildReturnPolicyJsonLd,
  calculateOrderTotal,
  buildProductsCatalogFeed
};
