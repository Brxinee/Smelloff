"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  q: React.ReactNode;
  a: React.ReactNode;
}

export function Accordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <div className={cn("divide-y divide-border rounded-xl border border-border bg-bg", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `accordion-panel-${i}`;
        const btnId = `accordion-btn-${i}`;
        return (
          <div key={i}>
            <h3 className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-semibold text-ink hover:bg-surface"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-brand transition-transform",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              className="px-5 pb-5 text-ink-2"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
