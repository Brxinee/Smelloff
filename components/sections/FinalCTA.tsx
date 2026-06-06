import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export function FinalCTA() {
  return (
    <section
      className="relative overflow-hidden bg-brand section-y"
      aria-labelledby="finalcta-h"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(60% 120% at 100% 0%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(50% 120% at 0% 100%, rgba(201,78,18,0.35), transparent 55%)",
        }}
      />
      <Container className="relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="finalcta-h" className="text-on-brand">
              Carry confidence in your pocket.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-on-brand/90">
              50ml. Five-second fix. Fabric-safe. Made in India.
            </p>
            <div className="mt-7 flex justify-center">
              <LinkButton href="/product/odorstrike" size="lg">
                Shop ODORSTRIKE — ₹229
              </LinkButton>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
