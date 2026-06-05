import { Space_Grotesk, Inter } from "next/font/google";

/**
 * Self-hosted via next/font (no layout shift, no external blocking request).
 * Display = Space Grotesk, Body = Inter — the zero-fuss pairing from Part 3.
 * To switch to Clash Display + Satoshi, drop the woff2 files into /public/fonts
 * and swap these for next/font/local definitions.
 */
export const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const fontBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
