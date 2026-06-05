import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { Rating } from "@/components/ui/Rating";
import { PriceBlock } from "@/components/commerce/PriceBlock";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { getDefaultProduct, getReviewStats } from "@/lib/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shop ODORSTRIKE — Choose Your Pack",
  description:
    "Pick your ODORSTRIKE pack. Solo, 2-pack or 3-pack — bundle and save with honest pricing. COD + UPI across India.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  const product = getDefaultProduct();
  const stats = getReviewStats();
  const packs = product.variants.filter((v) => !v.hidden && !v.trialOnly);

  return (
    <>
      <Container className="py-10">
        <SectionHeading
          eyebrow="Shop"
          title="Choose your pack"
          subtitle="One product, three honest ways to buy. The more you carry, the more you save — bundle prices are simply lower per bottle."
        />
      </Container>

      <Container className="pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-brand/30 bg-brand-tint p-6 md:col-span-3">
            <h2 className="text-xl">Bundle &amp; save</h2>
            <p className="mt-2 text-ink-2">
              Keep one in every bag — gym, office, backpack. Stocking up means
              fewer reorders and a lower price per bottle. No inflated MRPs, no
              fake discounts.
            </p>
          </div>

          {packs.map((v) => (
            <article
              key={v.id}
              className={cn(
                "flex flex-col rounded-2xl border-2 bg-bg p-6",
                v.highlighted ? "border-brand shadow-card" : "border-border"
              )}
            >
              <Link
                href="/product/odorstrike"
                className="relative mb-4 block aspect-square overflow-hidden rounded-xl bg-surface"
              >
                <Image
                  src={product.images[0]?.src ?? ""}
                  alt={`ODORSTRIKE ${v.label}`}
                  fill
                  sizes="(max-width: 768px) 90vw, 30vw"
                  className="object-contain p-6"
                />
              </Link>
              {v.highlighted && (
                <Badge tone="brand" className="mb-2 w-fit">
                  Most popular
                </Badge>
              )}
              <h3>
                <Link href="/product/odorstrike" className="no-underline text-ink">
                  ODORSTRIKE {v.label}
                </Link>
              </h3>
              <p className="text-sm text-ink-3">
                {v.units} × {v.size}
              </p>
              <Rating value={stats.average} count={stats.count} size={14} className="mt-2" />
              <div className="mt-3">
                <PriceBlock variant={v} />
              </div>
              <div className="mt-6 flex-1" />
              <AddToCartButton product={product} variant={v} size="md" openCartOnAdd />
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
