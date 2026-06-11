-- Applied to project tnuqjydmoxczdjnsgpci on 2026-06-11 (site audit).

-- Audit fix 1 (perf advisor): evaluate auth.jwt() once per query, not per row.
drop policy if exists "users_select_own_orders" on public.orders;
create policy "users_select_own_orders"
  on public.orders for select to authenticated
  using (customer_email = (select auth.jwt() ->> 'email'));

-- Audit fix 2 (security advisor): waitlist insert check is no longer always-true.
drop policy if exists "public can join waitlist" on public.waitlist;
create policy "public can join waitlist"
  on public.waitlist for insert to anon
  with check (source in ('footer', 'pdp', 'popup'));
