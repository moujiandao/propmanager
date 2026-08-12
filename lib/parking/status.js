// Whether a parking lease is active is DERIVED from its start/end dates, not
// stored as a column -- same reasoning as lib/tenant/status.js: a stored
// status column drifting from the real dates is a recurring bug class in this
// app, and a lease's dates are the only truth that matters. React-free +
// isomorphic (client monolith + server routes both import it).

import { daysBetween } from "../format/index.js";

// The spot-type vocabulary. One home shared by the UI dropdown and the core's
// write validation, so the two can't drift -- same pattern as
// lib/maintenance/status.js's WRITE_STATUSES.
//
// Enforced in JS rather than as a DB CHECK constraint on purpose: adding a
// fourth layout stays a one-line change here instead of a migration, and the
// existing rows keep working either way. Type is optional, so "" is valid.
export const SPOT_TYPES = [
  "right side (diagonal)",
  "back side (straight)",
  "left side (straight)",
];

export const isValidSpotType = (type) => !type || SPOT_TYPES.includes(type);

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

// Who a spot is let to: "tenant", "renter", or null when it is vacant.
//
// This replaced a stored `market_status` column on parking_spots that the
// landlord toggled by hand. It drifted, exactly the way stored status always
// does here: spots sat labelled "Open Market" while their live lease was to a
// tenant. The lease already knows -- its CHECK guarantees exactly one of
// tenant_id/renter_id is set -- so reading it is the only way the label can be
// wrong only when the lease is wrong.
//
// The cost, taken deliberately: a vacant spot has no lease, so there is no
// longer any way to record that one is *offered* to the market before somebody
// takes it. That was the flag's honest purpose; if it's wanted back it belongs
// as its own "listed" field, not as a status that pretends to describe the
// current letting.
export const leaseParty = (lease) => {
  if (!lease) return null;
  if (lease.tenantId) return "tenant";
  if (lease.renterId) return "renter";
  return null;
};
