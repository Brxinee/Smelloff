/**
 * Shared domain types for the Smelloff storefront.
 * All content JSON in /content conforms to these shapes.
 */

/** Prices are stored as integer paise-free rupees (₹). */
export type Rupees = number;

export interface Variant {
  /** Stable id used in the cart and analytics. */
  id: string;
  /** e.g. "Solo", "2-Pack", "3-Pack", "Trial". */
  label: string;
  /** Units of product in this pack. */
  units: number;
  /** Volume per unit, e.g. "50ml". */
  size: string;
  price: Rupees;
  /** Honest comparison total (units × solo price) for the savings label. */
  compareAt?: Rupees;
  /** Human savings label, e.g. "Save ₹59". Derived but cached for content edits. */
  savingsLabel?: string;
  /** Flag the merchandising "Most popular" pack. */
  highlighted?: boolean;
  /** Only purchasable as a first-order wedge (shown to new buyers only). */
  trialOnly?: boolean;
  /** Hidden/future variant (e.g. 100ml upgrade) — buildable but not listed. */
  hidden?: boolean;
}

export interface ProductInfo {
  /** Legal Metrology (Packaged Commodities) Rules 2011 — rendered on PDP. */
  netQuantity: string;
  manufacturer: string;
  marketer: string;
  address: string;
  mrpNote: string;
  manufactureDate: string;
  consumerCare: string;
  countryOfOrigin: string;
}

export interface Product {
  handle: string;
  name: string;
  descriptor: string;
  /** Short claim-safe summary. */
  summary: string;
  variants: Variant[];
  images: ProductImage[];
  /** Approx sprays per bottle, etc. */
  specs: { label: string; value: string }[];
  ingredients: string;
  info: ProductInfo;
}

export interface ProductImage {
  src: string;
  alt: string;
  /** Mark the primary/hero image. */
  primary?: boolean;
}

export interface CartItem {
  variantId: string;
  productHandle: string;
  name: string;
  label: string;
  price: Rupees;
  size: string;
  qty: number;
  image: string;
}

export type OrderPaymentMethod = "razorpay" | "cod";

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  customer: OrderCustomer;
  subtotal: Rupees;
  shipping: Rupees;
  codFee: Rupees;
  total: Rupees;
  paymentMethod: OrderPaymentMethod;
  createdAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface Review {
  id: string;
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  /** City/context for relatability. */
  location?: string;
  helpful?: number;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface BlogMeta {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  hero: string;
  heroAlt: string;
  featured?: boolean;
}
