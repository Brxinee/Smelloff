-- ============================================================================
-- B2 — Analytics segmentation: India/ROW + per-source funnel views
-- ============================================================================
-- STATUS: WRITTEN BY CLAUDE, **NOT EXECUTED**. Review and run manually in the
-- Supabase SQL editor (service role). Nothing on the site depends on this
-- until the admin dashboard queries it.
--
-- Data model (already collected by api/track.js — no collection changes):
--   page_views(path, referrer_host, device, country, visitor, created_at)
--   events(type, path, label, value, visitor, session_id, device, country,
--          referrer_host, meta, created_at)
-- Funnel event types in production: 'product_view', 'purchase'
-- (pageviews live in page_views).
--
-- Source classification mirrors the paid channels that matter to this store:
-- google / instagram (incl. facebook-family referrers) / direct / other.
-- ============================================================================

create or replace function public.site_analytics_segments(days integer default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
with
  since as (select now() - make_interval(days => greatest(1, least(days, 365))) as t),

  pv as (
    select
      case when country = 'IN' then 'india' else 'row' end as geo,
      case
        when referrer_host is null or referrer_host = '' then 'direct'
        when referrer_host ilike '%google%'    then 'google'
        when referrer_host ilike '%instagram%'
          or referrer_host ilike '%facebook%'
          or referrer_host ilike '%fb.%'       then 'instagram'
        else 'other'
      end as source,
      visitor
    from page_views, since
    where created_at >= since.t
  ),

  ev as (
    select
      case when country = 'IN' then 'india' else 'row' end as geo,
      case
        when referrer_host is null or referrer_host = '' then 'direct'
        when referrer_host ilike '%google%'    then 'google'
        when referrer_host ilike '%instagram%'
          or referrer_host ilike '%facebook%'
          or referrer_host ilike '%fb.%'       then 'instagram'
        else 'other'
      end as source,
      type,
      visitor
    from events, since
    where created_at >= since.t
      and type in ('product_view', 'purchase')
  ),

  by_geo as (
    select jsonb_object_agg(geo, row_to_json(g)::jsonb) as j
    from (
      select
        coalesce(p.geo, e.geo) as geo,
        coalesce(p.pageviews, 0)     as pageviews,
        coalesce(p.visitors, 0)      as visitors,
        coalesce(e.product_views, 0) as product_views,
        coalesce(e.purchases, 0)     as purchases
      from
        (select geo, count(*) as pageviews, count(distinct visitor) as visitors
           from pv group by geo) p
        full outer join
        (select geo,
                count(*) filter (where type = 'product_view') as product_views,
                count(*) filter (where type = 'purchase')     as purchases
           from ev group by geo) e
        using (geo)
    ) g
  ),

  by_source as (
    select jsonb_object_agg(source, row_to_json(s)::jsonb) as j
    from (
      select
        coalesce(p.source, e.source) as source,
        coalesce(p.pageviews, 0)     as pageviews,
        coalesce(p.visitors, 0)      as visitors,
        coalesce(e.product_views, 0) as product_views,
        coalesce(e.purchases, 0)     as purchases
      from
        (select source, count(*) as pageviews, count(distinct visitor) as visitors
           from pv group by source) p
        full outer join
        (select source,
                count(*) filter (where type = 'product_view') as product_views,
                count(*) filter (where type = 'purchase')     as purchases
           from ev group by source) e
        using (source)
    ) s
  )

select jsonb_build_object(
  'days',      greatest(1, least(days, 365)),
  'by_geo',    coalesce((select j from by_geo),    '{}'::jsonb),
  'by_source', coalesce((select j from by_source), '{}'::jsonb)
);
$$;

-- Service-role only, like the existing site_analytics()/site_realtime() RPCs.
revoke all on function public.site_analytics_segments(integer) from public;
revoke all on function public.site_analytics_segments(integer) from anon;
revoke all on function public.site_analytics_segments(integer) from authenticated;
grant execute on function public.site_analytics_segments(integer) to service_role;
