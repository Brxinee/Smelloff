import type { Metadata } from "next";
import { LegalShell } from "@/components/layout/LegalShell";
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING } from "@/lib/constants";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Dispatch and delivery estimates, COD availability, charges and the free-shipping threshold.",
  alternates: { canonical: "/shipping" },
};

export default function ShippingPage() {
  return (
    <LegalShell title="Shipping Policy" updated="June 2026">
      <h2>Dispatch &amp; delivery</h2>
      <ul>
        <li>Orders are dispatched within 1–2 business days.</li>
        <li>
          Delivery typically takes 3–7 business days depending on your location.
        </li>
        <li>You&apos;ll receive tracking details once your order ships.</li>
      </ul>

      <h2>Charges</h2>
      <ul>
        <li>
          Flat shipping of {formatINR(FLAT_SHIPPING)} on orders below{" "}
          {formatINR(FREE_SHIPPING_THRESHOLD)}.
        </li>
        <li>
          <strong>Free shipping</strong> on orders of{" "}
          {formatINR(FREE_SHIPPING_THRESHOLD)} and above.
        </li>
        <li>COD is available across India; any COD fee is shown at checkout.</li>
      </ul>

      <h2>Tracking</h2>
      <p>
        Once dispatched, we&apos;ll share a tracking link by email/SMS/WhatsApp so
        you can follow your order to your door.
      </p>
    </LegalShell>
  );
}
