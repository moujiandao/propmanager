-- Security deposit refund tracking for tenants
-- Boolean flag the landlord toggles once a departed tenant's deposit has been
-- returned. Surfaced on the Tenants tab as a checkbox column when "Past Tenants"
-- is selected, and on the Add/Edit tenant modals + Tenant Detail page.

ALTER TABLE tenant_profiles
  ADD COLUMN IF NOT EXISTS security_deposit_refunded BOOLEAN NOT NULL DEFAULT FALSE;
