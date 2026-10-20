-- Where an order came from (2026-10-20).
--
-- Until now an order kept only the checkout page URL (`event_source_url`) and
-- the Meta click cookie (`fbc`). A visitor who landed on /?utm_source=... and
-- then tapped Buy reached checkout on /odorstrike?buy=1, so the campaign was
-- gone, and COD orders didn't send even those two fields.
--
-- The browser now sends its first and latest non-direct visit of the last 30
-- days (utm source/medium/campaign/content/term, the kind of ad click id but
-- never its value, the referrer host, a partner ?ref=, the landing path), and
-- api/_attribution.js adds a `channel` label:
--   { "first": {...} | null, "last": {...} | null, "channel": "Meta ads" }
-- No personal data. Null for orders placed before this column, and for
-- direct visits with no Meta click id.
--
-- Additive and nullable: existing rows and writers are unaffected, and
-- api/create-order.js retries without the field if this hasn't been applied.
alter table public.orders
  add column if not exists attribution jsonb;

comment on column public.orders.attribution is
  'First and latest non-direct visit (utm_*, click id type, referrer host, partner, landing path) plus a channel label, from api/_attribution.js. No personal data.';
