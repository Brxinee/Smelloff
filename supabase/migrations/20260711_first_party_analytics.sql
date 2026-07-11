-- Applied to project tnuqjydmoxczdjnsgpci on 2026-07-11.
--
-- First-party, cookieless web analytics. Rows are written only by the
-- /api/track serverless beacon (service role); no client ever inserts directly
-- and no anon/authenticated role can read. `visitor` is a daily-rotating,
-- one-way hash (no raw IP or PII is ever stored).

create table if not exists public.page_views (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  path          text not null check (char_length(path) <= 512),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 255),
  device        text not null default 'other' check (device in ('mobile','desktop','tablet','other')),
  country       text check (country is null or char_length(country) <= 4),
  visitor       text not null check (char_length(visitor) <= 64)
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx    on public.page_views (path);
create index if not exists page_views_visitor_idx on public.page_views (visitor);

alter table public.page_views enable row level security;
-- Intentionally no policies: with RLS on and no policy, anon/authenticated get
-- zero access. Only the service role (bypasses RLS) reads/writes, via the server.

create or replace function public.site_analytics(p_days int default 28)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  d int := greatest(1, least(coalesce(p_days,28), 365));
  start_at timestamptz := now() - make_interval(days => d);
  prev_at  timestamptz := now() - make_interval(days => d * 2);
  result jsonb;
begin
  with cur as (
    select * from page_views where created_at >= start_at
  ),
  prev as (
    select * from page_views where created_at >= prev_at and created_at < start_at
  )
  select jsonb_build_object(
    'days', d,
    'totals', jsonb_build_object(
      'views',        (select count(*) from cur),
      'visitors',     (select count(distinct visitor) from cur),
      'viewsPrev',    (select count(*) from prev),
      'visitorsPrev', (select count(distinct visitor) from prev)
    ),
    'daily', coalesce((select jsonb_agg(x order by x->>'date') from (
        select jsonb_build_object(
          'date', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
          'views', count(*), 'visitors', count(distinct visitor)) as x
        from cur group by date_trunc('day', created_at)) t), '[]'::jsonb),
    'topPages', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('path', path, 'views', count(*), 'visitors', count(distinct visitor)) as x
        from cur group by path order by count(*) desc limit 15) t), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('host', coalesce(nullif(referrer_host,''),'direct'), 'views', count(*)) as x
        from cur group by coalesce(nullif(referrer_host,''),'direct') order by count(*) desc limit 12) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('device', device, 'views', count(*)) as x
        from cur group by device order by count(*) desc) t), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('country', coalesce(country,'??'), 'views', count(*), 'visitors', count(distinct visitor)) as x
        from cur group by country order by count(*) desc limit 12) t), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.site_realtime()
returns int
language sql
set search_path = public
as $$
  select count(distinct visitor)::int
  from page_views where created_at >= now() - interval '5 minutes';
$$;

revoke all on function public.site_analytics(int) from public, anon, authenticated;
revoke all on function public.site_realtime()      from public, anon, authenticated;
grant execute on function public.site_analytics(int) to service_role;
grant execute on function public.site_realtime()      to service_role;
