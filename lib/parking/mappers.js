// The one home for the camelCase shape of parking_spots / parking_renters /
// parking_leases rows.
export const mapParkingSpot = (s) => ({
  id: s.id,
  landlordId: s.landlord_id,
  propertyId: s.property_id,
  label: s.label,
  // Layout description drawn from SPOT_TYPES (lib/parking/status.js). Normalized
  // to "" so the UI can render it and bind a <Sel> without null checks.
  type: s.type || "",
  marketStatus: s.market_status || "tenant_priority",
  createdAt: s.created_at || null,
  updatedAt: s.updated_at || null,
});

export const mapParkingRenter = (r) => ({
  id: r.id,
  landlordId: r.landlord_id,
  name: r.name,
  email: r.email || "",
  phone: r.phone || "",
  notes: r.notes || "",
  createdAt: r.created_at || null,
});

export const mapParkingLease = (l) => ({
  id: l.id,
  landlordId: l.landlord_id,
  parkingSpotId: l.parking_spot_id,
  tenantId: l.tenant_id || null,
  renterId: l.renter_id || null,
  rate: l.rate,
  startDate: l.start_date,
  endDate: l.end_date || null,
  // The vehicle belongs to the agreement, not the asphalt: it arrives with a
  // lease and leaves with it. Text normalized to "" so the edit modal can bind
  // an <Inp>; year stays null so a missing year never renders as 0.
  carMake: l.car_make || "",
  carModel: l.car_model || "",
  carYear: l.car_year ?? null,
  createdAt: l.created_at || null,
  updatedAt: l.updated_at || null,
});
