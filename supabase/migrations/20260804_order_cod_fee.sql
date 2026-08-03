-- Cash-on-Delivery handling charge, stored per order in paise.
--
-- `orders.amount` is and stays the collectable total — what the courier hands
-- back, what the customer was quoted, what /track-order shows. On a COD order
-- that total now includes a handling charge, so without this column product
-- revenue and payment-method revenue are indistinguishable: a month of COD
-- orders would read as ₹60 more product sold per order than actually shipped.
--
-- Prepaid (UPI) orders keep cod_fee = 0, so `amount - cod_fee` is the product
-- subtotal on every row regardless of method, and existing rows written before
-- the charge existed are correct at the default without a backfill.
alter table public.orders
  add column if not exists cod_fee integer not null default 0;

comment on column public.orders.cod_fee is
  'COD handling charge in paise, included in orders.amount. 0 for prepaid orders. Product subtotal = amount - cod_fee.';

-- Guard the invariant rather than trusting every future writer: the surcharge
-- can never be negative, and can never exceed the total it is a component of.
alter table public.orders
  drop constraint if exists orders_cod_fee_within_amount;
alter table public.orders
  add constraint orders_cod_fee_within_amount
  check (cod_fee >= 0 and cod_fee <= amount);
