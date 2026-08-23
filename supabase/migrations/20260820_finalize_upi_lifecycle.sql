-- Migration: 20260820_finalize_upi_lifecycle.sql
--
-- Finalize unified UPI lifecycle supporting both automated verification
-- and customer UTR submission + admin manual payment verification.
--
-- State Machine:
--   placed, upi_pending, verification_pending, confirmed, payment_not_verified,
--   failed, packed, dispatched, out_for_delivery, delivered, cancelled

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'placed'::text,
    'upi_pending'::text,
    'verification_pending'::text,
    'confirmed'::text,
    'payment_not_verified'::text,
    'failed'::text,
    'packed'::text,
    'dispatched'::text,
    'out_for_delivery'::text,
    'delivered'::text,
    'cancelled'::text
  ]));

create index if not exists idx_orders_upi_transaction_ref on public.orders(upi_transaction_ref) where upi_transaction_ref is not null;
create index if not exists idx_orders_payment_attempt_id on public.orders(payment_attempt_id) where payment_attempt_id is not null;

-- Partial unique index on orders.upi_ref to prevent concurrent reuse of UTRs
-- across confirmed or pending verification orders at the database engine level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_upi_ref
ON public.orders (upi_ref)
WHERE upi_ref IS NOT NULL 
  AND upi_ref != '' 
  AND status IN ('confirmed', 'verification_pending', 'packed', 'dispatched', 'out_for_delivery', 'delivered');
