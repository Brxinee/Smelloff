# Smelloff CRO Audit (Fixed, Implementation-Ready)

## Goal
Increase conversion by removing the #1 confusion: **ODORSTRIKE is sprayed on CLOTHES, not skin**.

## North-Star Message (must appear above fold)
`For clothes only. Not perfume. Not body deodorant.`

---

## A) Above-the-fold (Mobile) — what to change now

### Current risk
Users can still misclassify product as body mist.

### Fix (exact copy)
- **H1:** `Sweat Smell on Clothes? Fix It in 8 Seconds`
- **Subhead:** `ODORSTRIKE is a 50ml fabric odor eliminator for shirts, tees, and jackets. Spray on clothes only.`
- **Primary CTA:** `Get Clothes Odor Spray — ₹229`
- **Secondary CTA:** `How It Works on Fabric`
- **3 badges under CTA:** `Use on Clothes` · `Not for Skin` · `No Perfume Masking`

### Severity
**CRITICAL**

---

## B) Section-by-section conversion fixes

## 1. Hero
- **Current message:** Emotional + product card.
- **Likely misunderstanding:** “Is this perfume/body spray?”
- **Trust issue:** No explicit skin warning in first viewport.
- **Exact fix:** Add red micro-label near CTA: `DO NOT SPRAY ON SKIN`.
- **Severity:** **CRITICAL**

## 2. Product description
- **Current message:** Fast odor removal claim.
- **Likely misunderstanding:** “How is it different from deodorant?”
- **Trust issue:** Claim-heavy, not practical.
- **Exact rewrite:**
  `Built for fabric odor, not body sweat. ODORSTRIKE neutralizes smell trapped in shirt fibers after commute, office, or gym.`
- **Severity:** **HIGH**

## 3. How-to-use
- **Current message:** Generic 3-step guidance.
- **Likely misunderstanding:** How many sprays? Wait time?
- **Trust issue:** Ambiguous instructions reduce confidence.
- **Exact rewrite:**
  - `Shirt: 2–3 sprays (collar + underarm fabric)`
  - `T-shirt: 3–4 sprays`
  - `Jacket lining: 2 sprays`
  - `Wait 10–20 sec before wearing`
- **Severity:** **HIGH**

## 4. Deodorant vs fabric spray section
- **Current message:** Good angle but incomplete.
- **Likely misunderstanding:** “Should I replace deodorant?”
- **Trust issue:** Feels biased without “use both” framing.
- **Exact rewrite:**
  `Deodorant = for skin. ODORSTRIKE = for clothes. Use both for complete odor control.`
- **Severity:** **CRITICAL**

## 5. Testimonials
- **Current message:** Rating present, detail low.
- **Likely misunderstanding:** “Are these real?”
- **Trust issue:** Not enough use-case specificity.
- **Exact fix:** Force review template fields:
  `Where used (gym/office/commute)`, `fabric type`, `result time`, `would repurchase`.
- **Severity:** **HIGH**

## 6. FAQ
- **Current message:** Objections partly covered.
- **Likely misunderstanding:** Skin usage and stain safety unresolved early.
- **Trust issue:** Wrong order of FAQs.
- **Exact FAQ order:**
  1) `Can I spray on body?` → `No, clothes only.`
  2) `Will it stain dark clothes?`
  3) `Is this perfume?`
  4) `How long does effect last?`
  5) `How many sprays per use?`
- **Severity:** **CRITICAL**

## 7. Checkout overlay
- **Current message:** Manual UPI + WhatsApp UTR confirmation.
- **Likely misunderstanding:** “Is this payment secure?”
- **Trust issue:** Manual proof = high friction.
- **Exact fix:**
  - Add trust strip: `Secure checkout | COD | GST invoice | 7-day support`
  - Auto-capture UTR where possible.
  - Show delivery ETA before payment.
- **Severity:** **CRITICAL**

---

## C) CTA Audit (replace generic BUY NOW)

Use section-specific CTAs:
- `Get Clothes Odor Spray — ₹229`
- `Fix Shirt Smell Now`
- `Add ODORSTRIKE (For Clothes)`

**Severity:** **HIGH**

---

## D) Missing trust signals
1. `Fabric-safe on dark clothes` proof line
2. `Not for skin` safety label near spray image
3. Ingredient purpose (plain-English)
4. `No-clog spray head` replacement promise
5. Dispatch SLA + city-wise ETA

**Severity:** **HIGH**

---

## E) 7-Day CRO Sprint (ship order)

### Day 1–2 (Critical)
- Above-fold copy replacement + skin warning label.
- CTA replacement across hero/PDP.
- FAQ reorder with skin question first.

### Day 3–4 (High)
- Rewrite how-to with exact spray counts.
- Add deodorant-vs-fabric “use both” copy.
- Add trust strip in checkout.

### Day 5–7 (High)
- Add 6 structured testimonials.
- Add fabric-safe/dark-clothes proof snippet.
- Launch A/B test: generic CTA vs specific CTA.
