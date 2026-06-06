import Image from "next/image";
import { Sparkles, Check } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Rating } from "@/components/ui/Rating";
import { getDefaultProduct, getReviewStats } from "@/lib/content";

const quickPoints = ["Fabric-only & skin-safe", "Dries clean, no residue", "~250 sprays"];

export function Hero() {
  const product = getDefaultProduct();
  const stats = getReviewStats();
  const solo = product.variants.find((v) => v.label === "Solo");

  return (
    <section className="relative overflow-hidden bg-bg" aria-labelledby="hero-h">
      {/* Decorative background accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-tint blur-3xl opacity-70" />
        <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-cta-tint blur-3xl opacity-60" />
      </div>

      <Container className="relative grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="eyebrow animate-fade-up" style={{ animationDelay: "0ms" }}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Fabric odor eliminator · 50ml
          </span>

          <h1
            id="hero-h"
            className="mt-4 animate-fade-up text-balance"
            style={{ animationDelay: "60ms" }}
          >
            People don&apos;t fear smelling bad — they fear{" "}
            <span className="text-brand">others noticing.</span>
          </h1>

          <p
            className="mt-5 max-w-md animate-fade-up text-lg text-ink-2"
            style={{ animationDelay: "120ms" }}
          >
            Pocket-sized odor killer for your clothes — anytime, anywhere. Two
            sprays trap the smell so you stay fresh between washes.
          </p>

          <div
            className="mt-7 flex animate-fade-up flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "180ms" }}
          >
            <LinkButton href="/product/odorstrike" size="lg">
              Shop ODORSTRIKE — ₹{solo?.price ?? 229}
            </LinkButton>
            <LinkButton href="/how-it-works" variant="secondary" size="lg">
              How it works
            </LinkButton>
          </div>

          <div
            className="mt-6 flex animate-fade-up items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Rating value={stats.average} showValue />
            <span className="text-sm text-ink-2">
              from {stats.count} verified reviews
            </span>
          </div>

          <ul
            className="mt-6 flex animate-fade-up flex-wrap gap-x-5 gap-y-2"
            style={{ animationDelay: "300ms" }}
          >
            {quickPoints.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-sm text-ink-3">
                <Check className="h-4 w-4 text-brand" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: "120ms" }}>
          {/* Glow ring behind the bottle */}
          <div
            aria-hidden
            className="absolute inset-6 rounded-full bg-gradient-to-br from-brand-tint to-cta-tint blur-2xl opacity-80"
          />
          <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card">
            <Image
              src={product.images[0]?.src ?? "/images/odorstrike-bottle.png"}
              alt="ODORSTRIKE 50ml fabric mist bottle"
              fill
              sizes="(max-width: 1024px) 90vw, 40vw"
              priority
              className="object-contain p-10"
            />
          </div>
          {/* Floating chips */}
          <div className="absolute left-2 top-6 rounded-full border border-border bg-bg/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-card backdrop-blur sm:left-0">
            5-second fix
          </div>
          <div className="absolute bottom-6 right-2 rounded-full border border-border bg-bg/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-card backdrop-blur sm:right-0">
            Fits your pocket
          </div>
        </div>
      </Container>
    </section>
  );
}
