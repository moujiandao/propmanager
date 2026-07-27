-- Vehicle details for a parking spot: which car is parked there.
--
-- These live on parking_spots, NOT parking_leases. That is a deliberate choice
-- with a known tradeoff: the vehicle is attached to the spot rather than to the
-- occupant, so when a lease ends the previous renter's car stays listed until
-- someone clears it, and there is no history of which vehicle occupied a spot
-- when. Chosen for simplicity -- one place to look, one modal to edit.
--
-- car_year is a smallint rather than text so it sorts and compares numerically.
-- All three are nullable: a spot can exist with no car recorded.

ALTER TABLE parking_spots
  ADD COLUMN IF NOT EXISTS car_make  TEXT,
  ADD COLUMN IF NOT EXISTS car_model TEXT,
  ADD COLUMN IF NOT EXISTS car_year  SMALLINT;
