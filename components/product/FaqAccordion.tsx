import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Accordion } from "@/components/ui/Accordion";
import { getFaq } from "@/lib/content";

export function FaqAccordion({ withSection = true }: { withSection?: boolean }) {
  const faq = getFaq();
  const items = faq.map((f) => ({ q: f.q, a: <p>{f.a}</p> }));

  if (!withSection) return <Accordion items={items} />;

  return (
    <section id="faq" className="section-y bg-bg scroll-mt-20" aria-labelledby="faq-h">
      <Container className="max-w-2xl">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          align="center"
          className="mx-auto"
        />
        <div className="mt-8">
          <Accordion items={items} />
        </div>
      </Container>
    </section>
  );
}
