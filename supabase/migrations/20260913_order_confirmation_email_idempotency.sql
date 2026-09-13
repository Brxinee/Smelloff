-- Migration: Order confirmation email distributed idempotency and atomic claiming
-- Prevents duplicate confirmation emails under concurrency, multi-instance serverless deployments,
-- and race conditions, while supporting safe stale-claim recovery if a worker crashes.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_claimed_at timestamptz,
  add column if not exists confirmation_email_claim_id text;

create index if not exists orders_confirmation_email_sent_idx
  on public.orders (confirmation_email_sent_at)
  where confirmation_email_sent_at is not null;

create index if not exists orders_confirmation_email_claim_idx
  on public.orders (confirmation_email_claimed_at)
  where confirmation_email_claimed_at is not null;

-- Atomic claim function: guarantees at most one worker claims the right to send an order confirmation email
create or replace function public.claim_order_confirmation_email(
  p_order_code text,
  p_claim_id text,
  p_stale_seconds integer default 90
)
returns table (
  claimed boolean,
  already_sent boolean,
  current_claim_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent_at timestamptz;
  v_claimed_at timestamptz;
  v_current_claim text;
  v_now timestamptz := clock_timestamp();
  v_stale_threshold timestamptz := v_now - (greatest(10, coalesce(p_stale_seconds, 90)) || ' seconds')::interval;
begin
  -- Lock row for update
  select confirmation_email_sent_at, confirmation_email_claimed_at, confirmation_email_claim_id
  into v_sent_at, v_claimed_at, v_current_claim
  from public.orders
  where order_code = p_order_code
  for update;

  if not found then
    return query select false, false, null::text;
    return;
  end if;

  if v_sent_at is not null then
    return query select false, true, v_current_claim;
    return;
  end if;

  -- If currently claimed and not stale, another worker is actively sending
  if v_claimed_at is not null and v_claimed_at > v_stale_threshold then
    return query select false, false, v_current_claim;
    return;
  end if;

  -- Atomically claim
  update public.orders
  set confirmation_email_claimed_at = v_now,
      confirmation_email_claim_id = p_claim_id
  where order_code = p_order_code;

  return query select true, false, p_claim_id;
end;
$$;

-- Finalize function: permanently record successful send
create or replace function public.finalize_order_confirmation_email(
  p_order_code text,
  p_claim_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set confirmation_email_sent_at = clock_timestamp(),
      confirmation_email_claim_id = null
  where order_code = p_order_code
    and confirmation_email_claim_id = p_claim_id;

  return found;
end;
$$;

-- Release function: reset claim on provider error so immediate retries succeed
create or replace function public.release_order_confirmation_claim(
  p_order_code text,
  p_claim_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set confirmation_email_claimed_at = null,
      confirmation_email_claim_id = null
  where order_code = p_order_code
    and confirmation_email_claim_id = p_claim_id
    and confirmation_email_sent_at is null;

  return found;
end;
$$;

-- Only service role can execute these RPCs; revoke from public/anon/authenticated
revoke all on function public.claim_order_confirmation_email(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_order_confirmation_email(text, text, integer) to service_role;

revoke all on function public.finalize_order_confirmation_email(text, text) from public, anon, authenticated;
grant execute on function public.finalize_order_confirmation_email(text, text) to service_role;

revoke all on function public.release_order_confirmation_claim(text, text) from public, anon, authenticated;
grant execute on function public.release_order_confirmation_claim(text, text) to service_role;
