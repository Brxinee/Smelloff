import { BadgeCheck } from "lucide-react";
import { Rating } from "@/components/ui/Rating";
import { formatDate } from "@/lib/format";
import type { Review } from "@/types";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="card-hover flex h-full flex-col rounded-2xl border border-border bg-bg p-5">
      <Rating value={review.rating} size={16} />
      <h3 className="mt-2 font-display text-base font-semibold text-ink">
        {review.title}
      </h3>
      <p className="mt-1 flex-1 text-ink-2">{review.body}</p>
      <footer className="mt-4 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{review.name}</span>
        <span className="flex items-center gap-3 text-ink-3">
          {review.location && <span>{review.location}</span>}
          {review.verified && (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              Verified
            </span>
          )}
        </span>
      </footer>
      <time className="mt-1 text-xs text-ink-3" dateTime={review.date}>
        {formatDate(review.date)}
      </time>
    </article>
  );
}
