import type { Metadata } from "next";
import { LegalShell } from "@/components/layout/LegalShell";
import { SITE, RETURN_WINDOW_DAYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Refund & Returns Policy",
  description: `Our ${RETURN_WINDOW_DAYS}-day return policy, eligibility and refund timelines.`,
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Returns Policy" updated="June 2026">
      <p>
        We want you to buy with confidence. If something&apos;s wrong, we&apos;ll
        make it right.
      </p>

      <h2>Eligibility</h2>
      <ul>
        <li>
          You have {RETURN_WINDOW_DAYS} days from delivery to request a return.
        </li>
        <li>
          For hygiene reasons, opened bottles can only be returned if defective or
          damaged in transit.
        </li>
        <li>Unopened items in original condition are eligible for return.</li>
      </ul>

      <h2>How to initiate</h2>
      <p>
        Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or WhatsApp us with
        your order ID and a photo if the item arrived damaged. We&apos;ll guide
        you through the pickup or return.
      </p>

      <h2>Refund method &amp; timeline</h2>
      <ul>
        <li>
          Prepaid orders: refunded to the original payment method within 5–7
          business days of us receiving the return.
        </li>
        <li>
          COD orders: refunded via UPI/bank transfer to details you provide.
        </li>
      </ul>

      <h2>COD notes</h2>
      <p>
        For COD returns, the COD fee is non-refundable unless the return is due to
        a defective or incorrect item.
      </p>
    </LegalShell>
  );
}
