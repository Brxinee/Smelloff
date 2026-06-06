import { Droplets, Timer, SprayCan, Shirt } from "lucide-react";

const benefits = [
  { icon: Droplets, label: "50ml pocket size" },
  { icon: Timer, label: "5-second fix" },
  { icon: SprayCan, label: "~250 sprays" },
  { icon: Shirt, label: "Fabric-safe" },
];

export function BenefitBar() {
  return (
    <ul className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4">
      {benefits.map((b) => (
        <li key={b.label} className="flex flex-col items-center gap-2 text-center">
          <b.icon className="h-6 w-6 text-brand" aria-hidden />
          <span className="text-sm font-medium text-ink-2">{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
