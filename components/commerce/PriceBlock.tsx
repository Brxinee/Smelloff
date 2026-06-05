import { formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Variant } from "@/types";

/**
 * Honest price anchoring. compareAt is the true sum of solo prices (units ×
 * solo), never an inflated MRP — so the savings shown are real.
 */
export function PriceBlock({
  variant,
  className,
  size = "md",
}: {
  variant: Variant;
  className?: string;
  size?: "md" | "lg";
}) {
  const showCompare =
    variant.compareAt != null && variant.compareAt > variant.price;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span
        className={cn(
          "font-display font-bold text-ink",
          size === "lg" ? "text-4xl" : "text-2xl"
        )}
      >
        {formatINR(variant.price)}
      </span>
      {showCompare && (
        <span className="text-price-strike line-through">
          {formatINR(variant.compareAt as number)}
        </span>
      )}
      {variant.savingsLabel && (
        <Badge tone="sale">{variant.savingsLabel}</Badge>
      )}
    </div>
  );
}
