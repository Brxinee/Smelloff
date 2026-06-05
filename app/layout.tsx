import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE } from "@/lib/constants";
import { SkipLink } from "@/components/layout/SkipLink";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/components/providers/Providers";
import { JsonLdOrganization } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Smelloff — ODORSTRIKE Pocket Fabric Odor Eliminator",
    template: "%s · Smelloff",
  },
  description:
    "ODORSTRIKE is a 50ml pocket fabric mist that traps and neutralizes odor in your clothes. For fabrics only — not for skin. COD + UPI across India.",
  keywords: [
    "fabric odor eliminator",
    "clothes odor spray",
    "ODORSTRIKE",
    "Smelloff",
    "sweat smell from clothes",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE.url,
    siteName: SITE.name,
    title: "Smelloff — ODORSTRIKE Pocket Fabric Odor Eliminator",
    description:
      "Pocket-sized odor killer for your clothes — anytime, anywhere. For fabrics only.",
    images: [{ url: "/og/og-default.jpg", width: 1200, height: 630, alt: "ODORSTRIKE" }],
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0F6E78",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <JsonLdOrganization />
        <SkipLink />
        <Providers>
          <AnnouncementBar />
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
