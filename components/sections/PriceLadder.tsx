import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { PriceBlock } from "@/components/commerce/PriceBlock";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { getDefaultProduct } from "@/lib/content";
import { cn } from "@/lib/utils";

export function PriceLadder() {
  const product = getDefaultProduct();
  const packs = product.variants.filter(
    (v) => !v.hidden && !v.trialOnly
  );

  return (
    <section className="section-y bg-bg" aria-labelledby="ladder-h">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Bundle & save"
            title="Stock up and save"
            subtitle="Honest savings — bundle prices are simply lower per bottle. No inflated MRPs."
            align="center"
            className="mx-auto"
          />
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          {packs.map((v, i) => (
            <Reveal key={v.id} delay={i * 0.1}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-2xl border-2 bg-bg p-6",
                  v.highlighted ? "border-brand shadow-card" : "border-border"
                )}
              >
                {v.highlighted && (
                  <Badge tone="brand" className="mb-3 w-fit">
                    Most popular
                  </Badge>
                )}
                <h3 className="text-ink">{v.label}</h3>
                <p className="text-sm text-ink-3">
                  {v.units} × {v.size}
                </p>
                <div className="mt-4">
                  <PriceBlock variant={v} />
                </div>
                <div className="mt-6 flex-1" />
                <AddToCartButton
                  product={product}
                  variant={v}
                  label="Add to cart"
                  size="md"
                  openCartOnAdd
                />
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
