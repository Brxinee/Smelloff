"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { CheckoutOverlay } from "@/components/commerce/CheckoutOverlay";
import { CookieConsent } from "./CookieConsent";
import { Analytics } from "./Analytics";

/** Client root: toasts, cart/checkout overlays, consent-gated analytics. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [analyticsOn, setAnalyticsOn] = React.useState(false);

  return (
    <ToastProvider>
      {children}
      <CartDrawer />
      <CheckoutOverlay />
      <CookieConsent
        onConsentChange={(c) => setAnalyticsOn(c === "accepted")}
      />
      {analyticsOn && <Analytics />}
    </ToastProvider>
  );
}
