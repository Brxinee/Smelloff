-- Reviews: shown only when the order behind them was actually bought
-- (2026-10-25). Supersedes the SELECT policy in 20261025_reviews_verified_only.sql.
--
-- `order_id is not null` was not enough. The one order-linked review
-- (SMF-20260811-9912) was posted against a COD order that was cancelled 11
-- hours after it was placed and never delivered, so /reviews and the
-- homepage labelled a non-buyer "Verified buyer". The rule below is the
-- submit-review edge function's own (isOrderReviewEligible in
-- supabase/functions/_shared/security.ts): COD once delivered, prepaid once
-- confirmed, never cancelled / failed / upi_pending.
--
-- The browser roles cannot read orders, so the check runs in a security
-- definer function that returns only a boolean. The review is hidden, not
-- deleted: if the order is later marked delivered, the review shows again.
create or replace function public.review_order_bought(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and case
        when lower(coalesce(o.payment_method, '')) = 'cod'
          then o.status = 'delivered'
        else o.status in ('confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered')
      end
  );
$$;

revoke all on function public.review_order_bought(uuid) from public;
grant execute on function public.review_order_bought(uuid) to anon, authenticated;

drop policy if exists "Reviews are publicly readable" on public.reviews;
drop policy if exists "reviews_select_verified" on public.reviews;
create policy "reviews_select_verified"
  on public.reviews for select to anon, authenticated
  using (order_id is not null and public.review_order_bought(order_id));

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;
