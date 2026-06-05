"use client";

import { create } from "zustand";

interface UIState {
  cartOpen: boolean;
  mobileNavOpen: boolean;
  checkoutOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  cartOpen: false,
  mobileNavOpen: false,
  checkoutOpen: false,
  openCart: () => set({ cartOpen: true, mobileNavOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  openCheckout: () => set({ checkoutOpen: true, cartOpen: false }),
  closeCheckout: () => set({ checkoutOpen: false }),
}));
