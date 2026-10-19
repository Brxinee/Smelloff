-- Security hardening (2026-10-18).
--
-- 1. orders: drop "users_select_own_orders". It let any Supabase Auth session
--    read every order whose customer_email matched the token's email claim.
--    The site has no Supabase Auth users and never reads orders with the anon
--    key (the Worker and edge functions use the service role), so the policy
--    only served someone who could get a session for a customer's address.
drop policy if exists "users_select_own_orders" on public.orders;

-- 2. orders: the browser roles need no table access at all. RLS already
--    blocks them; revoking the grants means a future permissive policy can't
--    reopen the table by accident.
revoke all on table public.orders from anon, authenticated;
