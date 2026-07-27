-- "In Production" flag for properties. When unchecked, tenants of that property
-- (and its maintenance requests) drop out of the dashboard, Tenants page, Payments
-- page, and To Do List — used to retire a property from active tracking without
-- deleting its history. The property itself still shows on the Properties page,
-- where the flag is toggled.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS in_production BOOLEAN NOT NULL DEFAULT TRUE;
