-- ============================================================================
-- Products catalog — powers the admin Products tab (admin.smelloff.in).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Model:  one row per sellable product. Money is stored in PAISE (integers),
--         exactly like orders.amount (₹229 → 22900) so nothing ever touches
--         floats. `variants` is a JSON array of {name, sku, price, stock} for
--         products that ship in more than one size/scent; leave it [] for a
--         single-variant product. `stock` NULL means "not tracked" (unlimited);
--         a number is decremented/managed by hand from the admin for now.
--
-- Access:  the admin writes with the service_role key (bypasses RLS entirely).
--          The public storefront may read ACTIVE products with the anon key —
--          the SELECT policy below is the only anon access. No anon
--          insert/update/delete, same strict posture as blog_comments.
-- ============================================================================

create table if not exists public.products (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text        not null check (char_length(name) between 1 and 160),
  slug             text        unique,
  description      text,
  price            integer     not null default 0 check (price >= 0),      -- paise
  compare_at_price integer     check (compare_at_price >= 0),              -- paise, MRP strikethrough
  sku              text,
  stock            integer,                                                -- NULL = untracked
  image_url        text,
  active           boolean     not null default true,
  variants         jsonb       not null default '[]'::jsonb,
  sort_order       integer     not null default 0
);

-- Storefront/admin both list by hand-order then newest; filtered to active for
-- the public read path.
create index if not exists products_active_sort_idx
  on public.products (active, sort_order, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.products enable row level security;

-- Drop first so this script is safe to re-run.
drop policy if exists "products_select_active" on public.products;

-- SELECT: anyone may read, but only active products. (The admin does not rely
-- on this — it uses the service_role key and sees everything, active or not.)
create policy "products_select_active"
  on public.products
  for select
  using (active = true);

-- NOTE: No INSERT/UPDATE/DELETE policies. With RLS on and none defined, anon
-- cannot mutate the catalog; all writes go through /api/admin (service_role).

-- ----------------------------------------------------------------------------
-- Seed the current catalog — the single ODORSTRIKE SKU (₹229, 50 ml). Safe to
-- re-run: the slug is unique, so a second run is a no-op.
-- ----------------------------------------------------------------------------
insert into public.products (name, slug, description, price, sku, stock, active, sort_order)
values (
  'ODORSTRIKE Fabric Odor Remover',
  'odorstrike',
  'India''s first pocket-sized fabric odor remover spray. 50 ml. Up to 8 hours odor protection on fabric — glycerine-free, zero residue.',
  22900,
  'ODS-50',
  null,
  true,
  0
)
on conflict (slug) do nothing;
