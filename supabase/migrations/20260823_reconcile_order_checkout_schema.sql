-- Reconcile production orders schema with the live checkout/payment/Shiprocket APIs.
-- Safe to re-run: all columns/indexes are guarded.

alter table public.orders
  add column if not exists cod_fee integer not null default 0,
  add column if not exists payment_attempt_id text,
  add column if not exists upi_transaction_ref text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists upi_txn_id text,
  add column if not exists upi_response_code text,
  add column if not exists shiprocket_order_id bigint,
  add column if not exists shiprocket_shipment_id bigint,
  add column if not exists shiprocket_awb text,
  add column if not exists shiprocket_courier text,
  add column if not exists shiprocket_status text,
  add column if not exists shiprocket_synced_at timestamptz,
  add column if not exists shiprocket_error text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'placed','upi_pending','verification_pending','confirmed','payment_not_verified',
    'failed','packed','dispatched','out_for_delivery','delivered','cancelled','returned'
  ]::text[]));

create index if not exists idx_orders_upi_transaction_ref
  on public.orders (upi_transaction_ref) where upi_transaction_ref is not null;

create index if not exists idx_orders_payment_attempt_id
  on public.orders (payment_attempt_id) where payment_attempt_id is not null;

create unique index if not exists idx_orders_unique_active_upi_ref
  on public.orders (upi_ref)
  where upi_ref is not null
    and btrim(upi_ref) <> ''
    and status in ('confirmed','verification_pending','packed','dispatched','out_for_delivery','delivered');

select pg_notify('pgrst','reload schema');
