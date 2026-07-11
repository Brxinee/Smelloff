-- Applied to project tnuqjydmoxczdjnsgpci on 2026-07-11.
--
-- Give every order a timestamped status trail so the customer Track-Order
-- timeline can show WHEN each stage happened (not just the current stage), plus
-- an updated_at for a "last updated" line and freshness signalling.
--
-- Kept admin-agnostic: a BEFORE INSERT/UPDATE trigger maintains the trail
-- automatically, so the history is correct no matter how status is changed
-- (admin dashboard, edge function, or a raw SQL update).

-- 1) Columns.
alter table public.orders
  add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

-- 2) Trigger function: seed the trail on insert, append on every status change,
--    and bump updated_at when status or courier/tracking fields change.
create or replace function public.orders_track_status()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    new.updated_at := now();
    if (new.status_history is null or jsonb_array_length(new.status_history) = 0) then
      new.status_history := jsonb_build_array(
        jsonb_build_object('status', new.status, 'at', now())
      );
    end if;
  elsif (tg_op = 'UPDATE') then
    if (new.status is distinct from old.status) then
      new.status_history := coalesce(old.status_history, '[]'::jsonb)
        || jsonb_build_object('status', new.status, 'at', now());
      new.updated_at := now();
    elsif (new.tracking_id is distinct from old.tracking_id
        or new.courier is distinct from old.courier
        or new.tracking_url is distinct from old.tracking_url) then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_track_status_trg on public.orders;
create trigger orders_track_status_trg
  before insert or update on public.orders
  for each row execute function public.orders_track_status();

-- 3) Backfill existing rows so their trail isn't empty. Seed the trail from the
--    current status stamped at created_at, and set updated_at to created_at.
update public.orders
set status_history = jsonb_build_array(
      jsonb_build_object('status', status, 'at', created_at)
    ),
    updated_at = created_at
where status_history is null or jsonb_array_length(status_history) = 0;
