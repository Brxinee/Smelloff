import { Briefcase, Dumbbell, Heart, GraduationCap, HardHat } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const cases = [
  { icon: Briefcase, title: "Office", line: "Stay fresh through the AC-to-commute cycle." },
  { icon: Dumbbell, title: "Gym", line: "Kit that doesn't funk up your bag." },
  { icon: Heart, title: "Dates", line: "A quick check before you walk in." },
  { icon: GraduationCap, title: "College", line: "Hostel laundry can wait another day." },
  { icon: HardHat, title: "Field work", line: "Bearable uniform through the shift." },
];

export function UseCaseGrid() {
  return (
    <section className="section-y bg-bg" aria-labelledby="usecase-h">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Built for your day"
            title="One bottle, every situation"
            align="center"
            className="mx-auto"
          />
        </Reveal>
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-5">
          {cases.map((c, i) => (
            <Reveal as="li" key={c.title} delay={i * 0.05}>
              <div className="flex h-full flex-col items-center gap-2 rounded-2xl bg-surface p-5 text-center">
                <c.icon className="h-7 w-7 text-brand" aria-hidden />
                <h3 className="text-base text-ink">{c.title}</h3>
                <p className="text-sm text-ink-2">{c.line}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
