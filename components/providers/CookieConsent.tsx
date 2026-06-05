"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const CONSENT_KEY = "smelloff-consent";

type Consent = "accepted" | "rejected" | null;

/** Non-blocking bottom banner. Meta Pixel / GA4 do not fire until accepted. */
export function CookieConsent({
  onConsentChange,
}: {
  onConsentChange: (c: Exclude<Consent, null>) => void;
}) {
  const [choice, setChoice] = React.useState<Consent>("accepted"); // hide until mounted check

  React.useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY) as Consent;
    setChoice(stored);
    if (stored === "accepted") onConsentChange("accepted");
  }, [onConsentChange]);

  const decide = (c: Exclude<Consent, null>) => {
    window.localStorage.setItem(CONSENT_KEY, c);
    setChoice(c);
    onConsentChange(c);
  };

  if (choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/98 p-4 shadow-header backdrop-blur"
    >
      <div className="container-px flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-2">
          We use essential cookies to run the store, and—only with your
          consent—analytics cookies to improve it. See our{" "}
          <Link href="/cookies" className="underline">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => decide("rejected")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => decide("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
