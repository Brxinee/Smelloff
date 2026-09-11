# Analytics Data Import Guide

This document outlines the requirements and procedures for importing real **Google Analytics 4 (GA4)** and **Google Search Console (GSC)** export data into the Smelloff.in repository for automated conversion, funnel, and performance analysis.

---

## 1. Privacy & Data Protection (Strict Requirement)

> **CRITICAL WARNING**:
> Under NO circumstances should personally identifiable information (PII) or customer credentials be exported or placed in this repository.
> 
> **DO NOT UPLOAD:**
> - Customer names, phone numbers, or email addresses
> - Shipping or billing street addresses
> - Payment card details, UPI IDs, or gateway credentials
> - Customer support messages or private correspondence
>
> **ONLY UPLOAD:** Aggregated analytics reports and ecommerce performance metrics exported directly from the Google Analytics 4 interface or Google Search Console.

All data export formats (`*.csv`, `*.tsv`, `*.xlsx`) inside `./data/` are strictly ignored by Git via `.gitignore` to prevent accidental commits.

---

## 2. Directory Structure & File Placement

Place all raw export files directly into the root `./data/` directory:

```text
data/
├── .gitkeep                 # Versioned placeholder (keeps directory present)
├── funnel_events.csv        # GA4 Funnel events export (optional name)
├── ecommerce_orders.csv     # GA4 Ecommerce / Transaction export (optional name)
├── cta_performance.csv      # GA4 Custom dimension cta_location (optional name)
├── device_performance.csv   # GA4 Device category export (optional name)
├── acquisition.csv          # GA4 Traffic acquisition / channels (optional name)
├── landing_pages.csv        # GA4 Landing pages export (optional name)
├── Queries.csv              # Google Search Console queries export
└── Pages.csv                # Google Search Console pages export
```

*Note: Exports can be provided as single multi-column files or multiple distinct CSV/TSV files. The analyzer auto-detects schemas from the column headers.*

---

## 3. Supported GA4 Data & Schemas

The ingestion engine (`scripts/analyze-analytics-export.mjs`) automatically parses and identifies datasets matching the following criteria:

### A. Funnel & Event Ingestion
- **Recognized Headers**: `Event name`, `Event count`, `Total users`, `Sessions`
- **Expected Funnel Events**:
  - `page_view`: Overall site visits
  - `view_item`: Visits to `/odorstrike` (50ml PDP)
  - `add_to_cart`: Product interactions and checkout drawer openings
  - `begin_checkout`: Initiation of order form entry
  - `add_payment_info`: Payment method selection (COD, UPI, Razorpay)
  - `purchase`: Confirmed order transactions

### B. Ecommerce & Transactions
- **Recognized Headers**: `Transaction ID`, `Item name`, `Quantity`, `Value`, `Item revenue`, `Currency`, `Payment type`
- **Validation Rules**:
  - Purchases are deduplicated strictly by `transaction_id`.
  - Values must be positive numbers in `INR`. Non-INR rows are flagged in the data quality audit.
  - Test/demo records (containing `test`, `demo`, or `dummy`) are automatically isolated and reported in exclusions.

### C. Custom Dimensions & Segmentations
- **CTA Location**: Headers containing `cta_location`, `CTA Location`, or `custom cta`. Expected values: `pdp_hero`, `pdp_showcase`, `pdp_pricing`, `pdp_final`, `mobile_sticky`, `cart`.
  - *Methodology*: `cta_location` is an event-scoped interaction origin, not an ungrounded last-touch purchase attribution.
- **Payment Methods**: Headers containing `payment_type` or `payment method`. Expected values: `cod`, `razorpay`, `upi`.
- **Device Categories**: Headers containing `device category` or `device`. Expected values: `mobile`, `desktop`, `tablet`.
- **Acquisition Channels**: Headers containing `session default channel group` or `source / medium`.
- **Landing Pages**: Headers containing `landing page` or `page path`. Expected targets: `/`, `/odorstrike`, `/solutions/*`, `/blog/*`.
- **AI Referrals**: Headers containing `ai_source` or `ai_referral`.

---

## 4. Supported Google Search Console Data

Exports downloaded from the Google Search Console **Performance** tab (Web search):

### A. Queries (`Queries.csv`)
- **Recognized Headers**: `Top queries` (or `Query`), `Clicks`, `Impressions`, `CTR`, `Position`
- **Purpose**: Identifies high-impression commercial-intent search queries with low CTR for targeted meta/content optimization.

### B. Pages (`Pages.csv`)
- **Recognized Headers**: `Top pages` (or `Page`), `Clicks`, `Impressions`, `CTR`, `Position`
- **Purpose**: Evaluates search visibility across core product and educational URLs.

---

## 5. Execution Command

Run the automated hardened analysis engine against the data directory:

```bash
node scripts/analyze-analytics-export.mjs ./data
```

You can also target an individual file directly:

```bash
node scripts/analyze-analytics-export.mjs ./data/ecommerce_orders.csv
```

---

## 6. The "Missing Data = Unavailable" Rule

The analyzer enforces strict empirical data integrity:
- If a dataset, dimension, or funnel step is missing from the exported files, the analyzer outputs:
  ```text
  unavailable
  ```
- Missing data is **NEVER converted to zero** or assumed to be an abandonment.
- Rates are calculated strictly across identical units (event-based vs. user-based vs. session-based).
- Every comparison displays the exact sample size (`n = X`).
- If no files are in `./data/`, the analyzer safely halts with:
  ```text
  NO HISTORICAL DATA AVAILABLE — NO BUSINESS CONCLUSION CAN BE MADE.
  ```
