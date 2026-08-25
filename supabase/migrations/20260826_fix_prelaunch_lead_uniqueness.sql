-- Make 22.09 lead upserts deterministic.
-- Emails are normalized to lowercase by the API, so an exact unique index is sufficient.
DROP INDEX IF EXISTS public.prelaunch_leads_email_idx;
CREATE UNIQUE INDEX IF NOT EXISTS prelaunch_leads_email_unique_idx
  ON public.prelaunch_leads (email);

CREATE UNIQUE INDEX IF NOT EXISTS prelaunch_leads_whatsapp_unique_idx
  ON public.prelaunch_leads (whatsapp);
