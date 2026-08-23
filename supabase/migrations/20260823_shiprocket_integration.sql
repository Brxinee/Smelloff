-- Shiprocket integration state for orders.
-- Keeps Shiprocket identifiers separate from the customer-facing tracking fields.

alter table public.orders
  add column if not exists shiprocket_order_id bigint,
  add column if not exists shiprocket_shipment_id bigint,
  add column if not exists shiprocket_awb text,
  add column if not exists shiprocket_courier text,
  add column if not exists shiprocket_status text,
  add column if not exists shiprocket_synced_at timestamptz,
  add column if not exists shiprocket_error text;

create index if not exists orders_shiprocket_order_id_idx
  on public.orders (shiprocket_order_id)
  where shiprocket_order_id is not null;

create index if not exists orders_shiprocket_awb_idx
  on public.orders (shiprocket_awb)
  where shiprocket_awb is not null;

create index if not exists orders_shiprocket_sync_idx
  on public.orders (shiprocket_synced_at)
  where shiprocket_order_id is not null;
