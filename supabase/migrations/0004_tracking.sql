-- ============================================================
-- GPS live tracking: driver position streamed on active orders
-- ============================================================

alter table public.orders
  add column if not exists driver_lat double precision,
  add column if not exists driver_lng double precision,
  add column if not exists driver_heading double precision,
  add column if not exists driver_loc_updated_at timestamptz;

-- Full row in realtime payloads so the customer gets the new lat/lng on update.
alter table public.orders replica identity full;

-- Stream order changes (incl. driver location) over Supabase Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
