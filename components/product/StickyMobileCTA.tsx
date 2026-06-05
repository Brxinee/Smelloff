"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/types";

/** Appears after the user scrolls past the BuyBox. Single CTA only. */
export function StickyMobileCTA({ product }: { product: Product }) {
  const [visible, setVisible] = React.useState(false);
  const solo =
    product.variants.find((v) => v.label === "Solo") ?? product.variants[0]!;

  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { notify } = useToast();

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const add = () => {
    addItem(
      {
        variantId: solo.id,
        productHandle: product.handle,
        name: product.name,
        label: `ODORSTRIKE · ${solo.label}`,
        price: solo.price,
        size: solo.size,
        image: product.images[0]?.src ?? "",
      },
      1
    );
    notify("Added to cart");
    openCart();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/98 p-3 backdrop-blur lg:hidden">
      <div className="container-px flex items-center gap-3">
        <div className="leading-tight">
          <p className="text-sm font-medium text-ink">ODORSTRIKE 50ml</p>
          <p className="font-display font-bold text-ink">
            {formatINR(solo.price)}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="ml-auto flex min-h-[48px] items-center gap-2 rounded-xl bg-cta px-6 font-display font-semibold text-on-cta hover:bg-cta-strong"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
