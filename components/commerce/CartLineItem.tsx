"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { QtyStepper } from "./QtyStepper";
import { formatINR } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";
import type { CartItem } from "@/types";

export function CartLineItem({ item }: { item: CartItem }) {
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <li className="flex gap-3 py-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="80px"
          className="object-contain p-1"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex justify-between gap-2">
          <div>
            <p className="font-medium text-ink">{item.label}</p>
            <p className="text-sm text-ink-3">{item.size}</p>
          </div>
          <p className="font-semibold text-ink">
            {formatINR(item.price * item.qty)}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <QtyStepper
            value={item.qty}
            onChange={(q) => setQty(item.variantId, q)}
          />
          <button
            type="button"
            onClick={() => removeItem(item.variantId)}
            className="flex items-center gap-1 text-sm text-ink-3 hover:text-error"
            aria-label={`Remove ${item.label} from cart`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
