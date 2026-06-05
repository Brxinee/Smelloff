import * as React from "react";
import { Container } from "@/components/ui/Container";

/** Shared shell for legal/policy pages — readable measure, last-updated line. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="max-w-prose py-12">
      <h1 className="text-h2">{title}</h1>
      <p className="mt-2 text-sm text-ink-3">Last updated: {updated}</p>
      <div className="prose-measure mt-8 space-y-6 text-ink-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-ink [&_a]:underline [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </Container>
  );
}
