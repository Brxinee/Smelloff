import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LegalShell } from "@/components/layout/LegalShell";
import { getLegalContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Refund terms for ODORSTRIKE orders — eligibility, timeline and cancellation rules.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <LegalShell title="Refund Policy" updated="June 2026">
      <MDXRemote source={getLegalContent("refund")} />
    </LegalShell>
  );
}
