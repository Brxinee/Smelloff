"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { useToast } from "@/components/ui/Toast";
import { trackAddToCart } from "@/lib/analytics";
import type { Product, Variant } from "@/types";

export function AddToCartButton({
  product,
  variant,
  qty = 1,
  size = "lg",
  fullWidth = true,
  label = "Add to Cart",
  openCartOnAdd = false,
}: {
  product: Product;
  variant: Variant;
  qty?: number;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  label?: string;
  openCartOnAdd?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { notify } = useToast();

  const handleAdd = () => {
    const primaryImage =
      product.images.find((i) => i.primary)?.src ?? product.images[0]?.src ?? "";
    addItem(
      {
        variantId: variant.id,
        productHandle: product.handle,
        name: product.name,
        label: `${product.name.split("—")[0]?.trim()} · ${variant.label}`,
        price: variant.price,
        size: variant.size,
        image: primaryImage,
      },
      qty
    );
    trackAddToCart({ name: `${product.name} ${variant.label}`, price: variant.price });
    notify(`${variant.label} added to cart`);
    if (openCartOnAdd) openCart();
  };

  return (
    <Button onClick={handleAdd} size={size} fullWidth={fullWidth}>
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {label}
    </Button>
  );
}
