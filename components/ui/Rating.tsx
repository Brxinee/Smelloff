import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible star rating. Color is never the sole signal — an aria-label and
 * visible numeric value accompany the stars.
 */
export function Rating({
  value,
  count,
  size = 18,
  showValue = false,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const rounded = Math.round(value);
  const label =
    count != null
      ? `Rated ${value} out of 5 from ${count} reviews`
      : `Rated ${value} out of 5`;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={label}
    >
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              i <= rounded ? "fill-cta text-cta" : "fill-surface-2 text-border"
            )}
          />
        ))}
      </span>
      {showValue && (
        <span className="font-semibold text-ink" aria-hidden>
          {value.toFixed(1)}
        </span>
      )}
      {count != null && (
        <span className="text-sm text-ink-2" aria-hidden>
          ({count})
        </span>
      )}
    </span>
  );
}
