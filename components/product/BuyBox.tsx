"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Rating } from "@/components/ui/Rating";
import { Button } from "@/components/ui/Button";
import { PackSelector } from "@/components/commerce/PackSelector";
import { PriceBlock } from "@/components/commerce/PriceBlock";
import { QtyStepper } from "@/components/commerce/QtyStepper";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { TrustBadges } from "@/components/commerce/TrustBadges";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { useToast } from "@/components/ui/Toast";
import { isNewBuyer } from "@/lib/buyer";
import { useMounted } from "@/lib/hooks";
import { formatINR } from "@/lib/format";
import type { Product, Variant } from "@/types";

export function BuyBox({
  product,
  reviewStats,
}: {
  product: Product;
  reviewStats: { average: number; count: number };
}) {
  const packs = product.variants.filter((v) => !v.hidden && !v.trialOnly);
  const trial = product.variants.find((v) => v.trialOnly);
  const [selectedId, setSelectedId] = React.useState(
    packs.find((v) => v.label === "Solo")?.id ?? packs[0]?.id ?? ""
  );
  const [qty, setQty] = React.useState(1);

  const mounted = useMounted();
  const showTrial = mounted && trial && isNewBuyer();

  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { notify } = useToast();

  const selected = packs.find((v) => v.id === selectedId) ?? packs[0]!;

  const addTrial = (variant: Variant) => {
    addItem(
      {
        variantId: variant.id,
        productHandle: product.handle,
        name: product.name,
        label: `ODORSTRIKE · ${variant.label}`,
        price: variant.price,
        size: variant.size,
        image: product.images[0]?.src ?? "",
      },
      1
    );
    notify("Trial added to cart");
    openCart();
  };

  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      <h1 className="text-3xl sm:text-4xl">{product.name}</h1>
      <p className="mt-2 text-lg text-ink-2">{product.descriptor}</p>

      <Link
        href="#reviews"
        className="mt-3 inline-flex items-center gap-2 no-underline"
      >
        <Rating value={reviewStats.average} />
        <span className="text-sm text-ink-2 underline">
          ({reviewStats.count} reviews)
        </span>
      </Link>

      <div className="mt-5">
        <PriceBlock variant={selected} size="lg" />
      </div>

      {showTrial && trial && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-cta/30 bg-cta-tint p-4">
          <p className="flex items-center gap-2 text-sm text-ink">
            <Sparkles className="h-4 w-4 text-cta" aria-hidden />
            <span>
              <strong>First order?</strong> Try 1 for {formatINR(trial.price)} —
              no card hold.
            </span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => addTrial(trial)}>
            Try {formatINR(trial.price)}
          </Button>
        </div>
      )}

      <div className="mt-6">
        <PackSelector
          variants={packs}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <QtyStepper value={qty} onChange={setQty} />
        <span className="text-sm text-ink-3">
          {product.specs.find((s) => s.label === "Approx. sprays")?.value} per
          bottle
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <AddToCartButton
          product={product}
          variant={selected}
          qty={qty}
          openCartOnAdd
        />
        <BuyNowButton product={product} variant={selected} qty={qty} />
      </div>

      <div className="mt-6">
        <TrustBadges />
      </div>

      <p className="mt-4 text-sm text-ink-3">
        For fabrics only · Skin-safe · Not a deodorant. Ships across India · 7-day
        returns.
      </p>
    </div>
  );
}

function BuyNowButton({
  product,
  variant,
  qty,
}: {
  product: Product;
  variant: Variant;
  qty: number;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCheckout = useUIStore((s) => s.openCheckout);

  const buyNow = () => {
    addItem(
      {
        variantId: variant.id,
        productHandle: product.handle,
        name: product.name,
        label: `ODORSTRIKE · ${variant.label}`,
        price: variant.price,
        size: variant.size,
        image: product.images[0]?.src ?? "",
      },
      qty
    );
    openCheckout();
  };

  return (
    <Button variant="secondary" size="lg" fullWidth onClick={buyNow}>
      Buy Now
    </Button>
  );
}
