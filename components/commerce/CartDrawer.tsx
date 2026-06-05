"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button, LinkButton } from "@/components/ui/Button";
import { CartLineItem } from "./CartLineItem";
import { FreeShipProgress } from "./FreeShipProgress";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { useMounted } from "@/lib/hooks";
import { formatINR } from "@/lib/format";

export function CartDrawer() {
  const open = useUIStore((s) => s.cartOpen);
  const close = useUIStore((s) => s.closeCart);
  const openCheckout = useUIStore((s) => s.openCheckout);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const shipping = useCartStore((s) => s.shipping());
  const total = useCartStore((s) => s.total());
  const mounted = useMounted();

  const empty = !mounted || items.length === 0;

  return (
    <Drawer open={open} onClose={close} side="right" title="Your cart">
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <ShoppingBag className="h-12 w-12 text-ink-3" aria-hidden />
          <p className="text-ink-2">Your cart is empty.</p>
          <LinkButton href="/product/odorstrike" onClick={close} variant="secondary">
            Shop ODORSTRIKE
          </LinkButton>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-5 pt-4">
            <FreeShipProgress subtotal={subtotal} />
          </div>
          <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
            {items.map((item) => (
              <CartLineItem key={item.variantId} item={item} />
            ))}
          </ul>
          <div className="border-t border-border p-5">
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="font-medium text-ink">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Shipping</dt>
                <dd className="font-medium text-ink">
                  {shipping === 0 ? "Free" : formatINR(shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-bold text-ink">{formatINR(total)}</dd>
              </div>
            </dl>
            <Button fullWidth size="lg" onClick={openCheckout}>
              Checkout
            </Button>
            <p className="mt-3 text-center text-xs text-ink-3">
              Taxes included · COD available ·{" "}
              <Link href="/refund" onClick={close} className="underline">
                7-day returns
              </Link>
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
