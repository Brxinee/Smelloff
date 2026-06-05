import productsData from "@/content/products.json";
import reviewsData from "@/content/reviews.json";
import faqData from "@/content/faq.json";
import navData from "@/content/nav.json";
import type { Product, Review, FaqItem } from "@/types";
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
