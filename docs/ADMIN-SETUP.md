# ODORSTRIKE — Owner dashboard (/admin)

A private, password-protected dashboard at **https://smelloff.in/admin**
(redesigned 2026-11-02; research and reasoning in
`docs/audits/admin-redesign-2026-11.md`). It works on a phone (bottom tabs,
full-screen order panel) and on a laptop (sidebar, tables), in dark or light.

- **Home** — what needs you now (COD orders to confirm, orders to pack, packed
  but not shipped, refunds due, shipments over 7 days, unfinished payments, new
  messages), then sales, orders, average order value, visitors and visitor →
  order for Today / 7 / 30 / 90 days, each compared with the period before.
  Sales chart, checkout funnel, latest orders, where sales come from, prepaid vs
  COD, top states. **Test and internal orders are left out of every number.**
- **Orders** — tabs (To do · Unpaid · In transit · Delivered · Closed · All),
  instant search, filters, bulk "Mark as …" with Undo, CSV. Each order shows a
  fulfilment stage and a payment state, Call / WhatsApp (ready messages) /
  Email, the address to copy, courier + tracking, source and history, and one
  button that moves it a step on.
- **Customers** — buyers, repeat rate, spend; each customer's orders.
- **Traffic** — first-party visitors, pages, sources, funnel and the
  checkout-exit answers.
- **Messages / Reviews / Settings** — the contact inbox, reviews (verified-buyer
  rule), which Cloudflare secrets are set, Sheets sync, theme, shortcuts.

Nothing extra to host: it ships with the storefront Worker and reads the same
Supabase database.

---

## How it's built

| Piece | What it is |
|---|---|
| `admin/index.html` | The entire dashboard — one self-contained file (inline CSS/JS, brand fonts, hand-rolled SVG charts). Hash-routed SPA. |
| `api/admin.js` | One API handler on the Cloudflare Worker. Password login → signed 12-hour session token; then Supabase CRUD (service-role), computed business stats, first-party site-analytics reports, and an optional GA4 Data API proxy. All server-side — no secrets ever reach the browser. |
| `api/track.js` | The cookieless analytics beacon. Every page on the site posts its path here; the server derives device + country + a daily-rotating **anonymous** visitor hash and stores a row in `page_views`. No cookie, no client storage, no personal data at rest. |
| `config/routing.json` | Marks `/admin` + `/api/admin` `noindex` / `no-store` (compiled to `_headers` at build). |

Security model: the browser only ever holds a short-lived HMAC session token.
The Supabase **service-role key**, the **admin password**, and the **GA4 service
account** live only in Cloudflare Worker secrets and are used only inside the
Worker. The admin API is `noindex`, rate-limited on login, and every
DB write is constrained to a fixed table/column allow-list.

---

## 1. Required secrets (Cloudflare → Workers & Pages → smelloff → Settings → Variables and Secrets (or `npx wrangler secret put NAME`))

Add these as **secrets** on the Worker, then
redeploy.

| Variable | Required | What to put |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | The password you'll type to log in. Pick a long, unique one. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Project Settings → API → **service_role** secret. (Server-only — never expose this publicly.) |
| `SUPABASE_URL` | optional | Defaults to the project URL already baked in. Only set to override. |
| `ADMIN_SESSION_SECRET` | optional | Extra secret for signing sessions. If omitted it's derived from `ADMIN_PASSWORD` (so changing the password logs everyone out). Set it if you want to rotate sessions independently. |
| `GA4_PROPERTY_ID` | optional | Only if you *also* want Google Analytics wired in (see §2b). Not needed — the built-in analytics need no Google. |
| `GA4_SERVICE_ACCOUNT_JSON` | optional | Only for the GA4 option in §2b. |
| `ANALYTICS_SALT` | optional | A random secret used to hash visitor IDs. If unset it's derived from the service-role key — fine to leave unset. |

> `RESEND_API_KEY` is already set for the storefront's transactional email — the
> Settings page just reports whether it's connected.

The dashboard works the moment `ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` are
set — **and that includes analytics** (see §2). Nothing else is required.

---

## 2. Analytics — built in, free, no Google

The **Analytics** tab runs on your own first-party data. Every page on the site
sends a tiny, **cookieless** beacon to `/api/track`; the server stores an
anonymised row in the `page_views` table (created by the
`20260711_first_party_analytics.sql` migration, already applied). The tab then
shows visitors, pageviews, a daily trend, traffic sources, top pages, devices,
countries, and a live "active right now" counter.

**There is nothing to set up.** As soon as `SUPABASE_SERVICE_ROLE_KEY` is in
the Worker (§1), analytics work. No Google account, no service account, no credit
card, no cookie banner needed for it.

**Privacy:** no cookie or browser storage is used, and no personal data is kept.
"Visitors" are counted with a one-way hash of *(day + IP + browser + secret
salt)* that rotates every day and is never reversible to an IP or a person —
the same privacy-first model tools like Plausible use. Bots are filtered out.

### 2b. (Optional) Also wire in Google Analytics

You do **not** need this — it's only if you specifically want GA4's numbers
inside the dashboard too. Note: Google's free "Starter tier" now blocks the
service-account setup below unless you add a payment method, so most people
should just use the built-in analytics above.

1. **Google Cloud Console** → create or pick a project.
2. **APIs & Services → Library** → **"Google Analytics Data API"** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account** →
   name it (e.g. `smelloff-analytics`) → create.
4. The service account → **Keys → Add key → Create new key → JSON** → download.
5. **GA4 → Admin → Property access management** → **+** → add the service
   account email with the **Viewer** role.
6. **GA4 → Admin → Property details** → copy the **numeric property ID**.
7. In the Worker's secrets set `GA4_PROPERTY_ID` (the number) and `GA4_SERVICE_ACCOUNT_JSON`
   (the whole JSON file), then redeploy. The Settings tab will show GA4 as
   connected.

---

## 3. Pointing the `admin.smelloff.in` subdomain at it

The dashboard is **already reachable at `https://smelloff.in/admin`** after
deploy (password-gated), so you can use it before touching DNS. To get the clean
subdomain:

1. Add `{ "pattern": "admin.smelloff.in", "custom_domain": true }` to `routes`
   in `wrangler.jsonc` and deploy — the Worker then owns that host (don't
   hand-make a DNS record for it).
2. Add a Cloudflare Redirect Rule on the zone sending `admin.smelloff.in/` to
   `https://smelloff.in/admin` (host-based rules can't live in `_redirects`).

The main site is unaffected — `www` still redirects to the apex, and the admin
host serves only the dashboard.

---

## 4. Using it day-to-day

- Go to **smelloff.in/admin** and enter the password. Sessions last 12 hours.
- **Start on Home.** The tiles at the top are your to-do list; tap one to see
  those orders. "All caught up" means nothing is waiting.
- **A COD order:** open it → WhatsApp → "Confirm COD order" (asks them to reply
  YES) → when they confirm, tap **Confirm order**. Then **Mark as packed**.
  Shiprocket books the courier on its own within 15 minutes; the courier
  status and AWB appear in the order.
- **A prepaid order** arrives already paid ("To pack").
- **Unpaid tab:** online checkouts that never finished. "Payment didn't finish"
  on WhatsApp sends them back to checkout or offers COD.
- **Several at once:** tick the orders → "Mark as …" → Apply. Every change has
  **Undo** for a few seconds. Cancelling asks first and does not tell the customer.
- **Numbers:** Sales = orders placed in the period minus cancelled, failed and
  unpaid ones. "In hand" = paid online, or COD delivered. Times are IST.
- **Shortcuts (laptop):** `/` search · `g h` Home · `g o` Orders · `g c`
  Customers · `g t` Traffic · `r` refresh · `Esc` close a panel.
- **Exports:** Orders (respects the current tab and filters) and Customers.


### Rotating the password / revoking access
Change the `ADMIN_PASSWORD` Worker secret (it takes effect on the next request). Because sessions are signed from
it (unless you set a separate `ADMIN_SESSION_SECRET`), every existing session is
immediately invalidated.

---

## What it deliberately does **not** do
- It does not expose or store any formula concentrations (per project policy).
- It does not send marketing email — the waitlist is export-only here.
- It never trusts the browser for prices or writes outside the fixed table
  allow-list, so a stolen session token still can't reach arbitrary tables.
