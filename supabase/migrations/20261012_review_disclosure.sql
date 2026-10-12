-- Star rating from verified buyers only (2026-10-12).
--
-- * reviews.verified_purchase is GENERATED from order_id, so nothing a client
--   sends can set it.
-- * reviews.disclosure: 'none' | 'connection' (a buyer who ticks "I know the
--   founder or the team"). A connected review shows a tag and never counts.
-- Only verified_purchase and disclosure = 'none' feeds the aggregate (and,
-- later, Product schema stars).

alter table public.reviews
  add column if not exists disclosure text not null default 'none'
    check (disclosure in ('none', 'connection')),
  add column if not exists verified_purchase boolean
    generated always as (order_id is not null) stored;

-- The only numbers allowed to become star ratings.
create or replace view public.review_rating_stats
  with (security_invoker = true) as
  select count(*)::int as review_count,
         round(avg(rating)::numeric, 1) as rating_value
  from public.reviews
  where verified_purchase and disclosure = 'none';

grant select on public.review_rating_stats to anon, authenticated;
