import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "sale" | "neutral" | "success";

const tones: Record<Tone, string> = {
  brand: "bg-brand-tint text-ink",
  sale: "bg-cta-tint text-ink", // warm "save" flag — ink text, AA
  neutral: "bg-surface-2 text-ink-2",
  success: "bg-[#E3F3E8] text-[#0E5C28]",
};

export function Badge({
  tone = "brand",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
