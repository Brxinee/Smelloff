-- Honest reviews from people with a connection to Smelloff (2026-10-12).
--
-- Friends who get a free bottle can review it, but the review says so and it
-- never counts toward the star rating. Only a verified purchase with no
-- disclosed connection feeds the aggregate (and, later, Product schema stars).
--
-- * review_invites: one single-use code per gifted bottle, made in /admin.
--   No anon access at all — the submit-review edge function (service role)
--   checks the code and inserts the review.
-- * reviews.disclosure: 'none' | 'free_product' (invite reviews, forced) |
--   'connection' (a buyer who ticks "I know the founder or the team").
-- * reviews.verified_purchase is GENERATED from order_id, so nothing a client
--   sends can set it.

create table if not exists public.review_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  note text check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.review_invites enable row level security;
revoke all on public.review_invites from anon, authenticated;

alter table public.reviews
  add column if not exists invite_id uuid references public.review_invites(id),
  add column if not exists disclosure text not null default 'none'
    check (disclosure in ('none', 'free_product', 'connection')),
  add column if not exists verified_purchase boolean
    generated always as (order_id is not null) stored;

create unique index if not exists reviews_invite_id_idx
  on public.reviews (invite_id) where invite_id is not null;

alter table public.reviews drop constraint if exists reviews_one_source;
alter table public.reviews add constraint reviews_one_source
  check (order_id is null or invite_id is null);

alter table public.reviews drop constraint if exists reviews_invite_is_disclosed;
alter table public.reviews add constraint reviews_invite_is_disclosed
  check (invite_id is null or disclosure = 'free_product');

-- The only numbers allowed to become star ratings: verified purchases with no
-- disclosed connection.
create or replace view public.review_rating_stats
  with (security_invoker = true) as
  select count(*)::int as review_count,
         round(avg(rating)::numeric, 1) as rating_value
  from public.reviews
  where verified_purchase and disclosure = 'none';

grant select on public.review_rating_stats to anon, authenticated;
