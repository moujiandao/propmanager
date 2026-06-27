// Property writes that the client makes directly (create, delete, drive-link).
// Edit + image-upload are landlord actions already behind server routes and stay
// there; this slice covers the scattered direct client writes. React-free,
// adapter-injected.

// Create a property for a landlord. Coerces units to a number, matching the
// prior inline behavior (`+form.units`).
export async function createProperty(adapter, { landlordId, address, city, state, zip, units, type, status }) {
  await adapter.insertProperty({
    landlord_id: landlordId,
    address, city, state, zip,
    units: Number(units),
    type, status,
  });
}

// Delete a property by id.
export async function deleteProperty(adapter, id) {
  await adapter.deleteProperty(id);
}

// Set (or clear) a property's Google Drive link. Trims; empty -> null. Returns
// the stored value (trimmed string or null).
export async function setDriveLink(adapter, id, link) {
  const value = (link || "").trim() || null;
  await adapter.updateProperty(id, { drive_link: value });
  return value;
}
