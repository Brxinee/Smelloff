import { ShieldCheck, Truck, RotateCcw, CreditCard } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "Secure checkout" },
  { icon: Truck, label: "COD available" },
  { icon: RotateCcw, label: "Easy 7-day returns" },
  { icon: CreditCard, label: "UPI / Cards / Razorpay" },
];

export function TrustBadges() {
  return (
    <ul className="grid grid-cols-2 gap-3 text-sm text-ink-2">
      {badges.map((b) => (
        <li key={b.label} className="flex items-center gap-2">
          <b.icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          {b.label}
        </li>
      ))}
    </ul>
  );
}
