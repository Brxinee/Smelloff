# Customer accounts — setup

Phone-OTP login for shoppers: order history, live tracking, pre-dispatch
cancellation, saved address. Checkout is account-gated — every order is tied to
a verified mobile number.

**The code is deployed-ready but the feature is OFF until you complete steps 1–3
below.** Until then `/account` shows "Phone sign-in isn't switched on yet" and
checkout cannot complete. Do these three before merging to production.

---

## What ships in the repo

| Piece | Where |
|---|---|
| Session client (phone OTP, token refresh, authenticated calls) | `assets/js/auth.js` |
| Account page (orders, tracking timeline, cancel, profile) | `account.html` → `/account` |
| Login gate + prefill inside checkout | `odorstrike.html` |
| Order write, now requiring a verified session | `supabase/functions/create-order/` |
| Self-serve cancellation | `supabase/functions/cancel-order/` |
| SMS delivery via an Indian provider | `supabase/functions/send-sms-hook/` |
| Schema, RLS, auto-linking triggers | `supabase/migrations/20260724_customer_accounts.sql` |

No CDN dependency anywhere — the site's CSP is `script-src 'self'`, so
`auth.js` talks to the Supabase REST endpoints directly instead of loading
`supabase-js`.

---

## 1. DLT registration (India — mandatory, do this first)

TRAI requires every commercial SMS sender to register on DLT. This is
independent of which provider you pick and is the long pole — approval takes
1–3 working days.

1. Register as a **Principal Entity** on any operator's DLT portal (Jio, Airtel,
   Vodafone, BSNL — one registration propagates to all).
   - Entity name **must match your PAN exactly** or it gets rejected.
   - KYC document: for a sole proprietorship use the **Shops & Establishment
     Registration certificate**; Pvt Ltd/LLP use the Certificate of
     Incorporation. If you have an active GSTIN, use the "GST as KYC" toggle —
     it's one-click and skips the upload.
2. Register a **Header** (sender ID) — 6 characters, e.g. `SMLOFF`.
3. Register a **Content Template**, category *Service Implicit* / OTP, with a
   single variable:

   ```
   {#var#} is your Smelloff verification code. Do not share it with anyone.
   ```

   Keep your Entity ID, Header and Template ID — the provider needs all three.

## 2. SMS provider

Supabase's built-in phone providers bill through Twilio at roughly ₹3/SMS to
India. The `send-sms-hook` function exists so OTPs go through an Indian provider
at ₹0.12–0.25 instead. Pick one, then set `SMS_PROVIDER` accordingly:

| `SMS_PROVIDER` | Provider | Secrets required |
|---|---|---|
| `msg91` (default) | MSG91 | `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` |
| `2factor` | 2Factor.in | `TWOFACTOR_API_KEY`, `TWOFACTOR_TEMPLATE` |
| `fast2sms` | Fast2SMS | `FAST2SMS_API_KEY`, `FAST2SMS_MESSAGE_ID`, `FAST2SMS_SENDER_ID` |

Give the provider your DLT Entity ID, Header and Template ID during onboarding —
they will not deliver without them.

Deploy the hook:

```bash
supabase functions deploy send-sms-hook --no-verify-jwt
```

`--no-verify-jwt` is required: Auth calls this endpoint with a webhook
signature, not a user JWT. The function verifies that signature itself and
refuses every unsigned request, so it is not an open SMS relay.

## 3. Supabase configuration

**a) Apply the migration.** Either `supabase db push`, or paste
`supabase/migrations/20260724_customer_accounts.sql` into the SQL editor.

**b) Enable phone auth.** Dashboard → Authentication → Providers → **Phone** →
enable. (Verify with
`curl https://<project>.supabase.co/auth/v1/settings -H 'apikey: <anon key>'` —
`"phone"` must read `true`.)

**c) Point OTP delivery at the hook.** Dashboard → Authentication → Hooks →
**Send SMS hook** → enable, target `send-sms-hook`. Copy the generated
`v1,whsec_…` secret into the `SEND_SMS_HOOK_SECRET` edge-function secret.

**d) Redeploy the order functions**, which now require a session:

```bash
supabase functions deploy create-order
supabase functions deploy cancel-order
```

**e) Settings worth setting** (Authentication → Providers → Phone):
- OTP expiry: 600s (10 min) — the default 3600s is far too generous for SMS.
- OTP length: 6.
- Leave "Enable phone confirmations" ON. Never enable phone autoconfirm.

---

## How identity works

Orders have always been keyed on `customer_phone` (10 local digits, NOT NULL)
while `customer_email` is optional — so phone, not email, is the identity.

- `create-order` reads the phone from the **verified JWT claim** and ignores
  whatever the browser sent. An order cannot be filed against someone else's
  number.
- `orders.user_id` is stamped at checkout. RLS lets a customer read their own
  orders by `user_id`, plus a fallback for an *unclaimed* order whose
  `customer_phone` matches their verified number.
- Signing up claims any pre-existing orders on that number
  (`handle_new_customer` trigger), so orders placed before accounts existed
  appear on first login.
- Customers hold **SELECT only**. Cancellation goes through the service-role
  `cancel-order` function so the pre-dispatch rule can't be bypassed with a
  crafted PostgREST request.

## Cancellation window

Cancellable while status is `placed`, `upi_pending`, `confirmed` or `packed` —
i.e. any time before the parcel reaches the courier. Once `dispatched`, the API
returns 422 and the button is hidden. The update is conditional on the status
*still* being cancellable, so a cancel racing an admin dispatch loses safely.

`cancelled_at` is stamped by the `orders_track_status` trigger, so admin
cancellations get the same timestamp treatment as customer ones.

**UPI refunds remain manual** — nothing in this feature moves money. A cancelled
UPI order tells the customer to expect a manual refund in 5–7 business days and
surfaces `refund_due: true` from the API.

## Testing before you have DLT approval

Add a test number under Authentication → Providers → Phone → **Test OTP**
(e.g. `919999999999` → `123456`). Supabase returns that fixed code without
sending an SMS, which exercises the whole flow — login, order, cancel — with no
provider and no DLT. Remove test numbers before launch.

## Costs

- SMS: ~₹0.15 per login at MSG91 rates. One OTP per new device/session, and the
  session refreshes silently for as long as the customer keeps using the site.
- The 45-second resend cooldown in the UI exists to stop a customer burning
  credits by tapping "resend"; Supabase's own rate limits sit behind it.
