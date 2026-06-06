import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LegalShell } from "@/components/layout/LegalShell";
import { getLegalContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Returns Policy",
  description:
    "7-day return window on ODORSTRIKE. Reverse pickup arranged; refunds in 5–7 business days.",
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <LegalShell title="Returns Policy" updated="June 2026">
      <MDXRemote source={getLegalContent("returns")} />
    </LegalShell>
  );
}
