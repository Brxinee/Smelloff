import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LegalShell } from "@/components/layout/LegalShell";
import { getLegalContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Shipping times, charges and tracking for ODORSTRIKE orders across India.",
  alternates: { canonical: "/shipping" },
};

export default function ShippingPage() {
  return (
    <LegalShell title="Shipping Policy" updated="June 2026">
      <MDXRemote source={getLegalContent("shipping")} />
    </LegalShell>
  );
}
