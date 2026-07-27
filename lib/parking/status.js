// Whether a parking lease is active is DERIVED from its start/end dates, not
// stored as a column -- same reasoning as lib/tenant/status.js: a stored
// status column drifting from the real dates is a recurring bug class in this
// app, and a lease's dates are the only truth that matters. React-free +
// isomorphic (client monolith + server routes both import it).

import { daysBetween } from "../format/index.js";

// A lease counts as active through the whole of its end date and starting on
// its start date. A null end_date means "ongoing" (month-to-month).
export function isActiveLease({ startDate, endDate } = {}, today = new Date()) {
  const untilStart = daysBetween(today, startDate);
  if (untilStart !== null && untilStart > 0) return false;

  const untilEnd = daysBetween(today, endDate);
  if (untilEnd !== null && untilEnd < 0) return false;

  return true;
}

// Is this spot currently leased, given all leases for it?
export const isSpotLeased = (leases, today = new Date()) =>
  leases.some((l) => isActiveLease(l, today));

// The active lease for a spot, if any (a spot should have at most one, thanks
// to the DB's overlap-exclusion constraint).
export const activeLeaseForSpot = (leases, today = new Date()) =>
  leases.find((l) => isActiveLease(l, today)) || null;
