// Parking writes. React-free, adapter-injected -- mirrors lib/property/core.js.

const MARKET_STATUSES = ["tenant_priority", "open_market"];

export async function createSpot(adapter, { landlordId, propertyId, label, type, monthlyRate }) {
  await adapter.insertSpot({
    landlord_id: landlordId,
    property_id: propertyId,
    label,
    // Optional free-text layout description; trimmed, empty -> null so the column
    // holds either a real value or nothing (never a blank string to filter on).
    type: (type || "").trim() || null,
    monthly_rate: monthlyRate === "" || monthlyRate == null ? null : Number(monthlyRate),
  });
}

// Edit a spot's own fields. Deliberately narrow: label, type, and rate only.
// property_id is NOT editable -- moving a spot between properties would orphan
// any lease history against a lot it no longer belongs to, and the unique
// (property_id, label) constraint could collide on arrival. Delete and recreate
// instead. market_status has its own op above; it's a toggle, not a form field.
export async function updateSpot(adapter, id, { label, type, monthlyRate }) {
  const trimmedLabel = (label || "").trim();
  if (!trimmedLabel) throw new Error("updateSpot: label is required");
  await adapter.updateSpot(id, {
    label: trimmedLabel,
    type: (type || "").trim() || null,
    monthly_rate: monthlyRate === "" || monthlyRate == null ? null : Number(monthlyRate),
  });
}

export async function setMarketStatus(adapter, id, marketStatus) {
  if (!MARKET_STATUSES.includes(marketStatus)) {
    throw new Error(`setMarketStatus: invalid market_status "${marketStatus}"`);
  }
  await adapter.updateSpot(id, { market_status: marketStatus });
}

export async function deleteSpot(adapter, id) {
  await adapter.deleteSpot(id);
}

// A lease belongs to exactly one of: an existing tenant (tenantId), an
// existing market renter (renterId), or a brand-new market renter (renter:
// {name,email,phone}) that gets created alongside the lease. The DB's CHECK
// constraint is the real guarantee; this check just fails fast with a
// readable message before making a network call.
export async function createLease(adapter, { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter }) {
  const targets = [tenantId, renterId, renter].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error("createLease: exactly one of tenantId, renterId, or renter is required");
  }
  return adapter.createLease({
    landlord_id: landlordId,
    parking_spot_id: parkingSpotId,
    rate: Number(rate),
    start_date: startDate,
    end_date: endDate || null,
    tenant_id: tenantId || null,
    renter_id: renterId || null,
    renter: renter || null,
  });
}

// End a lease early (or set its scheduled end date) by writing end_date.
// Occupancy is derived from this via lib/parking/status.js -- no separate
// status column to keep in sync.
export async function endLease(adapter, id, endDate) {
  await adapter.updateLease(id, { end_date: endDate });
}
