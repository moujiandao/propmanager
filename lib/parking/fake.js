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
    async createLease({ landlord_id, parking_spot_id, rate, start_date, end_date, tenant_id, renter_id, renter }) {
      let resolvedRenterId = renter_id || null;
      if (!tenant_id && !resolvedRenterId) {
        const newRenter = { ...renter, id: `renter-${n++}`, landlord_id };
        store.parking_renters.push(newRenter);
        resolvedRenterId = newRenter.id;
      }
      const lease = {
        id: `lease-${n++}`,
        landlord_id,
        parking_spot_id,
        tenant_id: tenant_id || null,
        renter_id: resolvedRenterId,
        rate,
        start_date,
        end_date: end_date || null,
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
