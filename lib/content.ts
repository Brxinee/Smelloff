import productsData from "@/content/products.json";
import reviewsData from "@/content/reviews.json";
import faqData from "@/content/faq.json";
import navData from "@/content/nav.json";
import type { Product, Review, FaqItem, Variant, CartItem } from "@/types";
import { averageRating } from "@/lib/format";

/** Typed accessors for the founder-editable JSON content. */

const products = productsData as Record<string, Product>;

export function getProduct(handle: string): Product | undefined {
  return products[handle];
}

export function getAllProducts(): Product[] {
  return Object.values(products);
}

/** The single flagship product. */
export function getDefaultProduct(): Product {
  const p = products["odorstrike"];
  if (!p) throw new Error("Default product 'odorstrike' missing from content");
  return p;
}

/** Find a purchasable variant by id across the catalog. Hidden variants are
 * not purchasable. Returns the owning product alongside the variant. */
export function findVariant(
  variantId: string
): { product: Product; variant: Variant } | null {
  for (const product of getAllProducts()) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant && !variant.hidden) return { product, variant };
  }
  return null;
}

/**
 * Build an authoritative cart line item from a trusted catalog lookup.
 * Price, name, label, size and image come from the catalog — never the client.
 */
export function resolveLineItem(variantId: string, qty: number): CartItem | null {
  const found = findVariant(variantId);
  if (!found) return null;
  const { product, variant } = found;
  const image =
    product.images.find((i) => i.primary)?.src ?? product.images[0]?.src ?? "";
  const brand = product.name.split("—")[0]?.trim() ?? product.name;
  return {
    variantId: variant.id,
    productHandle: product.handle,
    name: product.name,
    label: `${brand} · ${variant.label}`,
    price: variant.price,
    size: variant.size,
    qty,
    image,
  };
}

/** Reprice a list of {variantId, qty} into authoritative cart items.
 * Throws on any unknown/non-purchasable variant. */
export function repriceCart(
  items: { variantId: string; qty: number }[]
): CartItem[] {
  return items.map((i) => {
    const item = resolveLineItem(i.variantId, i.qty);
    if (!item) throw new Error(`Unknown or unavailable variant: ${i.variantId}`);
    return item;
  });
}

export function getReviews(): Review[] {
  return reviewsData as Review[];
}

export function getReviewStats(): { average: number; count: number } {
  const reviews = getReviews();
  return {
    average: averageRating(reviews.map((r) => r.rating)),
    count: reviews.length,
  };
}

export function getFaq(): FaqItem[] {
  return faqData as FaqItem[];
}

export const nav = navData;
