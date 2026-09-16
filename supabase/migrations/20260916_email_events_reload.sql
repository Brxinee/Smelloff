-- Reload PostgREST schema cache so public.email_events / email_webhook_events
-- are visible after 20260915_email_events.sql. Does not CREATE or ALTER tables.
-- Operator still applies this in Supabase SQL editor (or migration runner).
-- Do not treat git presence as proof the production schema cache is current.

NOTIFY pgrst, 'reload schema';
