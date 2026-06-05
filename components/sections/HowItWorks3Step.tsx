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
    title: "Cyclodextrin traps the odor",
    body: "Ring-shaped molecules cage the odor compounds so they can't volatilize to your nose.",
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
              <div className="h-full rounded-2xl bg-bg p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-display text-lg font-bold text-on-brand">
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
