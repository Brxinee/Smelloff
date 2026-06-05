import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export function FinalCTA() {
  return (
    <section className="section-y bg-brand" aria-labelledby="finalcta-h">
      <Container>
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
