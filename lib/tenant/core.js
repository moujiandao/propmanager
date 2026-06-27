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

// Update the tenant's display name. Trims; rejects empty. Returns the trimmed name.
export async function updateDisplayName(adapter, tenantId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Name is empty.");
  await adapter.updateProfile(tenantId, { name: trimmed });
  return trimmed;
}
