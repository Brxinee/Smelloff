import { Rating } from "@/components/ui/Rating";
import type { Review } from "@/types";

/** Distribution of star ratings, 5→1. */
export function RatingBars({ reviews }: { reviews: Review[] }) {
  const total = reviews.length || 1;
  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const average =
    reviews.reduce((s, r) => s + r.rating, 0) / (reviews.length || 1);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="font-display text-4xl font-bold text-ink">
          {average.toFixed(1)}
        </span>
        <div>
          <Rating value={average} />
          <p className="text-sm text-ink-2">{reviews.length} verified reviews</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {buckets.map((b) => {
          const pct = Math.round((b.count / total) * 100);
          return (
            <li key={b.star} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-ink-2">{b.star} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-cta"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-8 text-right text-ink-3">{b.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
