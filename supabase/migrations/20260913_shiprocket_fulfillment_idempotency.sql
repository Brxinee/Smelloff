-- Migration: Shiprocket fulfillment distributed idempotency and atomic claiming
-- Prevents duplicate external Shiprocket order creation under concurrency,
-- multi-cron runner executions, and admin-cron race conditions.

alter table public.orders
  add column if not exists shiprocket_claimed_at timestamptz,
  add column if not exists shiprocket_claim_id text;

create index if not exists orders_shiprocket_claim_idx
  on public.orders (shiprocket_claimed_at)
  where shiprocket_claimed_at is not null;

-- Atomic claim function: guarantees at most one worker claims the right to create an external Shiprocket shipment
create or replace function public.claim_shiprocket_fulfillment(
  p_order_code text,
  p_claim_id text,
  p_stale_seconds integer default 120
)
returns table (
  claimed boolean,
  already_created boolean,
  current_claim_id text,
  order_status text,
  existing_shiprocket_order_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_shiprocket_order_id bigint;
  v_claimed_at timestamptz;
  v_current_claim text;
  v_now timestamptz := clock_timestamp();
  v_stale_threshold timestamptz := v_now - (greatest(10, coalesce(p_stale_seconds, 120)) || ' seconds')::interval;
begin
  -- Lock row for update to ensure atomic decision
  select status, shiprocket_order_id, shiprocket_claimed_at, shiprocket_claim_id
  into v_status, v_shiprocket_order_id, v_claimed_at, v_current_claim
  from public.orders
  where order_code = p_order_code
  for update;

  if not found then
    return query select false, false, null::text, null::text, null::bigint;
    return;
  end if;

  -- If Shiprocket order ID is already assigned, fulfillment already exists
  if v_shiprocket_order_id is not null then
    return query select false, true, v_current_claim, v_status, v_shiprocket_order_id;
    return;
  end if;

  -- Eligibility check: only confirmed, packed, dispatched, out_for_delivery, delivered (or placed for COD)
  if v_status not in ('placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered') then
    return query select false, false, v_current_claim, v_status, null::bigint;
    return;
  end if;

  -- If currently claimed by another active worker and not stale, do not duplicate
  if v_claimed_at is not null and v_claimed_at > v_stale_threshold and v_current_claim is distinct from p_claim_id then
    return query select false, false, v_current_claim, v_status, null::bigint;
    return;
  end if;

  -- Atomically claim
  update public.orders
  set shiprocket_claimed_at = v_now,
      shiprocket_claim_id = p_claim_id
  where order_code = p_order_code;

  return query select true, false, p_claim_id, v_status, null::bigint;
end;
$$;

-- Finalize function: permanently record successful Shiprocket order creation and release claim
create or replace function public.finalize_shiprocket_fulfillment(
  p_order_code text,
  p_claim_id text,
  p_shiprocket_order_id bigint,
  p_shiprocket_shipment_id bigint default null,
  p_shiprocket_awb text default null,
  p_shiprocket_courier text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set shiprocket_order_id = p_shiprocket_order_id,
      shiprocket_shipment_id = p_shiprocket_shipment_id,
      shiprocket_awb = p_shiprocket_awb,
      shiprocket_courier = p_shiprocket_courier,
      shiprocket_status = 'ORDER_CREATED',
      shiprocket_synced_at = clock_timestamp(),
      shiprocket_claimed_at = null,
      shiprocket_claim_id = null,
      shiprocket_error = null
  where order_code = p_order_code
    and (shiprocket_claim_id = p_claim_id or shiprocket_order_id is null);

  return found;
end;
$$;

-- Release function: reset claim on external provider error so subsequent retries or sync passes can proceed
create or replace function public.release_shiprocket_fulfillment_claim(
  p_order_code text,
  p_claim_id text,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set shiprocket_claimed_at = null,
      shiprocket_claim_id = null,
      shiprocket_error = case when p_error_message is not null then left(p_error_message, 1000) else shiprocket_error end,
      shiprocket_synced_at = clock_timestamp()
  where order_code = p_order_code
    and shiprocket_claim_id = p_claim_id;

  return found;
end;
$$;
