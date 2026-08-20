-- Finalize new-order UPI lifecycle.
-- Historical rows may retain legacy values, but new application transitions must not use them.
-- The application lifecycle is: upi_pending -> confirmed/failed/cancelled.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'placed'::text,
    'upi_pending'::text,
    'confirmed'::text,
    'failed'::text,
    'packed'::text,
    'dispatched'::text,
    'out_for_delivery'::text,
    'delivered'::text,
    'cancelled'::text
  ]));

create index if not exists idx_orders_upi_transaction_ref on public.orders(upi_transaction_ref) where upi_transaction_ref is not null;
create index if not exists idx_orders_payment_attempt_id on public.orders(payment_attempt_id) where payment_attempt_id is not null;
