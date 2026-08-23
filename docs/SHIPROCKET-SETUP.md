# Shiprocket integration

Smelloff now sends eligible orders into Shiprocket automatically.

## Environment variables

Configure these in the production runtime (for example Vercel Project Settings → Environment Variables). Never put the Shiprocket password in source control.

```text
SHIPROCKET_EMAIL=<Shiprocket API-user email>
SHIPROCKET_PASSWORD=<Shiprocket API-user password>
SHIPROCKET_PICKUP_LOCATION=<exact pickup-location name from Shiprocket>

# Optional package defaults. Override these with your real packed measurements.
SHIPROCKET_ITEM_WEIGHT_KG=0.12
SHIPROCKET_LENGTH_CM=15
SHIPROCKET_BREADTH_CM=10
SHIPROCKET_HEIGHT_CM=6

# Required for the scheduled tracking sync endpoint.
CRON_SECRET=<random long secret>
```

Shiprocket API authentication uses the API-user credentials and returns a bearer token. Shiprocket documents a 10-day token lifetime, so the integration caches the token in-memory and refreshes it early. citehttps://apidocs.shiprocket.in/

## Order flow

- COD order: Smelloff creates the order in Supabase and then creates the matching Shiprocket order.
- UPI order: Smelloff waits for admin payment confirmation, then creates the matching Shiprocket order.
- The source order ID sent to Shiprocket is the Smelloff order code (`SMF-YYYYMMDD-XXXX`).
- Shiprocket order/shipment/AWB/courier state is stored back on `public.orders`.
- `POST /api/shiprocket-sync` can manually sync a single order from Shiprocket.
- `GET /api/shiprocket-sync` is reserved for the scheduled job and requires `Authorization: Bearer <CRON_SECRET>`.

The integration intentionally does **not** auto-assign a courier or request pickup. Creating the Shiprocket order is safe; actual courier assignment/pickup remains an operational shipping decision in Shiprocket. Shiprocket exposes separate APIs for AWB assignment and pickup requests. citehttps://apidocs.shiprocket.in/

## Database

Apply `supabase/migrations/20260823_shiprocket_integration.sql` before deploying the code.

## Tracking

Once Shiprocket has an AWB, the sync endpoint imports the AWB, courier and shipment status into Smelloff. The existing customer Track Order API already exposes `tracking_id`, `courier`, and `tracking_url`, so customers can see the logistics state without exposing their full delivery address. Shiprocket's tracking API supports lookup by AWB. citehttps://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/mwbf7qq/get-tracking-through-awb
