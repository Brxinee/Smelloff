-- Reviews: verified buyers only, enforced by the database (2026-10-25).
--
-- /reviews shows only reviews tied to an order (CLAUDE.md, 2026-10-12), but
-- the live policy "Reviews are publicly readable" was `using (true)`, so the
-- filter lived only in the page's query and a direct API call could read the
-- one legacy review with no order. The policy now matches the page.
--
-- Reviews are written by the submit-review edge function with the service
-- role, so the browser roles need SELECT only. The legacy row is hidden, not
-- deleted.
drop policy if exists "Reviews are publicly readable" on public.reviews;
drop policy if exists "reviews_select_verified" on public.reviews;
create policy "reviews_select_verified"
  on public.reviews for select to anon, authenticated
  using (order_id is not null);

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;
