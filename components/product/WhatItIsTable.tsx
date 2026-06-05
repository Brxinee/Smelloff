import { Check, X } from "lucide-react";

/** Claim-safe comparison. No skin/disease claims anywhere. */
const rows: { feature: string; odorstrike: boolean; perfume: boolean; deo: boolean }[] = [
  { feature: "Works on fabric, not skin", odorstrike: true, perfume: false, deo: false },
  { feature: "Traps & neutralizes odor", odorstrike: true, perfume: false, deo: false },
  { feature: "Adds a heavy scent", odorstrike: false, perfume: true, deo: true },
  { feature: "Dries clean, no residue", odorstrike: true, perfume: false, deo: false },
  { feature: "Pocket 50ml size", odorstrike: true, perfume: false, deo: false },
];

function Cell({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center justify-center text-success">
      <Check className="h-5 w-5" aria-hidden />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex items-center justify-center text-ink-3">
      <X className="h-5 w-5" aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

export function WhatItIsTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <caption className="sr-only">
          ODORSTRIKE compared with perfume and deodorant
        </caption>
        <thead>
          <tr className="bg-surface text-sm">
            <th scope="col" className="p-4 font-semibold text-ink">
              What it does
            </th>
            <th scope="col" className="p-4 text-center font-semibold text-brand">
              ODORSTRIKE
            </th>
            <th scope="col" className="p-4 text-center font-semibold text-ink-2">
              Perfume
            </th>
            <th scope="col" className="p-4 text-center font-semibold text-ink-2">
              Deodorant
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.feature}>
              <th scope="row" className="p-4 font-normal text-ink-2">
                {r.feature}
              </th>
              <td className="p-4 text-center">
                <Cell on={r.odorstrike} />
              </td>
              <td className="p-4 text-center">
                <Cell on={r.perfume} />
              </td>
              <td className="p-4 text-center">
                <Cell on={r.deo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
