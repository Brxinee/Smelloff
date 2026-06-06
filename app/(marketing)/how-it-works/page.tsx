import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HowItWorks3Step } from "@/components/sections/HowItWorks3Step";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Callout } from "@/components/ui/Callout";

export const metadata: Metadata = {
  title: "How It Works — The Science of Fabric Odor",
  description:
    "Why clothes hold odor and how ODORSTRIKE's cyclodextrin traps it. Accurate, claim-safe science behind the 5-second fabric fix.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <Container className="py-12">
        <SectionHeading
          eyebrow="The science"
          title="Why clothes smell — and how we stop it."
          subtitle="No jargon, no fake claims. Here's exactly what's happening in your fabric."
        />
      </Container>

      <Container className="prose-measure space-y-10 pb-12">
        <section>
          <h2 className="text-2xl">1. Why clothes hold odor</h2>
          <p className="mt-3 text-ink-2">
            Sweat itself is near-odorless. Skin bacteria break it down into
            volatile compounds — isovaleric acid (cheesy), 3M2H (goat-like),
            thioalcohols (oniony) and 2-nonenal (cardboard). These embed in
            fabric. Synthetics like polyester act as a reservoir, holding the
            compounds and re-releasing the smell across wears — sometimes even
            after washing.
          </p>
        </section>

        <section>
          <h2 className="text-2xl">2. How ODORSTRIKE works</h2>
          <p className="mt-3 text-ink-2">
            ODORSTRIKE&apos;s hero active is{" "}
            <strong className="text-ink">Zinc PCA</strong> — a zinc complex used
            in skin-safe odor control for decades. It{" "}
            <strong className="text-ink">binds and neutralizes</strong> the
            volatile odor molecules trapped in fabric so they can&apos;t
            volatilize to your nose. A plant-derived{" "}
            <strong className="text-ink">triethyl citrate</strong> helps break
            down the sweat acids bacteria leave behind. Together they neutralize
            the smell — they don&apos;t mask it with perfume.
          </p>
        </section>

        <section>
          <h2 className="text-2xl">3. Why deodorant doesn&apos;t fix it</h2>
          <p className="mt-3 text-ink-2">
            Deodorant acts on your skin. The odor compounds already sitting in
            the fabric are completely untouched by it. ODORSTRIKE targets the
            fabric — which is where the leftover smell actually lives.
          </p>
        </section>

        <section>
          <h2 className="text-2xl">4. The India context</h2>
          <p className="mt-3 text-ink-2">
            High humidity in cities like Hyderabad, Mumbai and Chennai slows sweat
            evaporation, which means more odor. Re-wearing clothes between washes
            is common and practical — ODORSTRIKE refreshes fabric between those
            washes so you get more wears, cleanly.
          </p>
        </section>

        <Callout>
          <strong>Honesty block:</strong> ODORSTRIKE extends the time between
          washes — it does not replace washing. Launder heavily soiled garments
          normally. For use on fabrics and clothing only; not for application to
          skin.
        </Callout>
      </Container>

      <HowItWorks3Step withCta={false} />
      <FinalCTA />
    </>
  );
}
