"use client";

import { Truck } from "lucide-react";
import { formatINR } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/** Genuine goal-gradient bar toward the real free-shipping threshold. */
export function FreeShipProgress({ subtotal }: { subtotal: number }) {
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const unlocked = remaining === 0;

  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="mb-2 flex items-center gap-2 text-sm text-ink-2">
        <Truck className="h-4 w-4 text-brand" aria-hidden />
        {unlocked ? (
          <span className="font-medium text-success">
            You&apos;ve unlocked free shipping!
          </span>
        ) : (
          <span>
            Add <strong className="text-ink">{formatINR(remaining)}</strong> more
            for free shipping
          </span>
        )}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward free shipping"
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
