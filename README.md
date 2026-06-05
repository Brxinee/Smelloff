# Smelloff — ODORSTRIKE storefront

A production-grade, light-mode, multi-page e-commerce site for **Smelloff /
ODORSTRIKE** — a pocket-sized fabric odor eliminator for Indian men. Built
ground-up with Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind,
Framer Motion and MDX.

> ODORSTRIKE is a fabric freshener for use on clothing only. Not a cosmetic,
> deodorant or skin product. Copy across the site is claim-safe by design (no
> "antibacterial", "kills germs", "sanitizes", or skin/disease claims).

## Stack

- **Next.js 14 (App Router)** — server components by default, route handlers for APIs.
- **React 18 + TypeScript (strict, `noUncheckedIndexedAccess`)**.
- **Tailwind CSS** + design tokens in `app/globals.css` and `tailwind.config.ts`.
- **Framer Motion** — section reveals & overlay transitions (respects `prefers-reduced-motion`).
- **MDX** (`next-mdx-remote/rsc`) — blog posts in `content/blog/*.mdx`.
- **Zustand** — cart (persisted to localStorage) + UI store (drawers/overlays).
- **React Hook Form + Zod** — all forms, with accessible errors.
- **lucide-react**, **next/image**, **next/font**, **next/script**.
- Integrations: **Razorpay** (+ COD), **Firebase Auth** (lazy), **Google Sheets**
  (order logging), **GA4 + Meta Pixel** (consent-gated), **Resend** (optional email).

## Scripts

```bash
npm install
npm run dev        # local dev at http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint (next lint)
npm run typecheck  # tsc --noEmit
```

## Project structure

```
app/
  (marketing)/      home, product, shop, about, how-it-works, blog, contact
  (legal)/          privacy, terms, refund, shipping, cookies
  api/              razorpay/order, razorpay/verify, sheets, contact, newsletter
  layout.tsx        root: header, footer, providers, fonts, JSON-LD
  not-found.tsx · globals.css · sitemap.ts · robots.ts
components/
  layout/ commerce/ product/ sections/ ui/ mdx/ seo/ providers/
lib/                content, stores, integrations, validators, format, hooks
content/            products.json, reviews.json, faq.json, nav.json, blog/*.mdx
types/              shared domain types
public/             images, og, favicons
```

## Editing content (no code required)

- **Products / packs / prices** → `content/products.json`
- **Reviews** → `content/reviews.json`
- **FAQ** → `content/faq.json`
- **Nav & footer links + announcement** → `content/nav.json`
- **Blog posts** → add a `content/blog/<slug>.mdx` file with frontmatter:

```mdx
---
title: "..."
excerpt: "..."
category: "Odor Science"
date: "2026-06-01"
readTime: "4 min read"
author: "Smelloff"
hero: "/images/your-image.png"
heroAlt: "describe the image"
featured: true   # optional — promotes to the blog hero
---

Body in MDX. Custom components available: <Callout>, <Quote author="...">,
<PostImage src="..." alt="..." />, <CTAInline />.
```

## Environment variables

Copy `.env.example` → `.env.local` and fill in. Nothing is hardcoded; every
integration is **env-gated** and degrades gracefully when keys are absent (e.g.
online payment hides and COD still works; analytics simply don't load).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical/OG/sitemap base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay order + signature verify |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Auth (lazy, optional) |
| `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Sheets order log (service account) |
| `SHEETS_WEBHOOK_URL` | Alternative Apps Script webhook (used if set) |
| `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID` | Analytics (consent-gated) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `CONTACT_TO_EMAIL` | Contact + order email (optional) |

## Payments flow

1. Client calls `POST /api/razorpay/order` — server recomputes the amount from
   item prices (never trusts the client total) and creates a Razorpay order with
   the **secret key server-side**.
2. Razorpay Checkout opens (loaded only on Buy click).
3. On success, client calls `POST /api/razorpay/verify` — server verifies the
   HMAC `razorpay_signature` and logs the order to Google Sheets.
4. **COD** posts to `POST /api/sheets` with its own order path and fee shown
   upfront.

No fake urgency anywhere — no countdown timers, fake stock counters or fake
purchase tickers. Only genuine signals (real review counts, a real
free-shipping threshold, real COD/return policy).

## Accessibility & performance

- WCAG 2.2 AA tokens, visible focus rings, focus-trapped drawers/overlays, ESC to
  close, body scroll-lock, restored focus, color never the sole signal.
- `next/image` (AVIF/WebP, sized — zero CLS), `next/font` self-hosted, lazy
  below-fold, analytics `afterInteractive` and only post-consent.
- Per-route metadata + Open Graph; JSON-LD (Product+AggregateRating, Article,
  Organization, Breadcrumb); `sitemap.ts` + `robots.ts`.

## Fonts

Uses `next/font/google` (Space Grotesk + Inter) out of the box — no external
files needed. To switch to Clash Display + Satoshi, drop the woff2 files into
`public/fonts/` and swap `lib/fonts.ts` to `next/font/local`.

## Legal placeholders

Search for `[[FILL]]` to complete company-specific blanks (registered address,
phone, manufacturer details, WhatsApp number) before going live. The PDP renders
the Legal Metrology (Packaged Commodities Rules, 2011) product-information block;
confirm 50 ml standard-pack requirements for your SKU.

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel (auto-detects Next.js).
2. Add the environment variables above in the Vercel project settings.
3. Deploy. `next.config.mjs` sets security headers and image formats.
