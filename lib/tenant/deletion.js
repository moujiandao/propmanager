// What stands between a tenant and being deleted.
//
// Deleting a tenant is blocked while any record still points at them, and the
// landlord is told which records and how many — the same shape as the unit
// delete guard. The alternative (cascade) was considered and rejected: a
// tenant's payment history is the books, and "previous tenant" already serves
// as the archive, so hard delete is for test rows and mistakes rather than for
// retiring someone with real history.
//
// One home for the list because three callers need it and must agree: the route
// runs the counts, the UI pre-counts the same relations to warn before the red
// button, and the UI renders the labels. React-free + isomorphic.

// Order matters only for display — most consequential first, so the reason a
// delete is refused reads as the strongest one.
//
// `cascades` records whether the FK would clean the row up on its own. It is NOT
// permission to ignore it: parking_leases and contract_tenants cascade, so
// without an explicit block they'd be deleted silently, which is the outcome
// this guard exists to prevent. It's here so a future reader knows which of
// these are Postgres-enforced and which are ours alone.
//
// `collection`/`countIn` are the same relation seen from the client: the loaded
// `data` key, and how a row there points at the tenant. Every relation but
// contracts carries a plain `tenantId`; contracts arrive already folded into a
// `tenantIds` array by `mapContract`, so it needs its own matcher.
const byTenantId = (row, tenantId) => row.tenantId === tenantId;

export const TENANT_DELETE_BLOCKERS = [
  { key: "payments",      table: "payments",             column: "tenant_id", cascades: false, collection: "payments",      countIn: byTenantId },
  { key: "contracts",     table: "contract_tenants",     column: "tenant_id", cascades: true,  collection: "contracts",     countIn: (row, tenantId) => (row.tenantIds || []).includes(tenantId) },
  { key: "maintenance",   table: "maintenance_requests", column: "tenant_id", cascades: false, collection: "maintenance",   countIn: byTenantId },
  { key: "documents",     table: "documents",            column: "tenant_id", cascades: false, collection: "documents",     countIn: byTenantId },
  { key: "parkingLeases", table: "parking_leases",       column: "tenant_id", cascades: true,  collection: "parkingLeases", countIn: byTenantId },
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

// The same question answered from the client's already-loaded `data`, so the
// modal can say what's in the way *before* offering a red Delete button instead
// of after the server refuses.
//
// Advisory only, exactly like the unit delete guard: this reads a snapshot that
// can be stale or RLS-narrowed, so it can undercount but must never be trusted
// as permission. The route re-counts server-side and stays the authority — an
// empty result here means "nothing known to block", not "safe to delete".
export function blockersFromData(data = {}, tenantId) {
  if (!tenantId) return [];
  const counts = {};
  for (const b of TENANT_DELETE_BLOCKERS) {
    const rows = data[b.collection] || [];
    counts[b.key] = rows.filter(row => b.countIn(row, tenantId)).length;
  }
  return summarizeBlockers(counts);
}
