-- ============================================================
-- Laundry Dispatch — initial schema
-- Paste into Supabase Dashboard -> SQL Editor and Run.
-- Re-runnable: guarded with IF NOT EXISTS / DROP ... IF EXISTS / upserts.
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('customer','driver','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_type as enum
    ('wash_fold','express','delicate','hypoallergenic','hang_dry','stain_treatment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum
    ('placed','confirmed','driver_assigned','driver_en_route','picked_up',
     'at_facility','washing','drying','folding','ready_for_delivery',
     'out_for_delivery','delivered','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('order','promo','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_type as enum ('percent','fixed');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  phone text not null default '',
  role public.user_role not null default 'customer',
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  avatar text,
  rating numeric(2,1) not null default 5.0,
  total_deliveries integer not null default 0,
  vehicle_type text,
  vehicle_plate text,
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  street text not null,
  apt text,
  city text not null,
  state text not null,
  zip text not null,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses(user_id);

create table if not exists public.services (
  id public.service_type primary key,
  name text not null,
  description text not null,
  price_per_pound numeric(10,2) not null,
  icon text not null,
  color text not null,
  estimated_hours integer not null
);

create sequence if not exists public.order_seq start with 2848;

create table if not exists public.orders (
  id text primary key default ('ORD-' || nextval('public.order_seq')),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'placed',
  services public.service_type[] not null default array[]::public.service_type[],
  pickup_address jsonb not null,
  delivery_address jsonb not null,
  pickup_slot jsonb,
  delivery_slot jsonb,
  estimated_pounds numeric(6,2) not null default 0,
  actual_pounds numeric(6,2),
  special_instructions text,
  estimated_price numeric(10,2) not null default 0,
  final_price numeric(10,2),
  tip numeric(10,2),
  promo_code text,
  discount numeric(10,2),
  rating integer check (rating between 1 and 5),
  review text,
  pickup_photo text,
  delivery_photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_driver_id_idx on public.orders(driver_id);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists osh_order_id_idx on public.order_status_history(order_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null default 'system',
  read boolean not null default false,
  order_id text references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications(user_id);

create table if not exists public.promo_codes (
  code text primary key,
  discount numeric(10,2) not null,
  type public.promo_type not null,
  min_order numeric(10,2) not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true
);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();

-- ---------- Auto-create a profile row on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role,'customer')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper: current user's role (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.addresses enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.promo_codes enable row level security;

-- profiles: read/update own (admins: all); insert own
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or public.current_user_role() = 'admin')
  with check (id = auth.uid() or public.current_user_role() = 'admin');

-- drivers: readable by any signed-in user (so customers see assigned driver); write own/admin
drop policy if exists "drivers_select" on public.drivers;
create policy "drivers_select" on public.drivers for select
  using (auth.uid() is not null);
drop policy if exists "drivers_write_own" on public.drivers;
create policy "drivers_write_own" on public.drivers for all
  using (id = auth.uid() or public.current_user_role() = 'admin')
  with check (id = auth.uid() or public.current_user_role() = 'admin');

-- addresses: own only (admins can read)
drop policy if exists "addresses_select" on public.addresses;
create policy "addresses_select" on public.addresses for select
  using (user_id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "addresses_insert" on public.addresses;
create policy "addresses_insert" on public.addresses for insert
  with check (user_id = auth.uid());
drop policy if exists "addresses_update" on public.addresses;
create policy "addresses_update" on public.addresses for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "addresses_delete" on public.addresses;
create policy "addresses_delete" on public.addresses for delete
  using (user_id = auth.uid());

-- services: catalog readable by all signed-in; write admin
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services for select
  using (auth.uid() is not null);
drop policy if exists "services_write_admin" on public.services;
create policy "services_write_admin" on public.services for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- promo_codes: readable by all signed-in; write admin
drop policy if exists "promos_select" on public.promo_codes;
create policy "promos_select" on public.promo_codes for select
  using (auth.uid() is not null);
drop policy if exists "promos_write_admin" on public.promo_codes;
create policy "promos_write_admin" on public.promo_codes for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- orders: customers own; drivers see/claim unassigned + manage assigned; admins all
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders for select
  using (
    customer_id = auth.uid()
    or driver_id = auth.uid()
    or (public.current_user_role() = 'driver' and driver_id is null)
    or public.current_user_role() = 'admin'
  );
drop policy if exists "orders_insert_customer" on public.orders;
create policy "orders_insert_customer" on public.orders for insert
  with check (customer_id = auth.uid());
drop policy if exists "orders_update_customer" on public.orders;
create policy "orders_update_customer" on public.orders for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
drop policy if exists "orders_update_driver" on public.orders;
create policy "orders_update_driver" on public.orders for update
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());
drop policy if exists "orders_claim_driver" on public.orders;
create policy "orders_claim_driver" on public.orders for update
  using (public.current_user_role() = 'driver' and driver_id is null)
  with check (driver_id = auth.uid());
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- order_status_history: visible/insertable if you can see the parent order
drop policy if exists "osh_select" on public.order_status_history;
create policy "osh_select" on public.order_status_history for select
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid() or o.driver_id = auth.uid()
      or public.current_user_role() = 'admin'
    )
  ));
drop policy if exists "osh_insert" on public.order_status_history;
create policy "osh_insert" on public.order_status_history for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid() or o.driver_id = auth.uid()
      or public.current_user_role() = 'admin'
    )
  ));

-- notifications: own only
drop policy if exists "notif_select" on public.notifications;
create policy "notif_select" on public.notifications for select
  using (user_id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications for insert
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "notif_update" on public.notifications;
create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notif_delete" on public.notifications;
create policy "notif_delete" on public.notifications for delete
  using (user_id = auth.uid());

-- ---------- Grants (table-level; RLS still enforced per-row) ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on sequence public.order_seq to authenticated;

-- Prevent users from changing their own role (privilege escalation). Role is set
-- by the signup trigger (SECURITY DEFINER) or by an admin via a privileged path.
revoke update (role) on public.profiles from authenticated;

-- ---------- Seed: service catalog ----------
insert into public.services (id, name, description, price_per_pound, icon, color, estimated_hours) values
  ('wash_fold','Wash & Fold','Standard wash, dry, and fold service',1.99,'shirt','#0B5E8A',24),
  ('express','Express Service','Same-day turnaround guaranteed',3.49,'zap','#F59E0B',6),
  ('delicate','Delicate Care','Gentle cycle for sensitive fabrics',2.99,'feather','#EC4899',36),
  ('hypoallergenic','Hypoallergenic','Free & clear detergent, no fragrances',2.49,'shield-check','#10B981',28),
  ('hang_dry','Hang Dry','Air dried to preserve fabric quality',2.79,'wind','#8B5CF6',48),
  ('stain_treatment','Stain Treatment','Pre-treatment for tough stains',3.29,'sparkles','#F97316',30)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  price_per_pound = excluded.price_per_pound, icon = excluded.icon,
  color = excluded.color, estimated_hours = excluded.estimated_hours;

-- ---------- Seed: promo codes ----------
insert into public.promo_codes (code, discount, type, min_order, expires_at, is_active) values
  ('FRESH20',20,'percent',25,'2026-04-01',true),
  ('FIRST5',5,'fixed',15,'2026-12-31',true),
  ('WEEKLY10',10,'percent',30,'2026-06-01',true)
on conflict (code) do nothing;
