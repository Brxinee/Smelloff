-- Migration: Harden public.admin_alerts RLS and revoke unauthorized public Data API grants
-- Description: Enables Row Level Security (RLS) and revokes public, anon, and authenticated privileges
-- on public.admin_alerts to prevent unauthorized PostgREST read/write/truncate access.

-- 1. Enable Row Level Security on public.admin_alerts
alter table if exists public.admin_alerts enable row level security;

-- 2. Drop any legacy or permissive public policies if they exist
drop policy if exists "allow_anon_read_admin_alerts" on public.admin_alerts;
drop policy if exists "allow_authenticated_read_admin_alerts" on public.admin_alerts;
drop policy if exists "allow_anon_insert_admin_alerts" on public.admin_alerts;
drop policy if exists "allow_authenticated_insert_admin_alerts" on public.admin_alerts;
drop policy if exists "admin_alerts_service_role_all" on public.admin_alerts;

-- 3. Revoke all privileges from anon, authenticated, and public roles
revoke all on table public.admin_alerts from anon;
revoke all on table public.admin_alerts from authenticated;
revoke all on table public.admin_alerts from public;

-- 4. Explicitly grant required privileges strictly to service_role (backend-only)
grant select, insert, update, delete on table public.admin_alerts to service_role;
