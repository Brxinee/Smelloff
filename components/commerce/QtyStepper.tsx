"use client";

import { Minus, Plus } from "lucide-react";

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label = "Quantity",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-bg"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex h-11 w-11 items-center justify-center rounded-l-lg text-ink hover:bg-surface disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span
        className="min-w-[2.5rem] text-center font-semibold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex h-11 w-11 items-center justify-center rounded-r-lg text-ink hover:bg-surface disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
