-- =====================================================================
-- Parking spots
--
-- Existing tenants get first right of refusal on a spot at a set rate;
-- unclaimed spots can be leased out to people who are not tenants
-- ("market renters"). Three tables:
--
--   parking_spots    - one row per physical spot at a property
--   parking_renters  - market lessees who are NOT tenants. Deliberately
--                       has no link to auth.users: nothing in the write
--                       path ever creates a login for one of these rows,
--                       so a market renter can never get portal access.
--   parking_leases   - the PARKING LEASE: the agreement for one spot.
--                       A separate record from `contracts` (the residential
--                       lease), with no link between them -- a spot can be
--                       rented by a non-tenant, and parking terms run
--                       independently of the residential term. Exactly one
--                       of tenant_id / renter_id is set (CHECK), so a
--                       parking lease is never ambiguous about who it's for.
--
-- Occupancy is DERIVED from a lease's start/end dates (see
-- lib/parking/status.js), not stored as a column, mirroring the tenant
-- status pattern in lib/tenant/status.js -- a stored status column
-- drifting from the real dates is the bug class that pattern exists to
-- avoid.
--
-- The EXCLUDE constraint below prevents two leases from ever double-
-- booking the same spot over overlapping dates, enforced at the DB
-- level regardless of what the app does.
--
-- Both landlord_id-scoped tables reuse the existing is_team_member()
-- RLS helper from migrate-team-landlords.sql.
--
-- FRESH DATABASE: this script alone is not the whole parking schema.
-- Run these after it, in order:
--   1. scripts/add-parking-spot-type.sql          (parking_spots.type)
--   2. scripts/add-parking-lease-vehicle.sql      (no-op here: the car
--                                                  columns are already in
--                                                  the create below)
--   3. scripts/drop-parking-spot-vehicle.sql      (no-op here: this script
--                                                  never creates the old
--                                                  spot vehicle/rate columns)
-- Steps 2 and 3 matter only for a database created before 2026-08-11.
--
-- Idempotent: safe to run more than once. Note that `create table if not
-- exists` will NOT add columns to a table that already exists -- on an
-- existing database the numbered scripts above are what change its shape.
-- Run in Supabase -> SQL Editor.
-- =====================================================================

begin;

create extension if not exists btree_gist;

-- Reuse the generic set_updated_at() trigger function from
-- scripts/add-tenant-timestamps.sql. Defined here too (idempotent) so this
-- migration is safe to run standalone.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- 1. parking_spots
-- ---------------------------------------------------------------------
create table if not exists public.parking_spots (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlord_profiles(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  label         text not null,
  market_status text not null default 'tenant_priority'
                  check (market_status in ('tenant_priority', 'open_market')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (property_id, label)
);
create index if not exists parking_spots_landlord_id_idx on public.parking_spots(landlord_id);
create index if not exists parking_spots_property_id_idx on public.parking_spots(property_id);

drop trigger if exists parking_spots_set_updated_at on public.parking_spots;
create trigger parking_spots_set_updated_at
  before update on public.parking_spots
  for each row execute function set_updated_at();

alter table public.parking_spots enable row level security;
drop policy if exists parking_spots_team_all on public.parking_spots;
create policy parking_spots_team_all on public.parking_spots
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- ---------------------------------------------------------------------
-- 2. parking_renters (market lessees -- no auth.users link, ever)
-- ---------------------------------------------------------------------
create table if not exists public.parking_renters (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlord_profiles(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists parking_renters_landlord_id_idx on public.parking_renters(landlord_id);

alter table public.parking_renters enable row level security;
drop policy if exists parking_renters_team_all on public.parking_renters;
create policy parking_renters_team_all on public.parking_renters
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- ---------------------------------------------------------------------
-- 3. parking_leases
-- ---------------------------------------------------------------------
create table if not exists public.parking_leases (
  id              uuid primary key default gen_random_uuid(),
  landlord_id     uuid not null references public.landlord_profiles(id) on delete cascade,
  parking_spot_id uuid not null references public.parking_spots(id) on delete cascade,
  tenant_id       uuid references public.tenant_profiles(id) on delete cascade,
  renter_id       uuid references public.parking_renters(id) on delete cascade,
  rate            numeric not null,
  start_date      date not null,
  end_date        date,
  -- The vehicle on this agreement. It arrives with the lease and leaves with
  -- it; parking_spots carries no vehicle. See scripts/add-parking-lease-vehicle.sql.
  car_make        text,
  car_model       text,
  car_year        smallint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((tenant_id is not null)::int + (renter_id is not null)::int = 1),
  check (end_date is null or end_date >= start_date),
  exclude using gist (
    parking_spot_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  )
);
create index if not exists parking_leases_landlord_id_idx on public.parking_leases(landlord_id);
create index if not exists parking_leases_parking_spot_id_idx on public.parking_leases(parking_spot_id);
create index if not exists parking_leases_tenant_id_idx on public.parking_leases(tenant_id);
create index if not exists parking_leases_renter_id_idx on public.parking_leases(renter_id);

drop trigger if exists parking_leases_set_updated_at on public.parking_leases;
create trigger parking_leases_set_updated_at
  before update on public.parking_leases
  for each row execute function set_updated_at();

alter table public.parking_leases enable row level security;
drop policy if exists parking_leases_team_all on public.parking_leases;
create policy parking_leases_team_all on public.parking_leases
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

commit;
