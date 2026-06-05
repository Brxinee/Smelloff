"use client";

import * as React from "react";
import { ThumbsUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RatingBars } from "./RatingBars";
import { ReviewCard } from "./ReviewCard";
import type { Review } from "@/types";

export function ReviewSection({ reviews }: { reviews: Review[] }) {
  const [helpful, setHelpful] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(reviews.map((r) => [r.id, r.helpful ?? 0]))
  );
  const [voted, setVoted] = React.useState<Set<string>>(new Set());

  const vote = (id: string) => {
    if (voted.has(id)) return;
    setHelpful((h) => ({ ...h, [id]: (h[id] ?? 0) + 1 }));
    setVoted((v) => new Set(v).add(id));
  };

  return (
    <section id="reviews" className="section-y bg-surface scroll-mt-20" aria-labelledby="rev-h">
      <Container>
        <SectionHeading eyebrow="Reviews" title="What buyers say" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <RatingBars reviews={reviews} />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="flex h-full flex-col">
                  <ReviewCard review={r} />
                  <button
                    type="button"
                    onClick={() => vote(r.id)}
                    disabled={voted.has(r.id)}
                    className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-bg disabled:opacity-60"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    Helpful ({helpful[r.id] ?? 0})
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
