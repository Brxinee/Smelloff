# ODORSTRIKE — Admin Dashboard ("Mission Control")

A private, password-protected admin site for **admin.smelloff.in**. It gives you
one place to see and edit *everything* about the store:

- **Overview** — 30-day revenue & orders (with vs-prior-period deltas), AOV,
  order-status and payment-method breakdowns, top cities, "needs attention"
  counter, and the latest orders.
- **Orders** — full search/filter table, CSV export, and a click-to-edit panel
  for every order: change status, add courier + tracking, fix the address,
  adjust the amount, or create/delete an order.
- **Analytics** — Google Analytics 4 built straight into the dashboard (users,
  sessions, pageviews time-series, live "active now", channels, devices, top
  pages, top cities) — no more logging into GA separately.
- **Reviews / Messages / Comments / Waitlist** — moderate reviews, reply to and
  triage contact messages, approve/hide/delete blog comments, export the email
  waitlist.
- **Settings** — connection status for every integration and session controls.

It reuses the existing site infrastructure — same Vercel project, same Supabase
database, same brand design — so there is **nothing new to host and no second
repo to maintain.**

---

## How it's built

| Piece | What it is |
|---|---|
| `admin/index.html` | The entire dashboard — one self-contained file (inline CSS/JS, brand fonts, hand-rolled SVG charts). Hash-routed SPA. |
| `api/admin.js` | One Vercel serverless function. Password login → signed 12-hour session token; then Supabase CRUD (service-role), computed business stats, and a GA4 Data API proxy. All server-side — no secrets ever reach the browser. |
| `vercel.json` | Rewrites `admin.smelloff.in/` → the dashboard, and marks `/admin` + `/api/admin` `noindex` / `no-store`. |

Security model: the browser only ever holds a short-lived HMAC session token.
The Supabase **service-role key**, the **admin password**, and the **GA4 service
account** live only in Vercel environment variables and are used only inside the
serverless function. The admin API is `noindex`, rate-limited on login, and every
DB write is constrained to a fixed table/column allow-list.

---

## 1. Required environment variables (Vercel → Settings → Environment Variables)

Add these to the **Production** (and Preview, if you want) environment, then
redeploy.

| Variable | Required | What to put |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | The password you'll type to log in. Pick a long, unique one. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Project Settings → API → **service_role** secret. (Server-only — never expose this publicly.) |
| `SUPABASE_URL` | optional | Defaults to the project URL already baked in. Only set to override. |
| `ADMIN_SESSION_SECRET` | optional | Extra secret for signing sessions. If omitted it's derived from `ADMIN_PASSWORD` (so changing the password logs everyone out). Set it if you want to rotate sessions independently. |
| `GA4_PROPERTY_ID` | for Analytics | Your GA4 **numeric** property ID (see step 2). |
| `GA4_SERVICE_ACCOUNT_JSON` | for Analytics | The full JSON key file contents for a Google service account (see step 2). |

> `RESEND_API_KEY` is already set for the storefront's transactional email — the
> Settings page just reports whether it's connected.

The dashboard works the moment `ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` are
set. GA4 is optional and can be added later — until then the Analytics tab shows
the setup instructions instead of erroring.

---

## 2. Connecting Google Analytics 4 (optional but recommended)

This lets the dashboard pull GA4 numbers directly, so you get a cleaner report
than the GA web UI without leaving Mission Control.

1. **Google Cloud Console** → create or pick a project.
2. **APIs & Services → Library** → search **"Google Analytics Data API"** →
   **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Give it a name (e.g. `smelloff-analytics`), create it.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. Keep it safe.
5. **GA4 → Admin → Property access management** (the property for
   `G-S1MJ58PD89`) → **+** → add the service account's email (looks like
   `smelloff-analytics@your-project.iam.gserviceaccount.com`) with the
   **Viewer** role.
6. Find your **numeric property ID**: GA4 → Admin → **Property details** → the
   number near the top (e.g. `398765432`). This is *not* the `G-XXXX`
   measurement ID.
7. In Vercel, set:
   - `GA4_PROPERTY_ID` = that number.
   - `GA4_SERVICE_ACCOUNT_JSON` = paste the **entire contents** of the JSON key
     file (Vercel accepts multi-line values).
8. **Redeploy.** Open the Analytics tab — data should appear.

Nothing about GA4 is stored in the repo; the service account only has read-only
access to your analytics.

---

## 3. Pointing the `admin.smelloff.in` subdomain at it

The dashboard is **already reachable at `https://smelloff.in/admin`** after
deploy (password-gated), so you can use it before touching DNS. To get the clean
subdomain:

1. **Vercel → Project → Settings → Domains → Add** → enter `admin.smelloff.in`.
2. Vercel shows a DNS record to add. In your DNS provider add a **CNAME**:
   - Name/host: `admin`
   - Value: `cname.vercel-dns.com` (use whatever Vercel shows you).
3. Wait for it to verify. `vercel.json` already rewrites `admin.smelloff.in/` to
   the dashboard, so once the domain is live, visiting the subdomain shows the
   login screen.

The main site is unaffected — `www` still redirects to the apex, and the admin
host serves only the dashboard.

---

## 4. Using it day-to-day

- Go to **admin.smelloff.in** (or **smelloff.in/admin**), enter the password.
  Sessions last 12 hours per device.
- **Fulfilling an order:** Orders tab → click the order → set status to
  `dispatched`, fill in **Courier** + **Tracking ID** (and optional tracking
  URL) → Save. The customer's Track-Order page reads these same fields.
- **Verifying a UPI payment:** the Overview "needs attention" tile and the
  Orders badge count `upi_pending` orders. Open one, confirm the UPI ref, set
  status to `confirmed`.
- **Revenue** counts orders in `placed / confirmed / dispatched / delivered`;
  `cancelled` and `upi_pending` are excluded.
- **Exports:** Orders and Waitlist both have CSV export (respects current
  filters on Orders).

### Rotating the password / revoking access
Change `ADMIN_PASSWORD` in Vercel and redeploy. Because sessions are signed from
it (unless you set a separate `ADMIN_SESSION_SECRET`), every existing session is
immediately invalidated.

---

## What it deliberately does **not** do
- It does not expose or store any formula concentrations (per project policy).
- It does not send marketing email — the waitlist is export-only here.
- It never trusts the browser for prices or writes outside the fixed table
  allow-list, so a stolen session token still can't reach arbitrary tables.
