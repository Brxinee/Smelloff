import type { Metadata } from "next";
import { LegalShell } from "@/components/layout/LegalShell";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing your use of the Smelloff store and purchases.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="June 2026">
      <p>
        These Terms govern your use of {SITE.url} and any purchase of ODORSTRIKE.
        By placing an order you accept these Terms.
      </p>

      <h2>Ordering &amp; acceptance</h2>
      <p>
        An order is an offer to buy. We confirm acceptance when we dispatch your
        order. We may decline or cancel an order (with full refund) in case of
        pricing errors or stock issues.
      </p>

      <h2>Pricing &amp; taxes</h2>
      <p>
        All prices are in INR and inclusive of all applicable taxes. Shipping and
        any COD fee are shown upfront at checkout before you pay.
      </p>

      <h2>Cash on Delivery</h2>
      <p>
        COD is available across India and carries the fee shown at checkout.
        Please keep the exact amount ready. Repeated refusal of COD orders may
        limit future COD eligibility.
      </p>

      <h2>Product use &amp; liability</h2>
      <p>
        ODORSTRIKE is a fabric freshener for use on clothing only. It is not a
        cosmetic, deodorant or skin product and must not be applied to skin.
        Follow the label. To the maximum extent permitted by law, our liability
        is limited to the value of the product purchased.
      </p>

      <h2>Intellectual property</h2>
      <p>
        All brand names, logos, content and design on this site are owned by
        Smelloff and may not be used without permission.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of India, with courts at {SITE.city},
        {" "}
        {SITE.region} having jurisdiction.
      </p>
    </LegalShell>
  );
}
