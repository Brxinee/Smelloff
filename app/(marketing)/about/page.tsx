import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/Button";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Smelloff — Built in Hyderabad",
  description:
    "Smelloff is a solo-founder D2C brand from Hyderabad making honest, affordable fabric care for Indian men. This is why ODORSTRIKE exists.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <Container className="py-12">
        <SectionHeading
          eyebrow="Our story"
          title="An honest fix for an everyday problem."
          subtitle="No miracle claims. No giant corporation. Just one founder solving something real."
        />
      </Container>

      <Container className="prose-measure pb-16">
        <div className="space-y-6 text-lg text-ink-2">
          <p>
            Smelloff started in {SITE.city} with an uncomfortable truth: people
            don&apos;t fear smelling bad — they fear others noticing it. In our
            heat and humidity, sweat embeds in fabric fast, and washing every day
            simply isn&apos;t realistic for most of us.
          </p>
          <p>
            <strong className="text-ink">The insight.</strong> Deodorant works on
            skin. Perfume just masks. But the smell lives in the fabric. Nothing
            affordable was built to target that — so I built it.
          </p>
          <p>
            <strong className="text-ink">What Smelloff stands for.</strong>{" "}
            Confidence without fuss. Products built for Indian men and Indian
            conditions. Honest claims you can verify, and prices that don&apos;t
            punish you for needing them.
          </p>
          <p>
            <strong className="text-ink">Product philosophy.</strong>{" "}
            Fabric-first. We&apos;ll never tell you something kills germs or fixes
            your body. ODORSTRIKE traps and neutralizes odor in clothing — that&apos;s
            the job, done well, and nothing more.
          </p>
        </div>

        <figure className="mt-10 flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-surface-2">
            <Image
              src="/images/icon-founder.png"
              alt="Smelloff founder"
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <figcaption>
            <p className="font-display text-lg text-ink">Smelloff</p>
            <p className="text-sm text-ink-3">Founder · {SITE.city}, India</p>
          </figcaption>
        </figure>

        <div className="mt-10">
          <LinkButton href="/product/odorstrike" size="lg">
            Shop ODORSTRIKE — ₹229
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
