# Owner dashboard redesign (/admin), 2026-11-02

Owner: "design the admin better … research what works, what not, then implement:
UI, UX, design, layout, structure and data passing."

## What was wrong with the old one

Measured against the live data (37 orders, 6,194 events, 5,597 page views):

- **The numbers weren't honest.** Revenue, order counts and the "To ship / confirm"
  tile included the owner's own test orders. Most orders in the database are
  tests (see the 2026-11-02 conversion pass in CLAUDE.md), so every KPI was
  inflated, with no comparison to tell good from bad.
- **One status for two questions.** `placed` / `confirmed` / `upi_pending` mix
  "has the money come in?" with "what do I do next?". A COD order and a paid
  order looked the same, so the owner had to remember which needed a call.
- **No work queue.** "Needs action" was one number with no route to the orders
  behind it. Refunds due (paid, then cancelled), shipments stuck in transit and
  unfinished payments worth a WhatsApp were not visible anywhere.
- **No traffic.** The first-party analytics functions (`site_analytics`,
  `site_events`, `site_analytics_segments`) were live in Supabase but the
  dashboard never showed them, nor the checkout-exit answers.
- **Phone use was an afterthought.** An 8-column table at 390px, the nav a
  horizontal scroller, no bottom navigation, a 480px drawer.
- **Data passing.** Every screen refetched up to 1,000 orders; search was a
  server round trip per keystroke; a status edit closed the drawer and reloaded
  the whole list; `failed` and `returned` (allowed by the database) had no label.

## What the research says, and what we did with it

| Finding | Source | Built |
|---|---|---|
| An operational dashboard is a control panel: the first glance should say what to do next; the most important item goes top-left, biggest. | Stephen Few, *Dashboard Design for Real-Time Situation Awareness* (via the Esri "Author effective dashboards" guide); uxstudioteam "Dashboard design" | Home opens with a **work queue**: COD orders to confirm, orders to pack, packed-not-shipped, refunds due, shipments over 7 days, unfinished payments, new messages. Each tile opens the filtered list. "All caught up" when empty. |
| Numbers need context (a target or the previous value) to be actionable. | same | Every KPI shows the change **vs the period before** (Today / 7 / 30 / 90 days), with an arrow + words, not colour alone. |
| Keep it to about seven visual elements; colour only where it carries meaning; avoid red/green-only signals. | same | Five KPIs, one sales chart, one funnel, three small cards. Status badges are dot + label; deltas carry ▲/▼ and screen-reader text. |
| Show payment and fulfilment as separate badges; saved views as tabs with counts; view state in the URL. | Shopify Polaris *Index filters* / order index (`paymentStatus`, `fulfillmentStatus`; tabs All / Unpaid / Open / Closed) | Every order has a **stage** (to confirm → to pack → to ship → in transit → delivered, or unpaid / closed) and a **payment** state (paid, COD due, COD collected, not paid, failed, refund due), computed once in `api/admin.js`. Orders has tabs *To do · Unpaid · In transit · Delivered · Closed · All* with counts; every filter lives in the URL hash. |
| Bulk actions: select all, a contextual action bar that appears only when rows are selected, clear feedback **with undo**. | NN/g, *Bulk Actions: 3 Design Guidelines* | Checkbox column + select-all; a sticky "N selected · Mark as … · Apply" bar appears only with a selection; every status change (single or bulk) toasts with **Undo**. Cancelling asks first. |
| On phones a table should become stacked cards; don't make people scroll on two axes. | UX Movement, *Stacked lists*; ux-patterns-for-developers *Table* | Under 760px each order row restyles into a card (name, amount, place, ID, badges, one next-step button). The page never scrolls sideways (measured at 390px on every screen). Bottom tab bar on phones; the order drawer becomes a full-screen sheet with the main action pinned at the bottom. |
| Tables suit admin lists under ~500 records; above that, page. | ux-patterns-for-developers *Table* | 50 rows, then "Show 50 more". |
| Charts: one series needs no legend; tooltips enhance, never gate (a table view exists); text in text colours; thin marks. | dataviz skill (this repo's tooling) | Sales/visitors bars with a per-bar tooltip built with `textContent`, a "Show as table" view under each chart, brand lime on dark and a validated deep green (`#4D7C0F`, passes the palette checks on the light surface) in light mode. |

## Structure

- **Home**: work queue → KPIs (sales, orders, average order value, visitors,
  visitor → order) → sales chart + checkout funnel → latest orders, where sales
  come from (order attribution channel), how people pay (prepaid vs COD), top
  states. Footnote says what "sales" and "in hand" mean and how many test
  orders were left out.
- **Orders**: tabs, search (ID, name, phone, city, pincode, AWB), payment / date /
  sort filters, a "Test orders (n)" toggle, bulk bar, CSV export. **Order panel**
  (deep-linkable `#orders/SMF-…`): stage + payment badges; Call, WhatsApp with
  ready messages (confirm COD, payment didn't finish, shipped update, ask for a
  review), Email; copy the shipping address as a label; items and money;
  Shiprocket AWB or manual courier/tracking; source; history timeline; the
  one-step-on button pinned at the bottom ("Confirm order", "Mark as packed"…).
- **Customers**: buyers, repeat rate, spent per buyer; groups *Everyone · Buyers ·
  Repeat · Never finished*; customer panel with all their orders.
- **Traffic**: visitors / views / product viewers / purchases with deltas,
  visitors per day, funnel with step rates, sources with sales, top pages, the
  checkout-exit answers, referrers, countries, devices.
- **Messages**, **Reviews** (unchanged rules), **Settings**: which Cloudflare
  secrets are set (from `/api/health`), Razorpay mode, live commit, Sheets sync,
  theme, keyboard shortcuts.

## Data passing

- `dashboard {days}` returns the whole Home screen in **one** call: KPIs for the
  period and the one before, a zero-filled IST series (hourly for Today), the
  queue, channels, states, latest orders and traffic totals + funnel (the
  analytics RPCs run in parallel; if they fail, sales still render).
- `orders` returns every order with `view` (name, place, bottles, stage, payment,
  next status, test flag). The browser keeps one shared copy for Orders,
  Customers and the panels; search and filters run locally (instant). An edit
  merges the row the server returns; nothing refetches the list.
- `bulkUpdateOrders {ids, status}`: up to 100 UUIDs, one PATCH, Sheets sync after.
- `pulse` every 60 s while the tab is visible: newest order + queue counts. A new
  order toasts and refreshes the screen; badges and the tab title show the to-do
  count.
- Screens render from cache first and refresh behind it (stale-while-revalidate);
  a route token drops replies that arrive after the owner has moved on.

## Verified

Rendered at 1280×800 and 390×844, dark and light, against the real
`api/admin.js` with a faked database: no page errors, no sideways scroll on any
screen; Playwright drove login (wrong + right password), period switch, queue
link, advance + undo, search keeping focus, phone search, bulk update, deep
link + reload, WhatsApp templates, Escape, keyboard `g t`, customer → order,
CSV export. `test/admin-dashboard.test.mjs` pins the rules.

## Second pass: add, edit, delete, test

| Need | Research / rule | Built |
|---|---|---|
| Orders come in on WhatsApp and the phone | Shopify's admin "Create order" (draft orders) | **New order** form: contact, address with pincode autofill, bottles stepper, COD / paid online, channel, live price from the same rules as checkout, optional agreed total, optional confirmation email. |
| Mistakes need fixing without breaking the books | Price changes must be deliberate | **Edit** keeps the price unless bottles, payment or pincode change; a notice when Shiprocket already has the old address. |
| Deleting is destructive | NN/g: confirm destructive actions with the object's name; offer undo where possible | Delete only test / cancelled / failed / unpaid orders, after typing the order number; real sales are cancelled, not deleted. Status changes keep Undo. |
| Customers need to hear about changes | — | Per-order email menu and an "Email the customer" option on status changes, using the existing Resend templates. |
| "Does everything work?" without risking real customers | Test in production with markers, never real side effects | **Tools & tests**: read-only live checks, test email, sandboxed email previews, a test order that Shiprocket never books. |
| Reviews | CCPA dark-pattern guidelines, IS 19000:2022 | Delete for spam/duplicates only; no add or edit. |

## Not done (owner's call or needs data)

- Shopify-style saved custom views and per-order notes need a new column.
- Push notifications for new orders (the owner already gets an email per order).
- Real RTO / return rates need courier data beyond Shiprocket's status text.
