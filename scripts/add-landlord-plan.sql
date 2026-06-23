-- Subscription/plan state for landlord accounts (commercialization Phase 1).
--
-- Adds the billing plan + Stripe placeholder columns to landlord_profiles. Only
-- `plan` is used in Phase 1 (defaults every account, new and existing, to 'free').
-- The stripe_* / subscription_status columns are written later by the Phase 2
-- Stripe webhook (service-role client, which bypasses RLS). Existing team-scoped
-- RLS on landlord_profiles (is_team_member(id)) already covers the new columns.

ALTER TABLE public.landlord_profiles
  ADD COLUMN IF NOT EXISTS plan                   TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT,   -- null until a Stripe subscription exists
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Constrain plan to known tiers. CHECK constraints aren't IF NOT EXISTS-able, so
-- guard the add to keep this migration safely re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landlord_profiles_plan_check'
  ) THEN
    ALTER TABLE public.landlord_profiles
      ADD CONSTRAINT landlord_profiles_plan_check
      CHECK (plan IN ('free', 'pro', 'business'));
  END IF;
END $$;

-- One Stripe customer maps to at most one landlord account.
CREATE UNIQUE INDEX IF NOT EXISTS landlord_profiles_stripe_customer_id_key
  ON public.landlord_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
