# Smelloff transactional email system

Single server-side sender: `api/_email.js` (Resend).
Templates: `api/email-templates.js`.
Order/payment/fulfillment dispatch: `api/_email-dispatch.js`.

Production sender must stay `ODORSTRIKE <orders@smelloff.in>`.
There is **no** `resend.dev` fallback in production.

## Email trigger map

| Email | Event | Route | Recipient | Idempotency key |
|---|---|---|---|---|
| Customer order confirmation | COD placed, or prepaid payment confirmed | `/api/create-order` (COD), `/api/webhook`, `/api/verify-payment`, `/api/payment-status`, `/api/admin/verify-payment`, `/api/send-email` | `orders.customer_email` | `order-confirmation/SMF-YYYYMMDD-XXXX` |
| Customer payment confirmation | Prepaid payment captured/verified | webhook, verify-payment, payment-status, admin verify-payment | customer | `payment-confirmation/SMF-…` |
| Customer COD confirmation | Same template as order confirmation with Cash on Delivery copy | create-order + send-email | customer | `order-confirmation/SMF-…` |
| Admin new order | COD placed or prepaid confirmed | create-order / payment routes | `ADMIN_NOTIFY_EMAIL` | `admin-new-order/SMF-…` |
| Admin payment confirmed | Prepaid payment confirmed | payment routes | `ADMIN_NOTIFY_EMAIL` | `admin-payment-confirmed/SMF-…` |
| Shipped | Shiprocket status → dispatched | `/api/shiprocket-sync` | customer | `shipping/SMF-…` |
| Out for delivery | Shiprocket status → out_for_delivery | `/api/shiprocket-sync` | customer | `out-for-delivery/SMF-…` |
| Delivered | Shiprocket status → delivered | `/api/shiprocket-sync` | customer | `delivered/SMF-…` |
| Email failure alert | Any transactional send failure | internal | `ADMIN_NOTIFY_EMAIL` | `email-failure/SMF-…/<type>:<code>` |
| Diagnostic test | Admin-only | `POST /api/admin/test-email` | requested test inbox | `email-system-test/<email>:<minute>` |

Client `SmelloffEmail.send` in `odorstrike.html` remains a **fallback** only. Server dispatch + the Postgres confirmation claim prevent duplicates.

Payment confirmation is persisted **before** email. Email failure never rolls back a captured payment.

## Environment (Vercel Production)

Required:

- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET` / `ADMIN_KEY` (diagnostic endpoint)

Recommended:

- `EMAIL_FROM=ODORSTRIKE <orders@smelloff.in>`
- `EMAIL_REPLY_TO=smelloffsupport@gmail.com`
- `ADMIN_NOTIFY_EMAIL=smelloffsupport@gmail.com`
- `RESEND_WEBHOOK_SECRET` (Svix signing secret from Resend → Webhooks)

Do not set `EMAIL_FROM` to any `@resend.dev` address in production.

## Diagnostics

`POST /api/admin/test-email`

```json
{ "email": "founder@verified-inbox.example" }
```

Header: `Authorization: Bearer <ADMIN_SECRET>` or `X-Admin-Secret`.

Returns Resend email id plus `RESEND_CONFIGURED` / sender / `domainStatus`. Never accepts an API key from the client.

`POST /api/resend-webhook` — Resend delivery events (`email.sent`, `email.delivered`, `email.failed`, `email.bounced`, `email.complained`, `email.delivery_delayed`).

Apply `supabase/migrations/20260915_email_events.sql` so send ledger and webhook events persist.

## DNS observed 2026-09-15 (public DNS, not invented)

Queried via Cloudflare DNS-over-HTTPS. **Do not paste invented DKIM CNAMEs.**

| Record | Observed | Notes |
|---|---|---|
| `smelloff.in` MX | Cloudflare Email Routing (`route1/2.mx.cloudflare.net`) | Inbound mail is Cloudflare, not Resend |
| `smelloff.in` TXT SPF | `v=spf1 include:_spf.mx.cloudflare.net ~all` | **No Resend / Amazon SES include** on the apex |
| `_dmarc.smelloff.in` TXT | `v=DMARC1; p=none; rua=mailto:smelloffsupport@gmail.com; adkim=s; aspf=s` | Strict alignment (`adkim=s aspf=s`). SPF/DKIM must pass for `smelloff.in` |
| `resend._domainkey.smelloff.in` TXT | DKIM TXT present (older 1024-bit style, not a CNAME) | Suggests a historical Resend TXT DKIM install |
| `send.smelloff.in` MX | `10 feedback-smtp.ap-northeast-1.amazonses.com` | Resend bounce/feedback domain (SES) |
| `send.smelloff.in` TXT | Cloudflare `_spfm` include, **not** `amazonses.com` | Bounce-domain SPF does not currently include SES |

Because apex SPF has no Resend/SES include and DMARC is strict, production delivery from `orders@smelloff.in` is **DOMAIN_CONFIGURATION_REQUIRED** until the Resend dashboard shows the domain **Verified** and the records Resend currently displays are the ones in DNS.

## Remaining Resend dashboard steps (owner)

1. Open [Resend → Domains](https://resend.com/domains) for `smelloff.in`.
2. Confirm status is **Verified**. If not, add **exactly** the records Resend shows (DKIM CNAME(s), optional `send` MX/SPF). Do not invent values.
3. If Resend now uses CNAME DKIM (`resend._domainkey` → `….resend.com`) and DNS still has the old TXT, replace the TXT with the CNAME Resend displays.
4. Keep `From` as `ODORSTRIKE <orders@smelloff.in>`. Enable click-tracking only if you accept Resend rewriting links.
5. Add webhook `https://smelloff.in/api/resend-webhook` for sent/delivered/failed/bounced/complained/delivery_delayed. Put the signing secret in Vercel Production as `RESEND_WEBHOOK_SECRET`.
6. Apply the `email_events` migration in the Smelloff Supabase project.
7. Send `POST /api/admin/test-email` to a real inbox you control (not `@example.com` — Resend rejects it).

Cloudflare Email Routing on the apex MX is fine for **inbound** `orders@` / support aliases. It is not a substitute for Resend **outbound** DKIM/SPF.

## Status labels

API accept → `QUEUED`. Webhook `email.sent` → `SENT`. Webhook `email.delivered` → `DELIVERED`. Never mark delivered from the send API response alone.
