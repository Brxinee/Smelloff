import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-baseline gap-1 font-display text-xl font-bold tracking-tight text-ink no-underline",
        className
      )}
      aria-label="Smelloff home"
    >
      <span>Smell</span>
      <span className="text-brand">off</span>
    </Link>
  );
}
