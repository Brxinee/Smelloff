-- Applied to project tnuqjydmoxczdjnsgpci on 2026-07-11.
--
-- Expand the orders fulfillment pipeline with two intermediate stages so the
-- admin (and the customer Track-Order timeline) can reflect real logistics:
--   placed → confirmed → packed → dispatched → out_for_delivery → delivered
-- plus the existing off-flow states upi_pending and cancelled.
--
-- Non-destructive: existing rows only use placed / upi_pending, both retained.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'placed'::text,
    'upi_pending'::text,
    'confirmed'::text,
    'packed'::text,
    'dispatched'::text,
    'out_for_delivery'::text,
    'delivered'::text,
    'cancelled'::text
  ]));
