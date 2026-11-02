# Google Analytics 4: what the site sends, and the settings only you can change

Property: **Smelloff** (`G-S1MJ58PD89`, property 531107131). Updated 2026-11-02.

## Who GA4 counts

- **Only visitors who tap "Accept all"** on the consent bar. Before that, and
  after "Reject non-essential", nothing is sent to Google (the privacy policy
  promises this). GA4 therefore shows *part* of the traffic. To see how big a
  part, the site now logs every answer to the bar in its own database:

  ```sql
  select label, count(*) from events
  where type = 'consent_choice' and created_at > now() - interval '30 days'
  group by 1;
  ```

  The admin dashboard's own analytics (cookieless) still counts everyone.
- **Never your own devices.** Signing in to `/admin` marks that browser as the
  owner's, and from then on it sends nothing to GA4, Meta or the site's own
  analytics. On a phone you don't sign in on, open any page once with
  `?smf_owner=1`. Undo with `?smf_owner=0`.
- **Never bots** (headless browsers, scrapers).
- **Test orders are not revenue.** An order with "test", "key check" or "do
  not ship" in the name or address, or an `@smelloff.in` email, sends no
  `purchase` event.

## Events

| Where | Event | Main parameters |
|---|---|---|
| Every page | `page_view` (automatic) | `content_group`: home, product, blog_index, blog_post, policy, faq, about, contact, reviews, track-order… |
| Every page | `buy_cta_click` | `link_url`, `link_text`, `link_location` (header, menu, footer, end_card, chat, a section id, body) |
| Every page | `whatsapp_click` | `link_location`, `intent` (order / chat) |
| Every page | `ai_referral` | `ai_source` (chatgpt.com, perplexity.ai…) |
| Every page | `chat_open`, `chat_message`, `chat_teaser` | `chat_action` |
| Every page | `chat_feedback` | `rating` (up / down) |
| Every page | `chat_card_click` | `card` (pack:2, guide:slug, whatsapp) |
| Footer, blog | `sign_up` | `method` (newsletter_footer / newsletter_blog) |
| Homepage | `section_view` | `section` (remembers, reviews, odorstrike-featured, founders, how-it-works, faq, final) |
| Homepage | `view_item_list`, `select_item` | list `home_offer`, packs of 1 / 2 / 5 |
| Product page | `view_item` | |
| Product page | `select_item` | list `pdp_packs` |
| Product page | `add_to_cart`, `remove_from_cart` | `cta_location` (pdp_hero, cart, checkout, home_pack…) |
| Product page | `view_cart` | |
| Product page | `pincode_check` | |
| Checkout | `begin_checkout` | `cta_location` |
| Checkout | `add_payment_info` | `payment_type` (prepaid / cod) |
| Checkout | `add_shipping_info` | |
| Checkout | `checkout_error` | `error_message` (form validation) |
| Checkout | `order_error` | `payment_type`, `error_message` |
| Checkout | `payment_window_open`, `payment_cancelled` | `value` |
| Checkout | `payment_failed` | `error_code`, `error_reason`, `error_source`, `error_step` |
| Checkout | `payment_error` | `error_message` (the window couldn't open) |
| Checkout | `checkout_exit` | `reason` (cod, price, unsure, delivery, looking, other, shown, dismissed) |
| Checkout | `purchase` | `transaction_id`, `value` (what the buyer pays), `shipping` (the COD charge), `payment_type`, items |
| Contact | `generate_lead` | `lead_source`, `topic` |
| Track order | `track_order` | `result` (found / not_found), `order_status` |

Items always carry `item_id` OS-001-50ML, `item_name`, `item_brand` Smelloff,
`item_category` Clothing deodorant, `item_variant` 50ml, a per-bottle `price`
(packs make it ₹209.50 or ₹179.80) and `quantity`.

`purchase` fires when the order is saved: for COD when it is placed, for
prepaid when Razorpay confirms the payment. A COD order that is later cancelled
is still counted in GA4 (GA4 gets no refund from the server yet).

## Do this once in GA4 (Admin)

1. **Custom definitions → Create custom dimension** (scope: Event), one for
   each parameter: `cta_location`, `link_location`, `section`, `chat_action`,
   `rating`, `card`, `reason`, `payment_type`, `intent`, `ai_source`,
   `error_message`, `error_code`, `error_reason`, `lead_source`, `result`,
   `order_status`, `method`. Without this, GA4 receives the values but
   reports can't show them. Dimensions only fill in from the day they are
   created.
2. **Events → Key events**: mark `begin_checkout`, `whatsapp_click`,
   `generate_lead` and `sign_up` (`purchase` already is one).
3. **Data streams → web → Configure tag settings → List unwanted referrals**:
   add `razorpay.com`. Otherwise a buyer coming back from a Razorpay page
   starts a new "referral" visit and the order loses its real source.
4. **Data settings → Data retention**: set event data to **14 months** (the
   default is 2, which empties Explorations after two months).
5. **Property settings**: time zone *India (GMT+05:30)*, currency *Indian
   Rupee*.
6. **Product links**: link Search Console, Google Merchant Center and Google
   Ads (when you run ads).
7. **Data streams → web → Enhanced measurement**: keep it on (scrolls,
   outbound clicks, site search on `/blog?q=`).

## Check that it works

Open any page with `?ga_debug=1` (in a browser where you have *not* signed in
to `/admin`, or add `&smf_owner=0`), accept the consent bar, and watch
**Admin → DebugView**. Every event above shows up with its parameters. The
debug flag lasts for that tab only.

## Possible next steps (your call)

- **Consent Mode "advanced"**: GA4 would load before consent and send
  cookieless pings for visitors who decline, and Google would estimate the
  missing visits and conversions. It needs a privacy policy change, since
  today it promises nothing reaches Google without consent.
- **Server-side purchases and refunds** (Measurement Protocol): add a GA4 API
  secret (Admin → Data streams → Measurement Protocol API secrets) and the
  server could send `purchase` for prepaid orders whose tab closed before the
  thank-you screen, plus a `refund` when a COD order is cancelled or returned.
