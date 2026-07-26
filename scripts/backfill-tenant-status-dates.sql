-- Backfill for the derived-tenant-status change (lib/tenant/status.js).
--
-- Status is now DERIVED from move_in_date / move_out_date; the stored `status`
-- column is no longer read. Any row previously marked "previous tenant" (or the
-- legacy "inactive") WITHOUT a move_out_date would therefore derive as a CURRENT
-- tenant and reappear in active lists, rent-due counts, and occupancy.
--
-- This stamps those rows with move_out_date = updated_at::date. That is an
-- approximation — updated_at is when the row was last edited, which for a
-- departed tenant is usually around when they were marked previous.
--
-- RUN THE SELECTS FIRST and eyeball the rows before running the UPDATE.
-- Not idempotent-sensitive: the UPDATE only touches rows with a NULL date, so
-- re-running it is safe.

-- ─── 1. PREVIEW: rows that will be changed ──────────────────────────────────
SELECT id, name, last_name, status, move_in_date, move_out_date, updated_at::date AS proposed_move_out
FROM tenant_profiles
WHERE status IN ('previous tenant', 'inactive')
  AND move_out_date IS NULL
ORDER BY updated_at DESC;

-- ─── 2. PREVIEW: rows needing a MANUAL decision ─────────────────────────────
-- "future tenant" rows with no move_in_date. These derive as CURRENT and there is
-- no honest way to infer a date: anything based on updated_at is in the past, which
-- would make them current anyway. Give each one a real move-in date by hand, or
-- accept that they are current. Deliberately NOT auto-fixed below.
SELECT id, name, last_name, status, move_in_date, move_out_date, updated_at::date
FROM tenant_profiles
WHERE status = 'future tenant'
  AND move_in_date IS NULL
ORDER BY updated_at DESC;

-- ─── 3. THE BACKFILL ────────────────────────────────────────────────────────
-- Uncomment and run once the preview in step 1 looks right.
--
-- UPDATE tenant_profiles
-- SET move_out_date = updated_at::date
-- WHERE status IN ('previous tenant', 'inactive')
--   AND move_out_date IS NULL;

-- ─── 4. VERIFY ──────────────────────────────────────────────────────────────
-- After the UPDATE, no departed tenant should be left without a move-out date.
-- SELECT count(*) AS still_missing
-- FROM tenant_profiles
-- WHERE status IN ('previous tenant', 'inactive') AND move_out_date IS NULL;

-- ─── 5. AFTERWARDS ──────────────────────────────────────────────────────────
-- Run `node scripts/recompute-occupancy.mjs` to resync the legacy status column
-- to the derived values and recompute units.status from the corrected dates.
