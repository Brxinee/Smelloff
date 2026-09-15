# Smelloff transactional email system

Single server-side sender: `api/_email.js` (Resend).
Templates: `api/_email-templates.js`.
Order / payment / fulfillment dispatch: `api/_email-dispatch.js`.

Production sender must stay `ODORSTRIKE <orders@smelloff.in>`.
There is **no** `resend.dev` fallback in production.
Email failure **never** rolls back a captured payment or a placed COD order.

Checkout email is **required**. Smelloff collects and validates it before Razorpay opens. Razorpay `prefill.email` is convenience only — we do not wait for Razorpay to return an address.

---

## A. Research findings (2026)

Authoritative sources used: [Gmail sender guidelines](https://support.google.com/mail/answer/81126) as summarized in 2026 bulk-sender checklists, [Resend domain docs](https://resend.com/docs/add-a-domain), Resend transactional-email skill, Shopify / Apple / Nike / Amazon confirmation patterns.

### Deliverability (do this, not folklore)

| Rule | Smelloff decision |
|---|---|
| All senders: SPF **or** DKIM, TLS, PTR on the sending IP, RFC 5322 | Resend handles TLS + PTR. Domain must be **Verified** in Resend. |
| Bulk senders (5,000+/day to Gmail): SPF **and** DKIM, DMARC `p=none` minimum, From-domain alignment, spam < 0.3% (aim 0.1%) | Smelloff is far below bulk. Authenticate anyway. Current `_dmarc` is `p=none; adkim=s; aspf=s` — **strict alignment**, so SPF or DKIM must pass on `smelloff.in`. |
| One-click unsubscribe (RFC 8058) | **Required for marketing. Transactional is exempt.** Receipts, shipping, delivery, failed-payment, cancel, refund stay transactional. No `List-Unsubscribe` header. |
| Review request | One-time, order-tied, no offer, no list. Treated as transactional follow-up. If campaigns are added later, send them from a **different subdomain**. |
| From alignment | Visible From domain must be the domain that passed SPF or DKIM. Keep `orders@smelloff.in`. Do not send production mail from `@resend.dev`. |
| Resend domain | Resend recommends a sending subdomain (`mail.` / `orders.`). Changing From now would require new DNS + warming. **Keep apex From** until the current domain is Verified. Future marketing: `news.smelloff.in`, never the transactional From. |
| Reply-To | Avoid `noreply@`. Founder inbox is `smelloffsupport@gmail.com`. Reply-To does not affect DMARC. Switch Reply-To to `orders@smelloff.in` once Cloudflare Email Routing delivers that mailbox. |
| Bounce / suppression | Resend webhook updates `email_events`. Do not retry hard bounces. |
| Apex SPF today | Cloudflare inbound only (`include:_spf.mx.cloudflare.net`). That does **not** authorize Resend. Until Resend is Verified, Gmail may junk or reject `orders@smelloff.in`. |

### UX patterns borrowed (not copied)

From Apple / Nike / Amazon / good Shopify receipts:

- Confirmation in under a minute. Open rates 60–80% because the buyer is waiting.
- Order number in the **subject**, not only the body.
- Product image + name + qty + total so images-off still reads as a receipt.
- One primary CTA (track / retry / review). Never a grid of promotions on a receipt.
- Delivery estimate on confirm. Tracking number on shipped. “Today” language on out-for-delivery.
- Support in the footer of every mail.

What Smelloff should **not** copy:

- Generic “Thank you for your order.”
- Cross-sell blocks on the receipt (single SKU; it looks like spam).
- A separate “payment received” mail 8 seconds after “order confirmed.”
- Review CTA on the delivered mail (too soon; the bottle has not been used).
- Tactical gimmick copy that sounds like a game, not a brand that just took ₹229.

### Combined vs separate payment email

**Decision: one prepaid mail.** Amazon-style receipt. The buyer paid; they need “what I bought, what I paid, where it ships, how to track.” A second “Payment received” mail is a support ticket waiting to happen (“did I get charged twice?”).

COD stays a **different** confirmation: nothing charged, amount due on delivery.

Admin still gets both `admin-new-order` and `admin-payment-confirmed` on prepaid. Operators want the split; customers do not.

### Review timing for a 50ml fabric mist

ODORSTRIKE is used the same day it arrives, but a useful review needs one or two real wears. Industry default for consumables is 5–14 days after delivery. Smelloff sends **one** review request in that window via the existing Shiprocket GET cron (10:00 UTC). No new Vercel function. Delivered mail itself stays “it’s here + how to use.”

### Razorpay cannot be the email source

Razorpay Checkout `prefill.email` is optional. Buyers can skip it, paste a typo, or use a wallet that never returns email. Smelloff therefore:

1. Requires + validates email on `/odorstrike` **before** `startRazorpay()`.
2. Rejects `/api/create-order` without a valid email (Vercel + Edge Function).
3. Persists `orders.customer_email`.
4. Triggers mail from **server** events (webhook, verify-payment, create-order, shiprocket-sync). Client `SmelloffEmail.send` is a fallback with the Postgres confirmation claim.

---

## B. Email trigger map

| Email | Event | Route | Recipient | Idempotency key |
|---|---|---|---|---|
| Customer order confirmation **+ prepaid receipt** | Prepaid payment captured / verified | `/api/webhook` `payment.captured`, `/api/verify-payment`, `/api/payment-status`, `/api/admin/verify-payment`, `/api/send-email` fallback | `orders.customer_email` | `order-confirmation/SMF-YYYYMMDD-XXXX` |
| Customer COD confirmation | COD order placed | `/api/create-order` | customer | `order-confirmation/SMF-…` (same template, COD copy) |
| Customer payment confirmation | — | **not sent** | — | skipped `COMBINED_INTO_ORDER_CONFIRMATION` |
| Failed payment | Razorpay `payment.failed` on `pending` / `upi_pending` only | `/api/webhook` | customer | `payment-failed/SMF-…` |
| Shipped | Shiprocket → `dispatched` | `/api/shiprocket-sync` | customer | `shipping/SMF-…` |
| Out for delivery | Shiprocket → `out_for_delivery` | `/api/shiprocket-sync` | customer | `out-for-delivery/SMF-…` |
| Delivered | Shiprocket → `delivered` | `/api/shiprocket-sync` | customer | `delivered/SMF-…` |
| Review request | Delivered 5–14 days ago, valid email | GET `/api/shiprocket-sync` daily cron | customer | `review-request/SMF-…` |
| Order cancelled | Admin `action=cancel` | `/api/admin/verify-payment` | customer | `order-cancelled/SMF-…` |
| Refund processed | Razorpay `refund.processed` / `payment.refunded` | `/api/webhook` | customer | `refund-processed/SMF-…` |
| Admin new order | COD placed or prepaid confirmed | create-order / payment routes | `ADMIN_NOTIFY_EMAIL` | `admin-new-order/SMF-…` |
| Admin payment confirmed | Prepaid confirmed | payment routes | `ADMIN_NOTIFY_EMAIL` | `admin-payment-confirmed/SMF-…` |
| Email failure alert | Any transactional send failure | internal | `ADMIN_NOTIFY_EMAIL` | `email-failure/SMF-…/<type>:<code>` |
| Diagnostic test | Admin-only | `POST /api/admin/test-email` | requested inbox | `email-system-test/<email>:<minute>` |

Client `SmelloffEmail.send` in `odorstrike.html` remains a **fallback** only. Server dispatch + the Postgres confirmation claim prevent duplicates.

Payment confirmation is persisted **before** email. Email failure never rolls back a captured payment. Confirmed orders are **never** downgraded by a later `payment.failed`.

No processing-email. Pack-within-48h copy lives on the confirmation. A “we packed it” mail without a tracking number creates more tickets than it prevents.

---

## C. Checkout: mandatory email

Implemented on three layers. All three must agree.

1. **UI** (`odorstrike.html`): email sits after name, `required`, `type="email"`, hint *“Required for your receipt and delivery updates. We never share it.”* `validateForm()` includes `f_email` and a format regex. Value is lowercased.
2. **Client start** (`assets/js/chrome.js`): `normalizeEmail` + `isValidCheckoutEmail`. `startRazorpay()` blocks with a visible error if the address is missing/invalid **before** `create-order`. Razorpay `prefill.email` is the already-validated address.
3. **Server**: `api/create-order.js` and `supabase/functions/create-order/index.ts` return **400** `A valid email is required for your receipt and delivery updates.` Quantity / amount checks still run first so tampering tests stay sharp.

Do **not** make `customer_email` NOT NULL. Historical COD rows can be null. New checkouts cannot.

Duplicate emails across customers are allowed. Identity is `order_code` + phone, not email.

---

## D. Design system

Email-safe HTML tables. No JS. No webfonts. Arial / Helvetica. Dark body so Gmail / Outlook / Apple Mail all render the matte-black brand.

| Token | Value |
|---|---|
| Background | `#080808` |
| Panel | `#111111` |
| Border | `#1F1F1F` |
| Acid green | `#B8FF57` |
| Off-white | `#F5F5F0` |
| Muted | `#A8A8A0` |
| Body | 15px / 1.6 |
| Hero | 34px uppercase, 28px on ≤620px |
| CTA | 44px-tall green pill, black type, uppercase tracking |
| Product row | 72px bottle JPG + name + “Fabric-only odor mist · 50ml · Qty n” |
| Preheader | hidden first line, unique per template |
| Logo | `https://smelloff.in/assets/brand/logo-smelloff-white.png` |
| Product image | `https://smelloff.in/assets/odorstrike-bottle.jpg` |

Readable with images off: subject, preheader, plaintext alternative, and HTML text all carry order id, total, and the track URL.

No `List-Unsubscribe`. No emoji. No “odor killer” / “kills odor” claims.

---

## E. Production copy (subjects + preheaders)

| Type | Subject | Preheader |
|---|---|---|
| Prepaid confirm | `Order confirmed — #SMF-…` | `₹229 paid. Your ODORSTRIKE order #SMF-… is confirmed.` |
| COD confirm | `COD order confirmed — #SMF-…` | `Pay ₹289 on delivery. Nothing charged yet. Order #SMF-….` |
| Failed payment | `Payment didn't go through — #SMF-…` | `Nothing was charged for order #SMF-…. You can try again.` |
| Shipped | `Shipped — #SMF-… · AWB` | `{Courier} has your ODORSTRIKE. Tracking is live.` |
| Out for delivery | `Out for delivery today — #SMF-…` | `Your ODORSTRIKE is out for delivery. Keep your phone close.` |
| Delivered | `Delivered — #SMF-…` | `Your ODORSTRIKE has arrived. Two sprays. Thirty seconds.` |
| Review | `How's ODORSTRIKE treating your clothes?` | `Thirty seconds if it earned a review. One-time ask.` |
| Cancelled | `Order cancelled — #SMF-…` | `Your ODORSTRIKE order #SMF-… was cancelled.` |
| Refund | `Refund processed — #SMF-…` | `Your refund of ₹229 for order #SMF-… is on its way.` |

Opening lines stay short: “Payment received. Your ODORSTRIKE is locked in.” / “Nothing has been charged — pay ₹289 in cash or UPI when it arrives.”

---

## F. Code map

| File | Role |
|---|---|
| `api/_email.js` | One Resend client. Await send. Inspect `data`/`error`. Slash idempotency keys. Masked logs. Fail closed on missing key / unverified `@resend.dev` in production. |
| `api/_email-templates.js` | Shared shell + every template (HTML + plaintext). |
| `api/_email-dispatch.js` | Event → template. Combined prepaid receipt. Review window. Cancel / refund / failed-payment. |
| `api/_resend-webhook.js` | Svix verify. Maps delivery events onto `email_events`. |
| `api/send-email.js` | Public confirm (token) + diagnostic rewrite target. Postgres claim. |
| `api/create-order.js` | Requires email. COD dispatch. |
| `api/webhook.js` | Razorpay capture / fail / refund + Resend rewrite. |
| `api/shiprocket-sync.js` | Fulfillment mail. GET cron also runs review dispatch even if Shiprocket is unconfigured. |
| `supabase/functions/create-order/index.ts` | Requires email at persist time. |
| `supabase/migrations/20260915_email_events.sql` | Send ledger + webhook event log. |
| `odorstrike.html` / `assets/js/chrome.js` | Required email field + pre-Razorpay guard. |

Hobby cap: 12 serverless functions. Diagnostic and Resend webhook are **rewrites** onto existing functions. Files starting with `_` are not deployed as functions.

---

## G. Backend resilience

| Failure | Behaviour |
|---|---|
| Payment succeeds, Resend 5xx | Order stays confirmed. Claim released. Failure alert to admin. Retry is safe via slash idempotency key. |
| Webhook twice | Event-id LRU + confirmation claim + Resend idempotency key. HTTP 200 `duplicate`. |
| Frontend crash after pay | Razorpay webhook still confirms + emails. |
| Buyer refreshes success | Client fallback is claimed; second send is idempotent. |
| Invalid email at checkout | Never reaches Razorpay. |
| Historical null email | Fulfillment / review skip with `INVALID_RECIPIENT`. Payment is untouched. |
| Supabase down at send | Claim RPCs fail closed. No silent in-memory send in production. |
| Shiprocket unconfigured | POST 503. GET cron still 200 and still runs review dispatch. |

`EMAIL_SIDE_EFFECTS=0` and `__MOCK_ORDER_DB__` skip persist + failure-alert side effects in tests.

---

## H. Database

Existing `orders` columns are enough for triggers: `customer_email`, `confirmation_email_sent_at`, `confirmation_email_claimed_at`, `confirmation_email_claim_id`, `status`, `delivered_at` / `updated_at`.

Do **not** add a review-sent column. Resend idempotency `review-request/SMF-…` is the duplicate guard.

Apply `supabase/migrations/20260915_email_events.sql`:

- `email_events` — one row per attempt (`idempotency_key` unique).
- `email_webhook_events` — Svix `svix_id` unique.
- RLS on, grants to `service_role` only.

Status labels: API accept → `QUEUED`. Webhook `email.sent` → `SENT`. `email.delivered` → `DELIVERED`. Never mark delivered from the send API response alone.

---

## I. Environment (Vercel Production)

Required:

- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET` / `ADMIN_KEY` (diagnostic)
- `CRON_SECRET` (Vercel cron on `/api/shiprocket-sync`)
- `RAZORPAY_WEBHOOK_SECRET`

Recommended:

- `EMAIL_FROM=ODORSTRIKE <orders@smelloff.in>`
- `EMAIL_REPLY_TO=smelloffsupport@gmail.com`
- `ADMIN_NOTIFY_EMAIL=smelloffsupport@gmail.com`
- `RESEND_WEBHOOK_SECRET` (Svix signing secret from Resend → Webhooks)

Do not set `EMAIL_FROM` to any `@resend.dev` address in production.

---

## J. Test matrix

Covered in `test/email-system.test.mjs`, `test/checkout.test.mjs`, `tests/api/*.js`:

- missing API key, invalid recipient, Resend 5xx, template render, XSS escape, no PII in `EMAIL_*` logs
- unverified `@resend.dev` blocked in production
- prepaid = one receipt, no `payment-confirmation/` key
- COD copy, failed payment, review window 5–14 days, slash keys
- duplicate Razorpay webhook does not roll back confirm when email fails
- `payment.failed` does not downgrade confirmed
- Shiprocket GET 200 when unconfigured; POST 503
- checkout HTML requires email; create-order 400 on missing/invalid
- diagnostic 401 without admin; never accepts a client API key
- Resend webhook Svix verify
- cancel / refund templates + dispatch keys

Manual (owner, after DNS Verified):

- `POST /api/admin/test-email` to a real inbox (not `@example.com`)
- Gmail / Outlook / Apple Mail render of the diagnostic
- One live prepaid + one live COD
- Razorpay test `payment.failed`
- Images-off readability

---

## DNS observed 2026-09-15 (public DNS, not invented)

Queried via Cloudflare DNS-over-HTTPS. **Do not paste invented DKIM CNAMEs.**

| Record | Observed | Notes |
|---|---|---|
| `smelloff.in` MX | Cloudflare Email Routing (`route1/2.mx.cloudflare.net`) | Inbound mail is Cloudflare, not Resend |
| `smelloff.in` TXT SPF | `v=spf1 include:_spf.mx.cloudflare.net ~all` | **No Resend / Amazon SES include** on the apex |
| `_dmarc.smelloff.in` TXT | `v=DMARC1; p=none; rua=mailto:smelloffsupport@gmail.com; pct=100; adkim=s; aspf=s` | Strict alignment. SPF/DKIM must pass for `smelloff.in` |
| `resend._domainkey.smelloff.in` TXT | DKIM TXT present (older 1024-bit style, not a CNAME) | Historical Resend TXT DKIM install |
| `send.smelloff.in` MX | `10 feedback-smtp.ap-northeast-1.amazonses.com` | Resend bounce/feedback domain (SES) |
| `send.smelloff.in` TXT | Cloudflare `_spfm` include, **not** `amazonses.com` | Bounce-domain SPF does not currently include SES |

Because apex SPF has no Resend/SES include and DMARC is strict, production delivery from `orders@smelloff.in` is **DOMAIN_CONFIGURATION_REQUIRED** until the Resend dashboard shows the domain **Verified** and the records Resend currently displays are the ones in DNS.

---

## Remaining Resend dashboard steps (owner)

1. Open [Resend → Domains](https://resend.com/domains) for `smelloff.in`.
2. Confirm status is **Verified**. If not, add **exactly** the records Resend shows (DKIM CNAME(s), optional `send` MX/SPF). Do not invent values.
3. If Resend now uses CNAME DKIM (`resend._domainkey` → `….resend.com`) and DNS still has the old TXT, replace the TXT with the CNAME Resend displays.
4. Keep `From` as `ODORSTRIKE <orders@smelloff.in>`. Enable click-tracking only if you accept Resend rewriting links.
5. Add webhook `https://smelloff.in/api/resend-webhook` for sent/delivered/failed/bounced/complained/delivery_delayed. Put the signing secret in Vercel Production as `RESEND_WEBHOOK_SECRET`.
6. Apply the `email_events` migration in the Smelloff Supabase project.
7. Send `POST /api/admin/test-email` to a real inbox you control (not `@example.com` — Resend rejects it).
8. Confirm Vercel Production has `CRON_SECRET` so the 10:00 UTC `/api/shiprocket-sync` cron is authorized.

Cloudflare Email Routing on the apex MX is fine for **inbound** `orders@` / support aliases. It is not a substitute for Resend **outbound** DKIM/SPF.

---

## K. UX audit

Would I trust this email if I had just spent ₹229?

- Subject has the order id. Inbox search works.
- Prepaid mail says **paid**, shows the bottle, the total, the address, the Razorpay reference.
- COD mail says **nothing charged** in the first paragraph. That is the ticket-killer.
- Failed payment says **not charged** and offers retry, and never touches a confirmed order.
- Delivered mail teaches use. Review waits until the jacket has actually been worn.
- Support is a real Reply-To, not `noreply@`.
- No second receipt. No unsubscribe on a receipt. No coupon.

Remaining trust gap is **DNS**, not copy: until Resend shows Verified, Gmail may still file these as spam. That is an owner dashboard step, not a code step.

Status labels: API accept → `QUEUED`. Webhook `email.sent` → `SENT`. Webhook `email.delivered` → `DELIVERED`. Never mark delivered from the send API response alone.
