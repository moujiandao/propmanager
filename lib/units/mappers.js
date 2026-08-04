// The one home for the camelCase shape of a `units` row.
//
// NOTE on `status`: the stored column is effectively READ-ONLY as far as the UI
// is concerned. `fetchAllData` overwrites it with occupancy derived from the
// unit's tenants (same rule the server routes apply via `isCurrentRow`), so the
// value mapped here is only what the DB last happened to persist. Nothing in
// the write path sets it — see the note on `createUnit` in core.js.
export const mapUnit = (u) => ({
  id: u.id,
  propertyId: u.property_id,
  unitNumber: u.unit_number,
  bedrooms: u.bedrooms,
  bathrooms: u.bathrooms,
  monthlyRent: u.monthly_rent,
  status: u.status,
});
