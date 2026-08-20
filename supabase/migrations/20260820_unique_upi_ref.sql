-- Partial unique index on orders.upi_ref to prevent concurrent reuse of UTRs
-- across confirmed or pending verification orders at the database engine level.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_upi_ref
ON orders (upi_ref)
WHERE upi_ref IS NOT NULL
  AND upi_ref != ''
  AND status IN ('confirmed', 'verification_pending', 'packed', 'dispatched', 'out_for_delivery', 'delivered');
