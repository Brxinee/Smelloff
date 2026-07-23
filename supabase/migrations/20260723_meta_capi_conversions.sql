-- Meta Conversions API — server-truth Purchase/Refund + match-quality fields.
--
-- Apply to project tnuqjydmoxczdjnsgpci.
--
-- Non-destructive and additive. It:
--   1) adds the attribution fields the CAPI needs for strong Advanced Matching
--      (fbp/fbc/ip/ua/event_source_url), captured at order time;
--   2) adds a `returned` (RTO) fulfilment state so COD returns can be corrected;
--   3) creates `meta_capi_log` — the request/response log AND the outbox that
--      makes revenue events server-truth (deduped on event_id, so failures are
--      visible instead of silent);
--   4) installs an AFTER UPDATE trigger that enqueues a Purchase when an order
--      is `confirmed` and a Refund when it is `cancelled`/`returned` — origin-
--      agnostic, exactly like the existing orders_track_status trigger.
-- The Vercel drainer (api/meta-capi-drain) sends the queued events.

-- 1) Attribution fields (captured by create-order from the browser + headers).
alter table public.orders add column if not exists fbp text;
alter table public.orders add column if not exists fbc text;
alter table public.orders add column if not exists client_ip text;
alter table public.orders add column if not exists client_ua text;
alter table public.orders add column if not exists event_source_url text;

-- 2) Add the `returned` (RTO) fulfilment state to the pipeline.
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
    'cancelled'::text,
    'returned'::text
  ]));

-- 3) Log + outbox. One row per (event_id, event_name); the unique constraint is
--    what guarantees a duplicate webhook / retried beacon / re-run drain can
--    never produce a second send. Service-role only (RLS on, no policies).
create table if not exists public.meta_capi_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    text not null,
  event_name  text not null,
  order_id    uuid references public.orders(id) on delete set null,
  order_code  text,
  source      text not null default 'server' check (source in ('browser','server')),
  status      text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  attempts    int  not null default 0,
  http_status int,
  request     jsonb,
  response    jsonb,
  sent_at     timestamptz,
  unique (event_id, event_name)
);
create index if not exists meta_capi_log_status_idx on public.meta_capi_log (status, created_at);
create index if not exists meta_capi_log_order_idx  on public.meta_capi_log (order_id);

alter table public.meta_capi_log enable row level security;
-- Intentionally no policies: only the service role (server) may read/write.

-- 4) Enqueue revenue events on fulfilment transitions. Fires no matter how the
--    status changed (admin, edge function, raw SQL). Purchase at `confirmed`
--    (UPI = UTR verified, COD = order accepted); Refund at `cancelled`/`returned`
--    so COD RTOs net out reported ROAS toward real margin.
create or replace function public.orders_meta_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    code := coalesce(new.order_code, new.id::text);
    if (new.status = 'confirmed') then
      insert into public.meta_capi_log (event_id, event_name, order_id, order_code, source, status)
      values ('purchase_' || code, 'Purchase', new.id, new.order_code, 'server', 'pending')
      on conflict (event_id, event_name) do nothing;
    elsif (new.status in ('cancelled', 'returned')) then
      insert into public.meta_capi_log (event_id, event_name, order_id, order_code, source, status)
      values ('refund_' || code, 'Refund', new.id, new.order_code, 'server', 'pending')
      on conflict (event_id, event_name) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_meta_enqueue_trg on public.orders;
create trigger orders_meta_enqueue_trg
  after update on public.orders
  for each row execute function public.orders_meta_enqueue();
