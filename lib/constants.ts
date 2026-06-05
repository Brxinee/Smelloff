/** Genuine commerce constants — no fake urgency anywhere. */

export const SITE = {
  name: "Smelloff",
  product: "ODORSTRIKE",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://smelloff.in",
  instagram: "https://instagram.com/smell0ff",
  instagramHandle: "@smell0ff",
  email: "hello@smelloff.in",
  whatsapp: "https://wa.me/910000000000",
  whatsappLabel: "WhatsApp support",
  city: "Hyderabad",
  region: "Telangana",
  country: "India",
} as const;

/** Real free-shipping threshold used by the cart goal-gradient bar. */
export const FREE_SHIPPING_THRESHOLD = 499;
export const FLAT_SHIPPING = 49;
export const COD_FEE = 30;

export const RETURN_WINDOW_DAYS = 7;

/** Shipping for a given subtotal — single source of truth (client + server). */
export function shippingFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}
