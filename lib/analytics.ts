"use client";

/**
 * Thin analytics wrapper. All calls are no-ops until cookie consent is granted
 * and the GA4 / Meta Pixel scripts have loaded (see CookieConsent + Analytics).
 */

type GtagArgs = [string, string, Record<string, unknown>?];

declare global {
  interface Window {
    gtag?: (...args: GtagArgs) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const CONSENT_KEY = "smelloff-consent";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

export function trackPurchase(order: {
  id: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
}): void {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  window.gtag?.("event", "purchase", {
    transaction_id: order.id,
    value: order.total,
    currency: "INR",
    items: order.items.map((i) => ({
      item_name: i.name,
      quantity: i.qty,
      price: i.price,
    })),
  });

  window.fbq?.("track", "Purchase", {
    value: order.total,
    currency: "INR",
  });
}

export function trackAddToCart(item: { name: string; price: number }): void {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;
  window.gtag?.("event", "add_to_cart", {
    currency: "INR",
    value: item.price,
    items: [{ item_name: item.name, price: item.price }],
  });
  window.fbq?.("track", "AddToCart", { value: item.price, currency: "INR" });
}
