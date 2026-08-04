// In-memory unit adapter — the second adapter that makes the seam real.
// Seed with { units, tenants } where tenants are raw rows carrying unit_id.
export function createFakeUnitAdapter(seed = {}) {
  const store = {
    units: [...(seed.units || [])],
    tenants: [...(seed.tenants || [])],
  };
  let n = 1;
  const adapter = {
    async insertUnit(row) {
      store.units.push({ ...row, id: `unit-${n++}` });
    },
    async updateUnit(id, patch) {
      const u = store.units.find((r) => r.id === id);
      if (!u) throw new Error(`updateUnit: ${id} not found`);
      Object.assign(u, patch);
    },
    async deleteUnit(id) {
      const i = store.units.findIndex((u) => u.id === id);
      if (i === -1) throw new Error(`deleteUnit: ${id} not found`);
      store.units.splice(i, 1);
    },
    async countTenantsInUnit(id) {
      return store.tenants.filter((t) => t.unit_id === id).length;
    },
  };
  return Object.assign(adapter, { _store: store });
}
