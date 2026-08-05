// What stands between a tenant and being deleted.
//
// Deleting a tenant is blocked while any record still points at them, and the
// landlord is told which records and how many — the same shape as the unit
// delete guard. The alternative (cascade) was considered and rejected: a
// tenant's payment history is the books, and "previous tenant" already serves
// as the archive, so hard delete is for test rows and mistakes rather than for
// retiring someone with real history.
//
// One home for the list because two callers need it and must agree: the route
// runs the counts, the UI renders the labels. React-free + isomorphic.

// Order matters only for display — most consequential first, so the reason a
// delete is refused reads as the strongest one.
//
// `cascades` records whether the FK would clean the row up on its own. It is NOT
// permission to ignore it: parking_leases and contract_tenants cascade, so
// without an explicit block they'd be deleted silently, which is the outcome
// this guard exists to prevent. It's here so a future reader knows which of
// these are Postgres-enforced and which are ours alone.
export const TENANT_DELETE_BLOCKERS = [
  { key: "payments",     table: "payments",             column: "tenant_id", cascades: false },
  { key: "contracts",    table: "contract_tenants",     column: "tenant_id", cascades: true  },
  { key: "maintenance",  table: "maintenance_requests", column: "tenant_id", cascades: false },
  { key: "documents",    table: "documents",            column: "tenant_id", cascades: false },
  { key: "parkingLeases", table: "parking_leases",      column: "tenant_id", cascades: true  },
];

// Reduce a {key: count} map to just the things actually in the way, in display
// order. Missing and zero counts are both "nothing there" — a relation the
// route couldn't count (table absent on an older database) must not
// materialize as a phantom blocker.
export function summarizeBlockers(counts = {}) {
  return TENANT_DELETE_BLOCKERS
    .filter(b => (counts[b.key] || 0) > 0)
    .map(b => ({ key: b.key, count: counts[b.key] }));
}

// Is this tenant deletable? Kept as its own export so the route reads as intent
// rather than as an array-length check.
export const isDeletable = (counts = {}) => summarizeBlockers(counts).length === 0;
