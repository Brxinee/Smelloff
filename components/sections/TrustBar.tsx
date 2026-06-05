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
      <Container className="py-6">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex items-center justify-center gap-2 text-center text-sm font-medium text-ink-2"
            >
              <it.icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              {it.label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
