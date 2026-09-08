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

/**
 * Generate canonical Schema.org Product JSON-LD object.
 */
export function buildProductJsonLd(options = {}) {
  const cfg = getProductConfig();
  const p = cfg.product;
  const b = cfg.brand;
  const s = cfg.shipping;
  const r = cfg.returns;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${b.website}/#odorstrike`,
    'name': p.name,
    'alternateName': p.alternateNames,
    'description': p.description,
    'image': p.images,
    'brand': {
      '@type': 'Brand',
      'name': b.name,
      'logo': b.logo
    },
    'manufacturer': {
      '@type': 'Organization',
      'name': b.name,
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': b.addressLocality,
        'addressRegion': b.addressRegion,
        'addressCountry': b.countryCode
      }
    },
    'category': p.category,
    'audience': {
      '@type': 'PeopleAudience',
      'suggestedGender': 'male',
      'geographicArea': {
        '@type': 'Country',
        'name': b.country
      }
    },
    'material': 'HPβCD (Cyclodextrin), Zinc PCA, Triethyl Citrate, Zinc Gluconate',
    'sku': p.sku,
    'mpn': p.mpn,
    'offers': {
      '@type': 'Offer',
      'name': `${p.shortTitle} — Single Bottle`,
      'sku': p.sku,
      'priceCurrency': p.currency,
      'price': `${p.price}.00`,
      'availability': p.availability,
      'itemCondition': p.itemCondition,
      'url': p.buyUrl,
      'seller': {
        '@type': 'Organization',
        'name': b.name,
        '@id': `${b.website}/#organization`
      },
      'validFrom': p.validFrom,
      'priceValidUntil': p.priceValidUntil,
      'shippingDetails': {
        '@type': 'OfferShippingDetails',
        'shippingRate': {
          '@type': 'MonetaryAmount',
          'value': '0.00',
          'currency': p.currency
        },
        'shippingDestination': {
          '@type': 'DefinedRegion',
          'addressCountry': s.destinationCountry
        },
        'deliveryTime': {
          '@type': 'ShippingDeliveryTime',
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
      'hasMerchantReturnPolicy': {
        '@type': 'MerchantReturnPolicy',
        'applicableCountry': r.applicableCountry,
        'returnPolicyCategory': r.policyCategory,
        'merchantReturnDays': r.windowDays,
        'returnMethod': r.returnMethod,
        'returnFees': r.returnFees
      }
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
 */
export function buildOrganizationJsonLd() {
  const cfg = getProductConfig();
  const b = cfg.brand;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${b.website}/#organization`,
    'name': b.name,
    'alternateName': b.alternateNames,
    'url': b.website,
    'logo': {
      '@type': 'ImageObject',
      'url': b.logo,
      'width': 180,
      'height': 180
    },
    'image': b.image,
    'foundingDate': '2026',
    'foundingLocation': {
      '@type': 'Place',
      'name': `${b.city}, ${b.country}`
    },
    'founder': {
      '@type': 'Person',
      'name': b.founder,
      'jobTitle': b.jobTitle,
      'url': `${b.website}/about`,
      'worksFor': b.name
    },
    'description': b.description,
    'slogan': b.slogan,
    'knowsAbout': [
      'fabric odor',
      'sweat smell in clothes',
      'fabric odor neutralizer',
      "men's grooming",
      'fabric care',
      'shirt collar odor',
      'polyester odor'
    ],
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': b.addressLocality,
      'addressRegion': b.addressRegion,
      'postalCode': b.postalCode,
      'addressCountry': b.countryCode
    },
    'contactPoint': [
      {
        '@type': 'ContactPoint',
        'telephone': b.supportPhone,
        'contactType': 'customer service',
        'email': b.supportEmail,
        'areaServed': b.countryCode,
        'availableLanguage': ['English', 'Hindi', 'Telugu']
      }
    ],
    'sameAs': b.sameAs
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
  const subtotal = qty * unitPrice;
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
        url: `${b.website}/`,
        image_url: p.imageUrl,
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
  calculateOrderTotal,
  buildProductsCatalogFeed
};
