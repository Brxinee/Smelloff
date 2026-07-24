# Conversion / trust / design blueprint — gap analysis

**Date:** 2026-07-24
**Source:** *Smelloff / ODORSTRIKE conversion, trust, and design blueprint*
**Scope of this pass:** audit the whole blueprint against the live repo; implement the
content-compliance and homepage items only. Razorpay and bundles were explicitly
deferred by the site owner.

---

## Decisions taken this round

| Question | Decision |
| --- | --- |
| Bundles (₹399 two-pack / ₹549 three-pack) | **Not implemented.** `CLAUDE.md`'s "₹229 solo is the only SKU, no bundles anywhere" stays authoritative and overrides the blueprint's Stage-1 bundle recommendation. |
| Razorpay migration | **Deferred.** Needs a Razorpay account and secrets that don't exist in this repo. |
| Struck-through MRP | **Kept, corrected to ₹499** (was ₹579). See the caveat under "Fake / anchor MRP" below. |

---

## What the blueprint got right, and what was already fixed

The blueprint was written against an older snapshot. Several of its findings had
already been addressed before this pass:

- **Sticky add-to-cart bar** — already exists on the PDP (`.mobile-bar` in
  `odorstrike.html`). No work needed.
- **Fabricated reviews / aggregate rating** — already handled correctly.
  `CFG.VERIFIED_REVIEWS` is an empty array and every social-proof component is
  gated on real data, so nothing renders until real verified orders exist. No
  `AggregateRating` is emitted with invented numbers.
- **Consent gating** — a granular consent bar is live and blocks GA4/Meta Pixel
  until the visitor accepts.
- **Grievance officer** — named in the footer (`contact.html`).

Also note: **`CLAUDE.md` is stale.** It states that `index.html` is the
self-contained checkout page and that `/odorstrike` redirects to `/#buy`. The
reverse is true today — `odorstrike.html` is the 165 KB PDP that carries the
inline checkout, and `index.html` is a brand/funnel page. Worth correcting
separately.

---

## Implemented in this pass

### 1. Fake / anchor MRP

The struck price appeared in far more places than the blueprint identified —
**52 files**, not just the product page:

| Location | Was | Now |
| --- | --- | --- |
| `odorstrike.html` — hero, buy card, fix CTA, `CFG.MRP` | ₹579 + "60% OFF" | ₹499 + "54% OFF" |
| `_shared/end-of-post.html` + **48 blog posts** | ₹579 | ₹499 |
| 9 blog posts with bespoke CTAs (`price-strike`, `price-old`, prose "(₹579 MRP)") | ₹579 | ₹499 |
| `api/email-templates.js` (order + follow-up emails) | ₹579 | ₹499 |
| `assets/js/app.js` | ₹579 / ₹999 / ₹1399 hardcoded fallbacks, plus a `subtotal × 1.5` invented cart MRP | fallbacks removed; anchor renders only from a real `CFG.MRP` |
| `llms.txt`, `llms-full.txt` | ₹579 | ₹499 |

**Caveat that still needs the owner's confirmation.** MRP is a legally meaningful
figure: it is the maximum retail price declared on the physical pack under the
Legal Metrology (Packaged Commodities) Rules 2011. Striking it through is
legitimate **only if ₹499 is the figure actually printed on the ODORSTRIKE
bottle label.** If ₹499 is a chosen anchor rather than the declared pack price,
it carries the same exposure the blueprint flagged for ₹579 — under Section 21
of the Consumer Protection Act 2019 the CCPA can impose penalties up to ₹10 lakh
for a misleading advertisement, and up to ₹50 lakh for repeat contraventions.

The **"60% OFF" badge now reads "54% OFF"** — the arithmetic the two displayed
prices actually support, `(499 − 229) / 499`. The old 60% figure did not follow
from ₹579 → ₹229 either (that is 60.4%, but against a price that was never
charged). If `CFG.MRP.solo` or `CFG.PRICES.solo` ever change, this badge must
change with them: a discount percentage that doesn't reconcile with the two
prices on the same card is itself a misleading-price claim.

### 2. "India's first" superlative

Removed from all 13 occurrences across 5 files — `odorstrike.html` (4, including
two inside JSON-LD `description` fields), `about.html` (4), `llms-full.txt` (3),
`llms.txt` (1), `manifest.json` (1). Replaced with the plain descriptive form
("a pocket-sized fabric odor remover spray").

Under the ASCI code an objectively ascertainable claim must be substantiable on
demand. Restore the superlative only with dated third-party evidence.

### 3. Unsourced statistics

The PDP problem grid carried "11hr", "4×", "0" and "8sec" with no attribution.
All four tiles are now qualitative — "All day", "Again", "None", "Seconds" —
keeping the rhetorical structure without asserting a figure that would need a
citable source. The heading type was changed from a fixed 48px to
`clamp(28px,3.4vw,44px)` so word labels don't overflow the four-up grid.

### 4. Homepage price and buy CTA

`index.html` previously showed no price and no buy action, costing a click to
`/odorstrike` before a visitor could act. The hero now carries ₹229, the struck
₹499 MRP, a spec/shipping line, and a primary **"Buy Now — ₹229"** CTA linking
straight to `/odorstrike#buy`, with "See ODORSTRIKE" demoted to an outlined
secondary button so the acid-green fill stays reserved for one action per screen.

---

## Not implemented — ranked backlog

### Stage 1

1. **Razorpay migration (overdue, highest impact).** The PDP still runs the
   manual flow: display UPI ID `mr.brainy@ibl`, customer pays from their own app,
   then sends a screenshot and UTR over WhatsApp. Beyond the trust and friction
   cost, the blueprint's deadline has **already passed** — NPCI's retirement of
   manual VPA-entry UPI Collect took effect 28 February 2026, roughly five months
   ago. Needs: a Razorpay account, `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in
   Vercel env, `/api/create-order.js`, `/api/verify-payment.js` doing HMAC-SHA256
   verification of `order_id|payment_id`, and the checkout script loaded on
   intent rather than on every page.

2. **Bundles** — declined this round; recorded here only so the blueprint's
   recommendation isn't silently lost.

### Stage 2 — trust and compliance

3. **Legal Metrology Rule 6 declarations are absent from the listing.** No
   country of origin, net quantity declaration, packer name/address, or
   consumer-care block appears anywhere in the HTML. Rule 6(10) exempts only the
   month/year of manufacture for e-commerce listings; everything else must show.

4. **Grievance officer disclosure is incomplete.** `contact.html` names
   Jogdhande Nikhil Patil in the footer but gives no designation, no dedicated
   contact channel, and no statement of the 48-hour acknowledgement / one-month
   resolution commitments the Consumer Protection (E-Commerce) Rules 2020
   require.

5. **WhatsApp COD confirmation** replacing the manual phone call, plus a prepaid
   incentive at the payment step to pull RTO down.

### Stage 3 — performance and polish

6. **`assets/js/app.js` is dead code.** No page loads it — `odorstrike.html`
   carries its own inline checkout. It still defines duo/trio variants against
   `CFG.PRICES.duo` / `.trio`, which no longer exist. Either delete it or bring
   it back in sync; leaving a stale bundle-aware checkout in the tree invites a
   regression.

7. **Marquee cleanup** — the homepage ticker duplicates its phrase set; it is
   already `aria-hidden`, but repetition and continuous animation still cost INP.

8. **Meta Pixel + CAPI deduplication** — verify one `event_id` per conversion is
   shared between the browser Pixel and `api/meta-capi.js`, and that the server
   event fires only after payment verification (which today does not exist).

---

## Verification

Changes were rendered in Chromium at 390×844 and 1280×900 and checked on three
surfaces: the homepage hero, the PDP hero and buy card, and a blog end-of-post
CTA. `api/email-templates.js` and `assets/js/app.js` both pass `node --check`.
