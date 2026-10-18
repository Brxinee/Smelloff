# Google Sheets: orders and customer emails

The website copies every order into **Orders data** and every customer and
email signup into **Smelloff Customers & Emails**. It writes from the server
(`api/sheets-sync.js`), straight after a COD order is placed or a prepaid
order is paid, and again every 15 minutes so status, courier and AWB changes
reach the sheet.

| Sheet | Tabs | Written by the website |
|---|---|---|
| [Orders data](https://docs.google.com/spreadsheets/d/1VY0Jkrj0CTjrEmamE2qLpPXF8qcUhNG5ZToWcCn1AKc/edit) | Dashboard, Orders | Orders, columns A–S |
| [Smelloff Customers & Emails](https://docs.google.com/spreadsheets/d/1qe8Y2DY0kKr7jVLCit9F9Xr1L3rMO1CS3ClPAMpTjJc/edit) | Summary, Contacts | Contacts, columns A–N |

Columns you own and the website never writes: **COD call** and **Notes** on
Orders, **Notes** on Contacts. Editing a website column shows a warning; the
next sync puts the database value back.

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
7. Check `https://smelloff.in/api/health`: `configured.sheets` must be `true`.
   Within 15 minutes the sheets update. Errors show in the Worker logs as
   `[sheets-sync]`.

Optional variables: `SHEETS_ORDERS_ID` and `SHEETS_CONTACTS_ID` point the sync
at different spreadsheets (the ID is the long part of the sheet URL).

## Rules the sync follows

- **Matches rows by key**: Order ID on Orders; email (or phone when there is
  no email) on Contacts. New rows go in at the top.
- **Never deletes a row** and never blanks a cell the database has no value
  for. Rows it doesn't know (the old-sheet orders, the April 2026 waitlist)
  stay as they are. The one exception: an exact duplicate key with empty
  owner columns, which only happens when two order events insert at once.
- **Leaves out** test orders (name or address containing "test", `@smelloff.in`
  emails, 9000000xxx numbers) and checkouts from the business WhatsApp number,
  plus their emails on Contacts. /admin still lists them.
- **Stops** if a tab's header row doesn't match (a renamed or moved column),
  so it can't write into the wrong place. Restore the header to fix it.
- **Text stays text**: names, addresses and phones are written as literal
  strings, so customer input can never run as a formula.
- **Email offers** is "Yes" only for people who signed up (newsletter, blog,
  the April waitlist). Buyers who only checked out are "No": send them order
  updates, not offers, unless they opt in (DPDP Act).

## Before this

The browser sent each order to an Apps Script web app with a beacon *and* an
image pixel, so most orders were written twice; prepaid orders paid through
Razorpay were never sent at all; statuses never changed from "NEW"; and the
public URL accepted rows from anyone. The site no longer calls it. Once this
is live, archive that deployment (Extensions → Apps Script → Deploy → Manage
deployments → Archive).
