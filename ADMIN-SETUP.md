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
| `api/admin.js` | One Vercel serverless function. Password login → signed 12-hour session token; then Supabase CRUD (service-role), computed business stats, first-party site-analytics reports, and an optional GA4 Data API proxy. All server-side — no secrets ever reach the browser. |
| `api/track.js` | The cookieless analytics beacon. Every page on the site posts its path here; the server derives device + country + a daily-rotating **anonymous** visitor hash and stores a row in `page_views`. No cookie, no client storage, no personal data at rest. |
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
Vercel (§1), analytics work. No Google account, no service account, no credit
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
7. In Vercel set `GA4_PROPERTY_ID` (the number) and `GA4_SERVICE_ACCOUNT_JSON`
   (the whole JSON file), then redeploy. The Settings tab will show GA4 as
   connected.

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
