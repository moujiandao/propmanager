-- SUPERSEDED (2026-08-11) by scripts/add-parking-lease-vehicle.sql and
-- scripts/drop-parking-spot-vehicle.sql, which move these three columns
-- onto parking_leases. Kept as history: it records that attaching the
-- vehicle to the spot was a deliberate choice before it was reversed.
-- Do not run this on a fresh database -- run the two scripts above.
--
-- Original note follows.
--
-- Vehicle details for a parking spot: which car is parked there.
-- car_year is a smallint rather than text so it sorts and compares
-- numerically. All three are nullable.

ALTER TABLE parking_spots
  ADD COLUMN IF NOT EXISTS car_make  TEXT,
  ADD COLUMN IF NOT EXISTS car_model TEXT,
  ADD COLUMN IF NOT EXISTS car_year  SMALLINT;
