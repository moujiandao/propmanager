// Unit writes behind the per-entity data-access seam. React-free,
// adapter-injected. Covers the create/edit/delete that PropertyDetailPage used
// to do with inline `supabase.from("units")` calls.

// Thrown by deleteUnit when tenants still point at the unit. Carries `count` so
// the caller can render a localized message without parsing the string.
export class UnitHasTenantsError extends Error {
  constructor(count) {
    super(`deleteUnit: ${count} tenant(s) still assigned to this unit`);
    this.name = "UnitHasTenantsError";
    this.code = "UNIT_HAS_TENANTS";
    this.count = count;
  }
}

// Shared shaping for the fields create and edit both write. Bedrooms/bathrooms
// are integer columns and default to 1 (matching the schema default) rather
// than null, so a blank input can't produce a unit with no bedroom count.
// monthly_rent is nullable — blank means "not set", not zero.
function unitFields({ unitNumber, bedrooms, bathrooms, monthlyRent }) {
  const trimmed = (unitNumber || "").trim();
  if (!trimmed) throw new Error("unit number is required");
  const rent = parseFloat(monthlyRent);
  return {
    unit_number: trimmed,
    bedrooms: parseInt(bedrooms, 10) || 1,
    bathrooms: parseInt(bathrooms, 10) || 1,
    monthly_rent: Number.isFinite(rent) ? rent : null,
  };
}

// Create a unit under a property.
//
// `status` is deliberately NOT written. Occupancy is derived from the unit's
// tenants on read, so persisting a status here would be a second source of
// truth that the next fetch silently overwrites. The DB column default
// ('vacant') keeps the column non-null for external SQL.
export async function createUnit(adapter, { propertyId, unitNumber, bedrooms, bathrooms, monthlyRent }) {
  if (!propertyId) throw new Error("createUnit: propertyId is required");
  await adapter.insertUnit({
    property_id: propertyId,
    ...unitFields({ unitNumber, bedrooms, bathrooms, monthlyRent }),
  });
}

// Edit a unit's own fields. Deliberately narrow, same rationale as
// `updateSpot` in lib/parking: property_id is NOT editable. Moving a unit to
// another property would strand every tenant, document, and transition row that
// references it against a building it no longer belongs to. Delete and recreate
// instead. `status` is omitted for the reason given on createUnit.
export async function updateUnit(adapter, id, { unitNumber, bedrooms, bathrooms, monthlyRent }) {
  if (!id) throw new Error("updateUnit: id is required");
  await adapter.updateUnit(id, unitFields({ unitNumber, bedrooms, bathrooms, monthlyRent }));
}

// Delete a unit, but only once nothing is assigned to it.
//
// The tenant count is re-read through the adapter rather than trusted from the
// caller's already-loaded `data.tenants`: that client state can be minutes
// stale, and a stale zero would delete a unit that someone has since been moved
// into. The UI may still use its local count for the *advisory* text in the
// confirm dialog; this is the check that actually decides.
//
// Blocks on ANY linked tenant, not just current ones — a previous tenant's
// unit_id is what the Unit Transitions dashboard and housemate detection read,
// so nulling it to allow a delete would lose history silently.
export async function deleteUnit(adapter, id) {
  if (!id) throw new Error("deleteUnit: id is required");
  const count = await adapter.countTenantsInUnit(id);
  if (count > 0) throw new UnitHasTenantsError(count);
  await adapter.deleteUnit(id);
}
