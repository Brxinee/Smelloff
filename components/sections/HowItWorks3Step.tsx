import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const steps = [
  {
    n: "1",
    title: "Spray",
    body: "Two light mists on the collar, underarms and back from ~15cm away.",
  },
  {
    n: "2",
    title: "Zinc PCA neutralizes the odor",
    body: "It binds the odor molecules in the fabric so they can't volatilize to your nose — neutralized, not masked.",
  },
  {
    n: "3",
    title: "Fresh fabric",
    body: "Dries in seconds with no residue. Wear it out with confidence.",
  },
];

export function HowItWorks3Step({ withCta = true }: { withCta?: boolean }) {
  return (
    <section className="section-y bg-brand-tint" aria-labelledby="hiw-h">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps. Five seconds."
            align="center"
          />
        </Reveal>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 0.1}>
              <div className="card-hover h-full rounded-2xl border border-border bg-bg p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand font-display text-lg font-bold text-on-brand shadow-[0_6px_16px_-6px_rgba(15,110,120,0.7)]">
                  {s.n}
                </span>
                <h3 className="mt-4 text-ink">{s.title}</h3>
                <p className="mt-2 text-ink-2">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        {withCta && (
          <p className="mt-8 text-center">
            <Link href="/how-it-works" className="font-semibold underline">
              Read the science →
            </Link>
          </p>
        )}
      </Container>
    </section>
  );
}
