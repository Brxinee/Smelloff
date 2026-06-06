import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SITE } from "@/lib/constants";

export function FounderNote() {
  return (
    <section className="section-y bg-surface" aria-labelledby="founder-h">
      <Container>
        <Reveal>
          <div className="relative grid items-center gap-8 overflow-hidden rounded-2xl border border-border bg-bg p-8 shadow-card md:grid-cols-[160px_1fr]">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-6 font-display text-[10rem] leading-none text-brand-tint"
            >
              &rdquo;
            </span>
            <div className="relative z-10 mx-auto h-32 w-32 overflow-hidden rounded-full bg-surface-2 ring-4 ring-brand-tint">
              <Image
                src="/images/icon-founder.png"
                alt="Smelloff founder"
                fill
                sizes="128px"
                className="object-cover"
              />
            </div>
            <div className="relative z-10">
              <p className="eyebrow">From the founder</p>
              <h2 id="founder-h" className="mt-2 text-2xl">
                I built this in {SITE.city} because I needed it.
              </h2>
              <p className="mt-3 text-ink-2">
                I&apos;m a solo founder. ODORSTRIKE started with a simple,
                uncomfortable truth: people don&apos;t fear smelling bad — they
                fear others noticing. In our heat and humidity, washing every day
                isn&apos;t always possible. So I built an honest, affordable
                fabric mist that actually traps the smell — no fake claims, no
                miracle cures. Just something that works when you need it.
              </p>
              <p className="mt-3 font-display text-lg text-ink">— Smelloff</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
