-- Spot type for parking_spots: a free-text description of where the spot sits in
-- the lot and how it's oriented, e.g. "right side (diagonal)", "back side
-- (straight)", "left side (straight)".
--
-- Deliberately NOT a CHECK-constrained enum, unlike market_status. These values
-- describe one lot's physical layout, so a different property needs entirely
-- different descriptors -- a CHECK would force a migration every time a property
-- with a new layout is added. market_status is the opposite case: a genuine
-- closed vocabulary the app branches on.
--
-- Nullable: existing spots have no type, and it stays optional on create.

ALTER TABLE parking_spots
  ADD COLUMN IF NOT EXISTS type TEXT;
