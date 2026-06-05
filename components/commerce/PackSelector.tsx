"use client";

import { Check } from "lucide-react";
import { formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Variant } from "@/types";

/**
 * Segmented 3-tier ladder. Selection is signalled by border + checkmark, not
 * color alone (a11y). Updates parent price + CTA.
 */
export function PackSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: Variant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-ink">Choose your pack</legend>
      <div className="grid gap-3">
        {variants.map((v) => {
          const selected = v.id === selectedId;
          return (
            <label
              key={v.id}
              className={cn(
                "relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 bg-bg p-4 transition-colors",
                selected
                  ? "border-brand bg-brand-tint/40"
                  : "border-border hover:border-brand/50"
              )}
            >
              <input
                type="radio"
                name="pack"
                value={v.id}
                checked={selected}
                onChange={() => onSelect(v.id)}
                className="sr-only"
              />
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    selected ? "border-brand bg-brand" : "border-border"
                  )}
                  aria-hidden
                >
                  {selected && <Check className="h-3 w-3 text-on-brand" />}
                </span>
                <span>
                  <span className="block font-display font-semibold text-ink">
                    {v.label}{" "}
                    <span className="font-sans font-normal text-ink-3">
                      · {v.units} × {v.size}
                    </span>
                  </span>
                  {v.highlighted && (
                    <Badge tone="brand" className="mt-1">
                      Most popular
                    </Badge>
                  )}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display font-bold text-ink">
                  {formatINR(v.price)}
                </span>
                {v.savingsLabel && (
                  <span className="text-sm font-semibold text-cta">
                    {v.savingsLabel}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
