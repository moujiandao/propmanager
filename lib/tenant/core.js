// Tenant self-service profile writes, React-free. These are the direct
// tenant_profiles updates the tenant portal makes (payment prefs + display name).
// The heavier create/update/delete-tenant operations are landlord actions that
// already live behind server routes; this slice covers the scattered direct
// client writes. Adapter-injected so the writes are testable without a database.

// Toggle/set the tenant's recurring-payment preference. Returns the new value.
export async function setRecurringPayment(adapter, tenantId, value) {
  await adapter.updateProfile(tenantId, { recurring_payment: value });
  return value;
}

// Mark the tenant's bank as connected.
export async function setBankConnected(adapter, tenantId) {
  await adapter.updateProfile(tenantId, { bank_connected: true });
  return true;
}

// Landlord confirms a move-in / move-out actually happened, which is what lets
// the dashboard stop showing it. A landlord write rather than a tenant one, but
// it belongs here for the same reason the others do: it's a direct
// tenant_profiles column write from the client, and RLS
// (tenant_profiles_team_modify) already scopes it to the landlord's team.
//
// Acknowledging is idempotent and one-way — the timestamp of the FIRST
// confirmation is kept, so double-clicking the button can't rewrite when the
// landlord actually confirmed it. There is deliberately no un-acknowledge: if a
// move-in didn't happen, the fix is to change the move-in date, which is the
// same single source of truth every other status rule reads.
export async function acknowledgeMoveIn(adapter, tenantId, { alreadyAckedAt = null, now = new Date().toISOString() } = {}) {
  if (alreadyAckedAt) return alreadyAckedAt;
  await adapter.updateProfile(tenantId, { move_in_acked_at: now });
  return now;
}

export async function acknowledgeMoveOut(adapter, tenantId, { alreadyAckedAt = null, now = new Date().toISOString() } = {}) {
  if (alreadyAckedAt) return alreadyAckedAt;
  await adapter.updateProfile(tenantId, { move_out_acked_at: now });
  return now;
}

// Update the tenant's display name. Trims; rejects empty. Returns the trimmed name.
export async function updateDisplayName(adapter, tenantId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Name is empty.");
  await adapter.updateProfile(tenantId, { name: trimmed });
  return trimmed;
}
