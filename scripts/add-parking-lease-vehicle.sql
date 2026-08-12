-- =====================================================================
-- Move the vehicle onto the parking lease (expand half)
--
-- car_make / car_model / car_year used to live on parking_spots. That
-- attached the car to the asphalt: when a lease ended, the previous
-- renter's vehicle stayed listed until somebody cleared it by hand, and
-- there was no record of which car occupied a spot when. The vehicle
-- belongs to the agreement, so it moves to parking_leases.
--
-- This is the EXPAND half of an expand/contract migration. It only adds
-- and backfills, so it is safe to run while the old code is still
-- deployed -- nothing reads these columns yet. The matching contract
-- half (scripts/drop-parking-spot-vehicle.sql) drops the old columns and
-- must only run AFTER the new code is live.
--
-- car_year is smallint to match the column it came from, so it sorts and
-- compares numerically. All three are nullable: a lease can exist with
-- no vehicle recorded.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

begin;

alter table public.parking_leases
  add column if not exists car_make  text,
  add column if not exists car_model text,
  add column if not exists car_year  smallint;

-- Backfill: a spot's car belongs to whoever is leasing it right now.
--
-- "Right now" is the same rule lib/parking/status.js derives occupancy
-- from -- started on or before today, and either open-ended or ending
-- today or later. Two cases lose data on purpose and there is nowhere
-- honest to put them: a spot whose only lease is in the future, and a
-- spot with no lease at all.
--
-- The where-clause guard makes the backfill idempotent: a second run
-- finds the target rows already populated and skips them, so it can
-- never overwrite a vehicle someone edited between runs.
update public.parking_leases l
   set car_make  = s.car_make,
       car_model = s.car_model,
       car_year  = s.car_year
  from public.parking_spots s
 where l.parking_spot_id = s.id
   and l.start_date <= current_date
   and (l.end_date is null or l.end_date >= current_date)
   and (s.car_make is not null or s.car_model is not null or s.car_year is not null)
   and l.car_make is null and l.car_model is null and l.car_year is null;

commit;
