-- Applied to project tnuqjydmoxczdjnsgpci on 2026-06-10.

-- 1) Customer-facing order code (SMF-YYYYMMDD-XXXX shown at checkout) so orders
--    can be looked up by the customer on the Track Order page.
alter table public.orders add column if not exists order_code text
  check (order_code is null or order_code ~ '^SMF-[0-9]{8}-[0-9]{4}$');
create unique index if not exists orders_order_code_idx
  on public.orders (order_code) where order_code is not null;

-- 2) Email is optional at checkout — phone is the primary identifier.
alter table public.orders alter column customer_email drop not null;

-- 3) Contact form messages (write-only from the public site).
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  email text check (email is null or (char_length(email) <= 120 and position('@' in email) > 1)),
  phone text check (phone is null or char_length(phone) <= 15),
  topic text not null default 'general' check (topic in ('general','order','payment','return','bulk','feedback')),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new','replied','closed')),
  constraint contact_reachable check (email is not null or phone is not null)
);
alter table public.contact_messages enable row level security;

-- Anon may only insert fresh messages; never read, update or delete.
create policy "public can submit contact messages"
  on public.contact_messages for insert to anon
  with check (status = 'new');
