import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Rating } from "@/components/ui/Rating";
import { ReviewCard } from "@/components/product/ReviewCard";
import { getReviews, getReviewStats } from "@/lib/content";

export function SocialProof() {
  const reviews = getReviews().slice(0, 3);
  const stats = getReviewStats();

  return (
    <section className="section-y bg-surface" aria-labelledby="proof-h">
      <Container>
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Real reviews"
              title="Trusted by men who can't always wash"
            />
            <div className="flex items-center gap-2">
              <Rating value={stats.average} showValue />
              <span className="text-sm text-ink-2">{stats.count} reviews</span>
            </div>
          </div>
        </Reveal>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal as="li" key={r.id} delay={i * 0.1}>
              <ReviewCard review={r} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
