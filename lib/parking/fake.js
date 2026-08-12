// In-memory parking adapter -- the second adapter that makes the seam real.
// createLease mirrors what app/api/parking/leases/create does server-side
// (create the renter row first for a brand-new market renter, then the
// lease), so core.js's behavior can be tested without a network call.
export function createFakeParkingAdapter(seed = {}) {
  const store = {
    parking_spots: [...(seed.parking_spots || [])],
    parking_renters: [...(seed.parking_renters || [])],
    parking_leases: [...(seed.parking_leases || [])],
  };
  let n = 1;
  const adapter = {
    async insertSpot(row) {
      store.parking_spots.push({ market_status: "tenant_priority", ...row, id: `spot-${n++}` });
    },
    async updateSpot(id, patch) {
      const s = store.parking_spots.find((r) => r.id === id);
      if (!s) throw new Error(`updateSpot: ${id} not found`);
      Object.assign(s, patch);
    },
    async deleteSpot(id) {
      const i = store.parking_spots.findIndex((s) => s.id === id);
      if (i === -1) throw new Error(`deleteSpot: ${id} not found`);
      store.parking_spots.splice(i, 1);
    },
    // Mirrors app/api/parking/leases/create: it receives the camelCase JSON
    // body the route parses, and writes the snake_case row the route inserts.
    // Keeping both shapes honest here is the point -- an earlier version of
    // this fake accepted the core's payload as-is, which let a camelCase /
    // snake_case mismatch with the real route go unnoticed.
    async createLease({ landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear }) {
      if (!landlordId) throw new Error("createLease: landlordId is required");
      if (!parkingSpotId) throw new Error("createLease: parkingSpotId is required");
      if (!startDate) throw new Error("createLease: startDate is required");

      let resolvedRenterId = renterId || null;
      if (!tenantId && !resolvedRenterId) {
        const newRenter = { ...renter, id: `renter-${n++}`, landlord_id: landlordId };
        store.parking_renters.push(newRenter);
        resolvedRenterId = newRenter.id;
      }
      const lease = {
        id: `lease-${n++}`,
        landlord_id: landlordId,
        parking_spot_id: parkingSpotId,
        tenant_id: tenantId || null,
        renter_id: resolvedRenterId,
        rate,
        start_date: startDate,
        end_date: endDate || null,
        car_make: carMake ?? null,
        car_model: carModel ?? null,
        car_year: carYear ?? null,
      };
      store.parking_leases.push(lease);
      return { lease };
    },
    async updateLease(id, patch) {
      const l = store.parking_leases.find((r) => r.id === id);
      if (!l) throw new Error(`updateLease: ${id} not found`);
      Object.assign(l, patch);
    },
  };
  return Object.assign(adapter, { _store: store });
}
