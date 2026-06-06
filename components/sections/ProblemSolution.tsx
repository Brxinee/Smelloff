import { Zap, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const problems = [
  "Sweat-soaked shirt halfway through the commute.",
  "Re-wearing the same office wear because laundry isn't done.",
  "Gym kit that funks up the whole bag by evening.",
];

export function ProblemSolution() {
  return (
    <section className="section-y bg-bg" aria-labelledby="prob-h">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="The real problem"
            title="The smell isn't the fear. Being noticed is."
            subtitle="You can't always wash. You can't always change. But you can fix the fabric in five seconds."
          />
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <ul className="space-y-3 rounded-2xl border border-border bg-surface p-6">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-3 text-ink-2">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cta-tint text-cta"
                  >
                    <X className="h-3 w-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-2xl bg-brand-tint p-6">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-on-brand">
                <Zap className="h-5 w-5" aria-hidden />
              </span>
              <h3 id="prob-h" className="text-ink">
                The 5-second fix
              </h3>
              <p className="mt-3 text-ink-2">
                Pull out the 50ml bottle, mist the collar, underarms and back,
                let it dry. ODORSTRIKE traps the odor molecules already in the
                fabric so they can&apos;t reach anyone&apos;s nose. No perfume
                cloud, no residue — just clean.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
