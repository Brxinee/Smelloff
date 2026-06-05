import * as React from "react";
import { cn } from "@/lib/utils";

export function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-2",
        className
      )}
    >
      {children}
    </span>
  );
}
