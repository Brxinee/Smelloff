import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Rating } from "@/components/ui/Rating";
import { getDefaultProduct, getReviewStats } from "@/lib/content";

export function Hero() {
  const product = getDefaultProduct();
  const stats = getReviewStats();
  const solo = product.variants.find((v) => v.label === "Solo");

  return (
    <section className="bg-bg" aria-labelledby="hero-h">
      <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-brand">
            Fabric odor eliminator · 50ml
          </p>
          <h1 id="hero-h" className="text-balance">
            People don&apos;t fear smelling bad — they fear others noticing.
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-2">
            Pocket-sized odor killer for your clothes — anytime, anywhere. Two
            sprays trap the smell so you stay fresh between washes.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/product/odorstrike" size="lg">
              Shop ODORSTRIKE — ₹{solo?.price ?? 229}
            </LinkButton>
            <LinkButton href="/how-it-works" variant="secondary" size="lg">
              How it works
            </LinkButton>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Rating value={stats.average} showValue />
            <span className="text-sm text-ink-2">
              from {stats.count} verified reviews
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-3">
            For fabrics &amp; clothing only · Skin-safe · Not a deodorant
          </p>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-surface">
          <Image
            src={product.images[0]?.src ?? "/images/odorstrike-bottle.png"}
            alt="ODORSTRIKE 50ml fabric mist bottle"
            fill
            sizes="(max-width: 1024px) 90vw, 40vw"
            priority
            className="object-contain p-8"
          />
        </div>
      </Container>
    </section>
  );
}
