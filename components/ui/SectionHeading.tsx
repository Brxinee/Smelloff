import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  as: Heading = "h2",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-brand">
          {eyebrow}
        </p>
      )}
      <Heading>{title}</Heading>
      {subtitle && <p className="mt-4 text-lg text-ink-2">{subtitle}</p>}
    </div>
  );
}
