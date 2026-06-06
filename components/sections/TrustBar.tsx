import { Shirt, Package, Wallet, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";

const items = [
  { icon: Shirt, label: "Fabric-only, skin-safe" },
  { icon: Package, label: "Pocket 50ml" },
  { icon: Wallet, label: "COD + UPI" },
  { icon: MapPin, label: "Made in India" },
];

export function TrustBar() {
  return (
    <section aria-label="Why ODORSTRIKE" className="border-y border-border bg-surface">
      <Container className="py-7">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:divide-x md:divide-border">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex items-center justify-center gap-2.5 text-center text-sm font-medium text-ink-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint">
                <it.icon className="h-5 w-5 text-brand" aria-hidden />
              </span>
              {it.label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
