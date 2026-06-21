-- Lease renewals (DocuSeal tenant lease-renewal workflow)
-- First-class record of each renewal attempt: serves as the review queue,
-- the renewal chain, and the audit trail. See docs/docuseal-tenant-renewal-spec.md.
--
-- The chain is walked (ordered by term) to compute the next renewal from the
-- latest signed one. original_lease_date is the immutable "X date" pinned at the
-- chain root so the addendum reference never drifts across renewals.

CREATE TABLE IF NOT EXISTS lease_renewals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id         UUID NOT NULL,
  contract_id         UUID NOT NULL,
  property_id         UUID,
  original_lease_date DATE,                       -- immutable "X date" pinned at chain root
  new_term_start      DATE,                       -- = current contract end_date + 1 day
  new_term_end        DATE,                       -- = new_term_start + 12 months
  rent_amount         NUMERIC,                    -- carried over (same rate)
  status              TEXT NOT NULL DEFAULT 'draft', -- draft|pending_review|sent|signed|countersigned|declined|blocked
  docuseal_submission_id TEXT,
  signers             JSONB DEFAULT '[]'::jsonb,  -- [{ tenantId, email, submitterId, order, status, signedAt }]
  applied_to_contract BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lease_renewals_landlord_id_idx
  ON lease_renewals (landlord_id);
CREATE INDEX IF NOT EXISTS lease_renewals_contract_id_idx
  ON lease_renewals (contract_id);
CREATE INDEX IF NOT EXISTS lease_renewals_docuseal_submission_id_idx
  ON lease_renewals (docuseal_submission_id);

-- Reuse the generic set_updated_at() trigger function from
-- scripts/add-tenant-timestamps.sql. Defined here too (idempotent) so this
-- migration is safe to run standalone; CREATE OR REPLACE leaves an existing
-- identical definition untouched.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lease_renewals_set_updated_at ON lease_renewals;

CREATE TRIGGER lease_renewals_set_updated_at
  BEFORE UPDATE ON lease_renewals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Row-level security: landlord_id-scoped, reusing the is_team_member() helper
-- from migrate-team-landlords.sql (same pattern as email_templates/automations/
-- messages). The monolith reads lease_renewals with the anon key, so without
-- this every landlord could read every team's renewals. Service-role routes
-- (create/send/webhook) bypass RLS as intended.
ALTER TABLE lease_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lease_renewals_team_all ON lease_renewals;
CREATE POLICY lease_renewals_team_all ON lease_renewals
  FOR ALL USING (public.is_team_member(landlord_id))
          WITH CHECK (public.is_team_member(landlord_id));
