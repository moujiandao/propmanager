-- Tenant record audit timestamps
-- created_at already exists on tenant_profiles (added automatically by Supabase).
-- This script adds updated_at and a trigger that bumps it on every UPDATE,
-- so "Last Updated" stays accurate across all code paths that modify a tenant
-- (the update-tenant API route, plus the recurring-payment / bank-connected /
-- name client-side updates).

ALTER TABLE tenant_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows so updated_at isn't null before the first edit.
UPDATE tenant_profiles
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- Generic trigger function: set updated_at = now() on any row update.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_profiles_set_updated_at ON tenant_profiles;

CREATE TRIGGER tenant_profiles_set_updated_at
  BEFORE UPDATE ON tenant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
