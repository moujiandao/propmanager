// In-memory tenant adapter — the second adapter that makes the seam real.
export function createFakeTenantAdapter(seed = {}) {
  const store = { profiles: [...(seed.profiles || [])] };
  const adapter = {
    async updateProfile(id, patch) {
      const r = store.profiles.find((p) => p.id === id);
      if (!r) throw new Error(`updateProfile: ${id} not found`);
      Object.assign(r, patch);
    },
  };
  return Object.assign(adapter, { _store: store });
}
