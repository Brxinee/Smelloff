import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LegalShell } from "@/components/layout/LegalShell";
import { getLegalContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing your use of the Smelloff store and purchases.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="June 2026">
      <MDXRemote source={getLegalContent("terms")} />
    </LegalShell>
  );
}
