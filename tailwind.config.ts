import type { Config } from "tailwindcss";

/**
 * Smelloff design system — light mode.
 * Palette: deep teal brand + graphite ink + warm-orange action on cool off-white.
 * All foreground/background pairs are WCAG 2.2 AA verified for their documented use.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.mdx",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        // Text on white
        ink: "var(--ink)", // primary  (~15:1, AAA)
        "ink-2": "var(--ink-2)", // secondary (~8:1, AAA)
        "ink-3": "var(--ink-3)", // muted/meta (~4.6:1, AA)
        // Brand — teal
        brand: "var(--brand)", // links/headers on white (~4.7:1, AA)
        "brand-strong": "var(--brand-strong)", // hover/active (~6.8:1, AAA)
        "brand-tint": "var(--brand-tint)", // teal wash bg (use ink text)
        "on-brand": "var(--on-brand)",
        // Action — warm orange (primary CTA only)
        cta: "var(--cta)",
        "cta-strong": "var(--cta-strong)",
        "cta-tint": "var(--cta-tint)", // sale/save flags (use ink text)
        "on-cta": "var(--on-cta)",
        // Functional
        success: "var(--success)",
        error: "var(--error)",
        focus: "var(--focus)",
        "price-strike": "var(--price-strike)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["clamp(2.5rem, 6vw, 4.25rem)", { lineHeight: "1.06", letterSpacing: "-0.02em" }],
        h2: ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        h3: ["1.5rem", { lineHeight: "1.2" }],
      },
      maxWidth: {
        prose: "68ch",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,32,30,0.04), 0 8px 24px rgba(17,32,30,0.06)",
        header: "0 2px 12px rgba(17,32,30,0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
