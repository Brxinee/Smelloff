import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LegalShell } from "@/components/layout/LegalShell";
import { getLegalContent } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Smelloff collects, uses and protects your personal data, in line with India's DPDP Act 2023.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <MDXRemote source={getLegalContent("privacy")} />
    </LegalShell>
  );
}
