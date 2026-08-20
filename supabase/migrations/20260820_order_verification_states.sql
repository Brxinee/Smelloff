-- Migration: 20260820_order_verification_states.sql
--
-- Add explicit manual UPI verification states to the orders table:
--   'verification_pending'  — Customer submitted UTR / reference; pending admin verification
--   'payment_not_verified'  — UTR was checked and could not be verified (mismatch / fraud / unpaid)
--
-- Full status pipeline:
--   placed, upi_pending, verification_pending, confirmed, payment_not_verified,
--   packed, dispatched, out_for_delivery, delivered, cancelled

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'placed'::text,
    'upi_pending'::text,
    'verification_pending'::text,
    'confirmed'::text,
    'payment_not_verified'::text,
    'packed'::text,
    'dispatched'::text,
    'out_for_delivery'::text,
    'delivered'::text,
    'cancelled'::text
  ]));
