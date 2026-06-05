import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/layout/LegalShell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "What cookies Smelloff uses, why, and how to change your consent at any time.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy" updated="June 2026">
      <p>
        Cookies are small files stored on your device. We use them to run the
        store and, only with your consent, to understand how the site is used.
      </p>

      <h2>Essential cookies</h2>
      <p>
        Required for the site to work — your cart, security and basic
        preferences. These are always on.
      </p>

      <h2>Analytics cookies (consent-based)</h2>
      <p>
        Google Analytics 4 and the Meta Pixel help us improve the store. These do
        not load until you click &quot;Accept&quot; on our consent banner. If you
        reject, they are never set.
      </p>

      <h2>Changing your choice</h2>
      <p>
        You can change your decision any time by clearing this site&apos;s storage
        in your browser, which will bring the consent banner back. For details on
        how we handle data, see our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalShell>
  );
}
