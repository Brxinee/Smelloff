-- Applied to project tnuqjydmoxczdjnsgpci on 2026-06-11.

-- 1) Restock/newsletter waitlist (footer form) — anon insert-only, validated email.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) <= 120 and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  source text not null default 'footer' check (char_length(source) <= 40)
);
create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
create policy "public can join waitlist"
  on public.waitlist for insert to anon
  with check (true);

-- 2) Review hardening: reviews must reference a real order. Direct anon inserts
--    are closed; the submit-review edge function (service role) verifies the
--    order id and inserts on the customer's behalf.
alter table public.reviews add column if not exists order_id uuid references public.orders(id);
create unique index if not exists reviews_order_id_idx on public.reviews (order_id) where order_id is not null;
drop policy if exists "Anyone can submit a review" on public.reviews;
