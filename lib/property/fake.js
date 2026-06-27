// In-memory property adapter — the second adapter that makes the seam real.
export function createFakePropertyAdapter(seed = {}) {
  const store = { properties: [...(seed.properties || [])] };
  let n = 1;
  const adapter = {
    async insertProperty(row) {
      store.properties.push({ ...row, id: `prop-${n++}` });
    },
    async deleteProperty(id) {
      const i = store.properties.findIndex((p) => p.id === id);
      if (i === -1) throw new Error(`deleteProperty: ${id} not found`);
      store.properties.splice(i, 1);
    },
    async updateProperty(id, patch) {
      const p = store.properties.find((r) => r.id === id);
      if (!p) throw new Error(`updateProperty: ${id} not found`);
      Object.assign(p, patch);
    },
  };
  return Object.assign(adapter, { _store: store });
}
