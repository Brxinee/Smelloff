import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/layout/LegalShell";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Smelloff collects, uses and protects your personal data under India's DPDP Act 2023.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <p>
        This Privacy Policy explains how Smelloff (&quot;we&quot;, the data
        fiduciary) collects, uses, shares and protects your personal data in
        accordance with India&apos;s Digital Personal Data Protection Act, 2023
        and the DPDP Rules, 2025.
      </p>

      <h2>Who we are</h2>
      <p>
        <strong>Data fiduciary:</strong> Smelloff, {SITE.city}, {SITE.region},
        India. Contact: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Full
        registered address: [[FILL: registered address]].
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>Name, shipping address, phone number and email when you order.</li>
        <li>
          Payment is processed by Razorpay — we never see or store your full card
          details.
        </li>
        <li>
          With your consent, analytics data (GA4, Meta Pixel) about how you use
          the site.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To process, ship and support your orders.</li>
        <li>To respond to your messages.</li>
        <li>With consent, to improve the site and (if opted in) send offers.</li>
      </ul>

      <h2>Consent &amp; withdrawal</h2>
      <p>
        We process data on the basis of your consent and for fulfilling your
        orders. You can withdraw consent (e.g. unsubscribe, reject cookies via our{" "}
        <Link href="/cookies">Cookie Policy</Link>) at any time without affecting
        prior lawful processing.
      </p>

      <h2>Your rights as a data principal</h2>
      <ul>
        <li>Access and correction of your personal data.</li>
        <li>Erasure of your data where no longer required.</li>
        <li>Grievance redressal and nomination.</li>
      </ul>
      <p>
        To exercise any right, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        If unsatisfied, you may complain to the Data Protection Board of India.
      </p>

      <h2>Third parties</h2>
      <p>
        We share the minimum data necessary with: Razorpay (payments), our
        courier partner (delivery), Google (GA4 / Sheets), Meta (Pixel) and
        Firebase (optional sign-in) — each only with consent where required.
      </p>

      <h2>Retention</h2>
      <p>
        We retain order data only as long as needed for the order, support and
        legal/tax obligations, then delete or anonymise it.
      </p>
    </LegalShell>
  );
}
