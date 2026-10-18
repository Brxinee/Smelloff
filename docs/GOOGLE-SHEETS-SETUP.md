# Google Sheets: orders and customer emails

The website copies every order into **Orders data** and every customer and
email signup into **Smelloff Customers & Emails**. It writes from the server
(`api/sheets-sync.js`):

- straight after a COD order is placed or a prepaid order is paid,
- straight after you change an order in /admin,
- every 15 minutes (after the Shiprocket sync), so courier status, AWB and
  delivery dates reach the sheet,
- when you press **Sync now** on the /admin Overview.

Each run writes a "Last synced by the website: …" line at the top of the
Dashboard and the Summary tab, so you can see it is alive.

| Sheet | Tabs | Written by the website |
|---|---|---|
| [Orders data](https://docs.google.com/spreadsheets/d/1VY0Jkrj0CTjrEmamE2qLpPXF8qcUhNG5ZToWcCn1AKc/edit) | Dashboard, Orders | Orders A–Z, Dashboard A2 |
| [Smelloff Customers & Emails](https://docs.google.com/spreadsheets/d/1qe8Y2DY0kKr7jVLCit9F9Xr1L3rMO1CS3ClPAMpTjJc/edit) | Summary, Contacts | Contacts A–N, Summary A2 |

Yours, never written by the website: **COD call** and **Notes** on Orders,
**Notes** on Contacts, and **Bottles received** on the Dashboard. Editing a
website column shows a warning; the next sync puts the database value back
when it changes.

## What's in them

**Orders** (newest first): date, ID, status, COD/prepaid, name, phone,
**WhatsApp** (a new COD order gets "Confirm COD", which opens WhatsApp with a
confirmation message holding the order number, amount and city), email,
bottles, subtotal / COD fee / total, address, courier, AWB, **Track** link,
Shiprocket's **courier status**, shipped and delivered dates, refund, review
stars, **source** (utm_source, partner ref or Meta ad), last update.
Colours: amber needs shipping, orange date waiting more than 2 days, red
courier status means a courier problem, blue on the way, green delivered,
grey not a sale, yellow COD call waiting.

**Dashboard**: a period picker (all time, this month, last month, last 7 or
30 days, this year); needs-action counts (to ship, waiting > 2 days, COD to
confirm, courier problems, delivered with no review); sales for the period
(orders, bottles, value, average order, COD share, checkout completion rate,
customers, days to deliver, average review); stock; last 12 months with a
chart; orders by state and by source; a review-request list; the to-ship
queue. Every formula reads whole columns (`Orders!C:C`), because new orders
are inserted at row 2 and a range starting at row 2 would shift past them.

**Contacts**: one row per person (email, or phone when there is no email):
name, phone, WhatsApp, city, state, type (Customer / Tried to order /
Subscriber / Enquiry), paid orders, bottles, order value, last order and its
status, **Email offers** (Yes only after a signup), first seen, source.
**Summary**: counts, a copy-ready offer email list, top customers, and a
follow-up list of people who started an order and didn't finish.

## One-time setup (about 10 minutes)

The Worker signs in to Google as a *service account*: a robot Google account
that can edit only the sheets you share with it.

1. Open <https://console.cloud.google.com/>, signed in as xbrainee@gmail.com.
   Create a project (any name, e.g. "smelloff-sheets").
2. **APIs & Services → Library** → search "Google Sheets API" → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**. Name it
   `smelloff-sheets`. Skip the optional role and user steps → **Done**.
4. Open the new account → **Keys → Add key → Create new key → JSON**. A
   `.json` file downloads. Keep it private; it is a password.
5. Copy the account's email (`smelloff-sheets@<project>.iam.gserviceaccount.com`).
   In each of the two sheets: **Share** → paste that email → **Editor** →
   untick "Notify people" → **Share**.
6. Cloudflare → Workers & Pages → smelloff → Settings → Variables and
   Secrets → **Add** → type **Secret**, name `GOOGLE_SERVICE_ACCOUNT_JSON`,
   value: the whole contents of the `.json` file. Save and deploy.
   (Or `npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON < key.json`.)
7. Open `/admin` → Overview → **Sync now**. It reports what it wrote, or the
   exact error (for example a sheet that isn't shared yet).
   `https://smelloff.in/api/health` also shows `configured.sheets: true`.

Optional variables: `SHEETS_ORDERS_ID` and `SHEETS_CONTACTS_ID` point the sync
at different spreadsheets (the ID is the long part of the sheet URL).

## Rules the sync follows

- **Matches rows by key**: Order ID on Orders; email (or phone when there is
  no email) on Contacts. New rows go in at the top and copy formats and
  dropdowns from the tab's last row, so keep that row empty.
- **Writes only cells whose value changed.** It never deletes a row and never
  blanks a cell the database has no value for. Rows it doesn't know (the
  old-sheet orders, the April 2026 waitlist) stay as they are. The one
  exception: an exact duplicate key with empty owner columns, which only
  happens when two order events insert at once.
- **Leaves out** test orders (name or address containing "test", `@smelloff.in`
  emails, 9000000xxx numbers) and checkouts from the business WhatsApp number,
  plus their emails on Contacts. /admin still lists them.
- **Stops** if a tab's header row doesn't match (a renamed or moved column),
  so it can't write into the wrong place. Restore the header to fix it.
- **Text stays text**: names, addresses and phones are written as literal
  strings, so customer input can never run as a formula. The only formulas it
  writes are the WhatsApp and Track links it builds itself from digits,
  `encodeURIComponent` output or a vetted https URL.
- **Email offers** is "Yes" only for people who signed up (newsletter, blog,
  the April waitlist) and is never switched back to "No". Buyers who only
  checked out are "No": send them order updates, not offers, unless they opt
  in (DPDP Act).

## Changing a column

`ORDER_COLUMNS` / `CONTACT_COLUMNS` in `api/sheets-sync.js` must match the
sheet's header row exactly. To add a column: insert it in the sheet (Insert
column keeps the colours and dropdowns lined up), type the header, add the
same entry to the list in the same position, and return its value from
`orderRow` / `buildContactRows`. Dashboard formulas that use letters after
the new column shift by themselves.

## Before this

The browser sent each order to an Apps Script web app with a beacon *and* an
image pixel, so most orders were written twice; prepaid orders paid through
Razorpay were never sent at all; statuses never changed from "NEW"; and the
public URL accepted rows from anyone. The site no longer calls it. Once this
is live, archive that deployment (Extensions → Apps Script → Deploy → Manage
deployments → Archive). The old tabs (Old orders log, Inventory, Expenses,
Ad Spend, Returns, Waitlist) are hidden in Orders data; delete them whenever
you like.
