-- =====================================================================
-- Drop parking_spots.market_status
--
-- The column stored whether a spot was "tenant priority" or "open
-- market", toggled by hand from the spot card. It drifted, the way
-- stored status always does in this app: spots sat labelled Open Market
-- while their live lease was to a tenant.
--
-- Who a spot is let to is now DERIVED from its active lease via
-- leaseParty() in lib/parking/status.js. The lease's CHECK already
-- guarantees exactly one of tenant_id/renter_id, so the label can only
-- be wrong when the lease is wrong.
--
-- Deploy the code that stops reading this column BEFORE running this --
-- the same expand/contract ordering as the vehicle move.
--
-- Note what is NOT preserved: a vacant spot has no lease, so there is no
-- longer any record of one being *offered* to the market before somebody
-- takes it. That was the flag's honest purpose. If it is wanted back it
-- belongs as its own `listed` boolean, not as a status pretending to
-- describe a letting that does not exist.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

alter table public.parking_spots
  drop column if exists market_status;
