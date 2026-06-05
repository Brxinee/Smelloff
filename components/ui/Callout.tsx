import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Callout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "my-6 flex gap-3 rounded-xl border border-brand/30 bg-brand-tint/50 p-4",
        className
      )}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
      <div className="text-ink-2 [&>p]:m-0">{children}</div>
    </aside>
  );
}
