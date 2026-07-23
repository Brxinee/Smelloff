# Meta Pixel + Conversions API — setup & verification

How the tracking works after the Phase 2–6 rebuild, how to turn it on, and how
to verify it. Read `docs/META-PIXEL-CAPI-AUDIT.md` first for the *why*.

## Architecture in one picture

```
Browser (odorstrike.html, consent-gated)
  PageView · ViewContent · AddToCart · InitiateCheckout · AddPaymentInfo
  Lead  ── on order PLACED (intent; COD or unpaid UPI)
     │  each event: Pixel + /api/meta-capi mirror, shared event_id
     ▼
create-order Edge Function  ── stores fbp/fbc/ip/ua/url on the order row
     ▼
orders.status changes (admin / edge fn / SQL)
     │  DB trigger orders_meta_enqueue writes a PENDING row to meta_capi_log:
     │    → 'confirmed'            ⇒ Purchase
     │    → 'cancelled'/'returned' ⇒ Refund   (COD RTO correction)
     ▼
Vercel Cron → /api/meta-capi-drain  ── sends Purchase/Refund to Meta with full
     Advanced Matching, logs response, idempotent on (event_id,event_name)
```

**Purchase is server-truth.** It never fires from the browser at placement, so
unpaid UPI orders and COD parcels that later RTO are not reported as sales. The
browser's placement signal is `Lead`.

## Deploy order (important)

1. **Apply the migration first:** `supabase/migrations/20260723_meta_capi_conversions.sql`
   (adds attribution columns, the `returned` status, `meta_capi_log`, and the
   enqueue trigger). The site keeps working without it — `create-order`'s
   attribution write is best-effort and the browser stays on `Lead` — but the
   server-side Purchase/Refund need it.
2. Deploy the Edge Function: `supabase functions deploy create-order`.
3. Deploy the site (Vercel) — ships the new `api/*` functions, the cron, and the
   `odorstrike.html` changes.

## Environment variables (Vercel)

| Var | Required | Purpose |
|---|---|---|
| `META_CAPI_TOKEN` | to activate | System-user token with `ads_management`. Until set, all CAPI is inert (204 / no-op). |
| `SUPABASE_SERVICE_ROLE_KEY` | for server-truth | Lets the drainer + logger read orders and write `meta_capi_log`. Already set for `/api/track`. |
| `META_PIXEL_ID` | optional | Defaults to `1455100092891684`. |
| `META_API_VERSION` | optional | Defaults to `v21.0`. |
| `META_TEST_EVENT_CODE` | during testing | Routes events to Events Manager → Test Events. **Remove for live traffic.** |
| `CRON_SECRET` | recommended | Bearer secret guarding `/api/meta-capi-drain`. Vercel Cron sends it automatically. |
| `META_DPO` / `META_DPO_COUNTRY` / `META_DPO_STATE` | optional | Limited Data Use flag. Leave unset for India (consent gate already governs). |

Never put the token in client code. It lives only in Vercel env.

## Consent / DPDP

The Pixel and every CAPI mirror are gated on `smelloff_consent_v1 === 'accepted'`
(`typeof fbq === 'undefined'` ⇒ no CAPI beacon). First-party analytics
(`/api/track`) is unaffected — it stores no PII and needs no consent. GA4 is
untouched. Optionally set `META_DPO=LDU` to attach Limited Data Use.

## Verification (Phase 6 — needs Events Manager + a live deploy)

Set `META_TEST_EVENT_CODE` and open Events Manager → **Test Events**.

1. **Dedup:** load `/odorstrike`, scroll to buy, add to cart, open checkout,
   pick a pay method. Each event should appear **once** with both *Browser* and
   *Server* badges sharing an `event_id` (not two separate rows).
2. **Lead vs Purchase:** place a COD order. You should see `Lead` (browser+server)
   — **not** `Purchase`. Then, in the admin, advance the order to `confirmed`:
   within the hour (cron) a server `Purchase` with `event_id = purchase_<code>`
   appears. Cancel or mark `returned`: a server `Refund` appears.
3. **Event Match Quality:** open the `Purchase` event → check its EMQ score.
   With email+phone+name+city+state+zip+country+fbp+fbc+ip+ua it should land in
   the good range. A low score means a field isn't arriving — check the order row.
4. **Log:** `select event_name, status, http_status, event_id from meta_capi_log
   order by created_at desc limit 20;` — every send is recorded; failures show
   `status='failed'` with the Meta response instead of failing silently.
5. Run one test order on **each** path (UPI-pending and COD) and confirm the log
   + Test Events match the expectations above. Then remove `META_TEST_EVENT_CODE`.

## Manual drain (optional)

`curl -H "Authorization: Bearer $CRON_SECRET" https://smelloff.in/api/meta-capi-drain`
— processes pending rows immediately instead of waiting for the hourly cron.
Meta accepts events up to 7 days old, so the cron cadence never loses attribution.
