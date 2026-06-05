"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING } from "@/lib/constants";

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
  // derived selectors (computed in components via these helpers)
  count: () => number;
  subtotal: () => number;
  shipping: () => number;
  total: () => number;
  remainingForFreeShip: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, qty: i.qty + qty }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),

      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),

      setQty: (variantId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.variantId === variantId ? { ...i, qty } : i))
            .filter((i) => i.qty > 0),
        })),

      clear: () => set({ items: [] }),

      count: () => get().items.reduce((n, i) => n + i.qty, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

      shipping: () => {
        const sub = get().subtotal();
        if (sub === 0) return 0;
        return sub >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
      },

      total: () => get().subtotal() + get().shipping(),

      remainingForFreeShip: () =>
        Math.max(0, FREE_SHIPPING_THRESHOLD - get().subtotal()),
    }),
    {
      name: "smelloff-cart",
      // Only persist the items; selectors are functions.
      partialize: (state) => ({ items: state.items }),
    }
  )
);
