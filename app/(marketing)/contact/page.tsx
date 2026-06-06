import type { Metadata } from "next";
import { Mail, MessageCircle, Phone, MapPin, Instagram, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/sections/ContactForm";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Smelloff — We Reply Fast",
  description:
    "Questions about ODORSTRIKE or your order? WhatsApp, email or message us. Based in Hyderabad, India.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="py-12">
      <SectionHeading
        eyebrow="Contact"
        title="We're a small team — you'll reach a human."
        subtitle="WhatsApp is the fastest way to reach us. Order questions? Have your order ID ready."
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <a
            href={SITE.whatsapp}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline hover:border-brand"
          >
            <MessageCircle className="h-5 w-5 text-brand" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">WhatsApp</span>
              <span className="text-sm text-ink-2">Fastest replies</span>
            </span>
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline hover:border-brand"
          >
            <Mail className="h-5 w-5 text-brand" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">Email</span>
              <span className="text-sm text-ink-2">{SITE.email}</span>
            </span>
          </a>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <Phone className="h-5 w-5 text-brand" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">Phone / WhatsApp</span>
              <span className="text-sm text-ink-2">+91 93929 74031</span>
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <Clock className="h-5 w-5 text-brand" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">Hours</span>
              <span className="text-sm text-ink-2">Mon–Sat, 10am–7pm IST</span>
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <MapPin className="h-5 w-5 text-brand" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">Address</span>
              <span className="text-sm text-ink-2">
                Smelloff, {SITE.city}, {SITE.region}, India
              </span>
            </span>
          </div>
          <a
            href={SITE.instagram}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline hover:border-brand"
          >
            <Instagram className="h-5 w-5 text-brand" aria-hidden />
            <span className="font-semibold text-ink">{SITE.instagramHandle}</span>
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-6">
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
