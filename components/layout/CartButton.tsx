"use client";

import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { useMounted } from "@/lib/hooks";

export function CartButton() {
  const openCart = useUIStore((s) => s.openCart);
  const items = useCartStore((s) => s.items);
  const mounted = useMounted();
  const count = mounted ? items.reduce((n, i) => n + i.qty, 0) : 0;

  return (
    <button
      type="button"
      onClick={openCart}
      className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface"
      aria-label={`Open cart${count > 0 ? `, ${count} items` : ""}`}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cta px-1 text-xs font-bold text-on-cta">
          {count}
        </span>
      )}
    </button>
  );
}
