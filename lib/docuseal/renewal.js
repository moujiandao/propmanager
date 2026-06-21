// Renewal term derivation — the single source of truth shared by the create
// route (server) and RenewalsPage (client) so the two never drift. All math is
// UTC-based on YYYY-MM-DD strings to avoid the local-timezone off-by-one that
// `new Date("2026-06-30T00:00:00")` (local midnight) introduces in negative-UTC
// regions. Pure functions only — no env, no I/O.

// Adds `days` to an ISO date string (YYYY-MM-DD). Returns ISO date or null.
export function addDays(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Adds `months` calendar months to an ISO date string, clamping the day to the
// target month's length (e.g. Jan 31 + 1mo -> Feb 28). Returns ISO date or null.
export function addMonths(isoDate, months) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return result.toISOString().slice(0, 10);
}

// Next renewal term from a contract's current end_date:
// new term starts the day after the current term ends and runs 12 months.
export function deriveRenewalTerm(endDateIso) {
  if (!endDateIso) return { newTermStart: null, newTermEnd: null };
  const newTermStart = addDays(endDateIso, 1);
  return { newTermStart, newTermEnd: addMonths(newTermStart, 12) };
}

// The immutable "X date" the addendum references. Canonical rule: the
// chronologically FIRST renewal in the chain (earliest created_at) holds the
// true original_lease_date; fall back to the contract's own start date when no
// prior renewal exists. Accepts rows in either snake or camel case.
export function pickOriginalLeaseDate(renewalRows, fallbackStartDate) {
  const rows = (renewalRows || [])
    .map((r) => ({
      original: r.originalLeaseDate ?? r.original_lease_date ?? null,
      createdAt: r.createdAt ?? r.created_at ?? null,
    }))
    .filter((r) => r.original)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return rows.length ? rows[0].original : fallbackStartDate || null;
}
