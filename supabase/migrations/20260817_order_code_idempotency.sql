-- Checkout retry/idempotency guard.
-- order_code is the durable client-generated checkout-attempt key. A repeated
-- request must resolve to the same order instead of creating a second row.
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
  ON public.orders (order_code)
  WHERE order_code IS NOT NULL;
