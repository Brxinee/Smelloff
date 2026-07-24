-- Customer accounts (phone-OTP login) — orders ownership, profiles, self-serve
-- cancellation.
--
-- NOT YET APPLIED. Apply this together with enabling the Phone provider in
-- Supabase Auth (see docs/ACCOUNTS-SETUP.md) — the site's /account page and the
-- login-gated checkout both depend on this schema.
--
-- Design notes
--   * Phone is the identity. Orders have always been keyed on customer_phone
--     (10 local digits, NOT NULL); Supabase stores the auth phone as E.164
--     digits without '+' (919876543210), so every comparison goes through
--     public.auth_phone10() which normalises to the last 10 digits.
--   * Ownership is stamped on the order (orders.user_id). The phone branch in
--     the read policy is only a safety net for orders that predate the account.
--   * Customers get SELECT only. Cancellation is a service-role edge function
--     (cancel-order) so the pre-dispatch rule can't be bypassed by a crafted
--     PostgREST request.

-- ---------------------------------------------------------------------------
-- 1) Identity helper — the authenticated caller's phone as 10 local digits.
--    NULL (never '') when there is no phone claim, so it can't match a row.
-- ---------------------------------------------------------------------------
create or replace function public.auth_phone10()
returns text
language sql
stable
as $$
  select nullif(
    right(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '[^0-9]', '', 'g'), 10),
    ''
  );
$$;

-- Same normalisation for a raw phone value (auth.users.phone, client input).
create or replace function public.phone10(raw text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g'), 10), '');
$$;

-- ---------------------------------------------------------------------------
-- 2) Order ownership + cancellation columns.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders
  add column if not exists cancelled_at timestamptz;
alter table public.orders
  add column if not exists cancel_reason text
    check (cancel_reason is null or char_length(cancel_reason) <= 300);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_customer_phone_idx on public.orders (customer_phone);

-- ---------------------------------------------------------------------------
-- 3) Customer profiles — name / email / default address, one row per account.
--    Auto-created on signup; the customer edits it from /account.
-- ---------------------------------------------------------------------------
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text check (full_name is null or char_length(full_name) <= 80),
  email text check (email is null or (char_length(email) <= 120 and position('@' in email) > 1)),
  -- Mirrors the verified auth phone. Display/prefill only — never an authority
  -- for access (the write policy pins it to the JWT so it can't be spoofed).
  phone text check (phone is null or phone ~ '^[0-9]{10}$'),
  default_address jsonb not null default '{}'::jsonb
);

alter table public.customer_profiles enable row level security;

drop policy if exists "customers read own profile" on public.customer_profiles;
create policy "customers read own profile"
  on public.customer_profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "customers create own profile" on public.customer_profiles;
create policy "customers create own profile"
  on public.customer_profiles for insert to authenticated
  with check (id = auth.uid() and (phone is null or phone = public.auth_phone10()));

drop policy if exists "customers update own profile" on public.customer_profiles;
create policy "customers update own profile"
  on public.customer_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and (phone is null or phone = public.auth_phone10()));

create or replace function public.customer_profiles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_profiles_touch_trg on public.customer_profiles;
create trigger customer_profiles_touch_trg
  before update on public.customer_profiles
  for each row execute function public.customer_profiles_touch();

-- ---------------------------------------------------------------------------
-- 4) Read access to orders.
--    Replaces the old email-based policy — email is optional at checkout, so it
--    matched nothing for phone-only orders.
-- ---------------------------------------------------------------------------
drop policy if exists "users_select_own_orders" on public.orders;
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders"
  on public.orders for select to authenticated
  using (
    user_id = auth.uid()
    -- Safety net: an unclaimed order placed with this verified phone.
    or (user_id is null and customer_phone = public.auth_phone10())
  );

-- ---------------------------------------------------------------------------
-- 5) Auto-provision the profile on signup and claim any orders already placed
--    with that phone. SECURITY DEFINER: runs inside the auth signup
--    transaction, so it must never raise — a failure here would block login.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := public.phone10(new.phone);
begin
  begin
    insert into public.customer_profiles (id, phone, email)
    values (new.id, p, nullif(new.email, ''))
    on conflict (id) do nothing;

    if p is not null then
      update public.orders
         set user_id = new.id
       where user_id is null
         and customer_phone = p;
    end if;
  exception when others then
    -- Never break signup over bookkeeping.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_customer();

-- ---------------------------------------------------------------------------
-- 6) Backstop: stamp user_id on insert when the edge function didn't (e.g. an
--    order written by an admin tool) but a matching account exists.
-- ---------------------------------------------------------------------------
create or replace function public.orders_link_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null and new.customer_phone is not null then
    select u.id
      into new.user_id
      from auth.users u
     where public.phone10(u.phone) = new.customer_phone
     order by u.created_at
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_link_customer_trg on public.orders;
create trigger orders_link_customer_trg
  before insert on public.orders
  for each row execute function public.orders_link_customer();

-- ---------------------------------------------------------------------------
-- 7) Stamp cancelled_at whenever an order moves to 'cancelled', wherever the
--    change comes from (customer, admin dashboard, raw SQL).
--    This is the 20260711 trail trigger re-declared with the cancellation stamp
--    added — same behaviour otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.orders_track_status()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    new.updated_at := now();
    if (new.status_history is null or jsonb_array_length(new.status_history) = 0) then
      new.status_history := jsonb_build_array(
        jsonb_build_object('status', new.status, 'at', now())
      );
    end if;
    if (new.status = 'cancelled' and new.cancelled_at is null) then
      new.cancelled_at := now();
    end if;
  elsif (tg_op = 'UPDATE') then
    if (new.status is distinct from old.status) then
      new.status_history := coalesce(old.status_history, '[]'::jsonb)
        || jsonb_build_object('status', new.status, 'at', now());
      new.updated_at := now();
      if (new.status = 'cancelled') then
        new.cancelled_at := coalesce(new.cancelled_at, now());
      end if;
    elsif (new.tracking_id is distinct from old.tracking_id
        or new.courier is distinct from old.courier
        or new.tracking_url is distinct from old.tracking_url) then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_track_status_trg on public.orders;
create trigger orders_track_status_trg
  before insert or update on public.orders
  for each row execute function public.orders_track_status();
