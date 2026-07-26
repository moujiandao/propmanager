// The home for the tenant Status vocabulary. Status is DERIVED from the move-in /
// move-out dates rather than picked by hand. Previously it was a stored dropdown
// value that drifted from the dates: the add-tenant form defaulted to "current
// tenant" while requiring a move-in date, so a tenant moving in next month was
// stored as current and turned up in rent-due lists and occupancy counts.
// Centralizing the rule here lets the mappers, the dashboard, the occupancy
// recomputes, and the automation cron share one definition so they can't drift.
// React-free + isomorphic (client monolith + server routes both import it).
//
// The tenant_profiles.status COLUMN is now legacy: still written on create/update
// so external SQL and the ops scripts don't see nulls, but never read back.
// Read the derived value through statusFor / statusForRow instead.

import { daysBetween } from "../format/index.js";

export const FUTURE = "future tenant";
export const CURRENT = "current tenant";
export const PREVIOUS = "previous tenant";

export const TENANT_STATUSES = [FUTURE, CURRENT, PREVIOUS];

// Derive status from the two dates, relative to `today`:
//   move-out date already past         → previous
//   move-in date still ahead           → future
//   otherwise (incl. either date null) → current
//
// A tenant stays CURRENT for the whole of their move-out day and becomes CURRENT
// on their move-in day. A null move-in means "already here", which is the default
// the stored column carried for legacy rows. Move-out is checked first, so
// contradictory data (a past move-out with a future move-in) resolves to previous.
export function statusFor({ moveInDate, moveOutDate } = {}, today = new Date()) {
  const out = daysBetween(today, moveOutDate);
  if (out !== null && out < 0) return PREVIOUS;

  const inn = daysBetween(today, moveInDate);
  if (inn !== null && inn > 0) return FUTURE;

  return CURRENT;
}

// The same rule against a raw snake_case tenant_profiles row. Server code (the
// dashboard summary route, the occupancy recomputes) reads rows straight from
// Supabase without mapping them, so it needs this form.
export const statusForRow = (row, today = new Date()) =>
  statusFor({ moveInDate: row?.move_in_date, moveOutDate: row?.move_out_date }, today);

// Occupancy predicate: does this raw row count as occupying its unit today? This
// replaces the `.eq('status', 'current tenant')` filters the write routes used to
// push down into Postgres, which a derived status can no longer answer.
export const isCurrentRow = (row, today = new Date()) =>
  statusForRow(row, today) === CURRENT;
