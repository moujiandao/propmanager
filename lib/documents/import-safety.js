// Small, adapter-backed safety checks for the reviewed document import. Keeping
// these outside the route lets the failure paths be exercised without an Auth
// service or a live Supabase project.

export async function validateLeaseAssignment(adapter, { landlordId, propertyId, unitId }) {
  if (propertyId) {
    const property = await adapter.findPropertyForLandlord(propertyId, landlordId);
    if (!property) throw new Error("Selected property was not found for this team.");
  }
  if (!unitId) return null;
  if (!propertyId) throw new Error("Select the property before assigning a unit.");
  const unit = await adapter.findUnit(unitId);
  if (!unit || unit.property_id !== propertyId) {
    throw new Error("Selected unit does not belong to the selected property.");
  }
  return unit.unit_number;
}

export function oneTenantMatch(rows, name) {
  if (rows?.length > 1) {
    throw new Error(`More than one tenant matches "${name}". Review and resolve the duplicate profiles first.`);
  }
  return rows?.[0] || null;
}

// The profile must go first because it has the foreign key to auth.users. A
// failed compensation is deliberately surfaced to the caller, not swallowed as
// though the import left no records behind.
export async function cleanupCreatedTenantAccounts(adapter, tenantIds) {
  const ids = [...new Set(tenantIds.filter(Boolean))];
  if (!ids.length) return;
  await adapter.deleteTenantProfiles(ids);
  const failures = [];
  for (const tenantId of ids) {
    try {
      await adapter.deleteAuthUser(tenantId);
    } catch (error) {
      failures.push(error.message || String(error));
    }
  }
  if (failures.length) throw new Error(`Created tenant cleanup could not remove every auth user: ${failures.join('; ')}`);
}
