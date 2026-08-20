-- Migration: 20260820_direct_upi_transactions.sql
--
-- Adds direct UPI transaction tracking and verification fields to public.orders.
-- Supports automated UPI Intent, dynamic QR, payment attempt references,
-- and instant automated payment verification without manual UTR submission.

alter table public.orders
  add column if not exists payment_attempt_id text,
  add column if not exists upi_transaction_ref text,
  add column if not exists upi_txn_id text,
  add column if not exists upi_response_code text,
  add column if not exists upi_status text,
  add column if not exists payment_verified_at timestamptz;

-- Update status check constraint to support automated UPI lifecycle
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

-- Create index on transaction reference and attempt ID for high-speed status lookups
create index if not exists idx_orders_upi_txn_ref on public.orders(upi_transaction_ref) where upi_transaction_ref is not null;
create index if not exists idx_orders_payment_attempt on public.orders(payment_attempt_id) where payment_attempt_id is not null;
