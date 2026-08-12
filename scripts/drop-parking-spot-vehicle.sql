-- =====================================================================
-- Move the vehicle onto the parking lease (contract half)
--
-- Run scripts/add-parking-lease-vehicle.sql FIRST and deploy the code
-- that reads parking_leases.car_* before running this. Once these
-- columns are gone the old code cannot render a spot's vehicle or rate.
--
-- monthly_rate goes too, and it is not backfilled anywhere: it was an
-- asking rate that prefilled the lease form, and parking_leases.rate --
-- the agreed rate, NOT NULL, already present -- is now the only rate.
-- There is no asking-rate concept afterwards, so a vacant spot shows no
-- price. That is intended, not an oversight.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

begin;

alter table public.parking_spots
  drop column if exists car_make,
  drop column if exists car_model,
  drop column if exists car_year,
  drop column if exists monthly_rate;

commit;
