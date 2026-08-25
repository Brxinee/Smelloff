-- Migration for SMELLOFF 22.09 Pre-Launch Campaign Leads
create table if not exists public.prelaunch_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  whatsapp text not null,
  email text not null,
  campaign text not null default 'SMELLOFF_22_09_2026',
  source text default 'direct',
  consent_agreed boolean not null default true,
  consent_timestamp timestamptz not null default now(),
  user_agent text,
  ip_address text
);

create unique index if not exists prelaunch_leads_email_idx on public.prelaunch_leads (lower(email));
create unique index if not exists prelaunch_leads_whatsapp_idx on public.prelaunch_leads (whatsapp);

alter table public.prelaunch_leads enable row level security;

-- Allow anonymous inserts for the pre-launch campaign form
create policy "public insert prelaunch_leads"
  on public.prelaunch_leads for insert to anon
  with check (true);
