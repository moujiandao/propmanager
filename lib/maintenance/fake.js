// In-memory adapter satisfying the same interface as createSupabaseAdapter.
// This is the second adapter that makes the seam real: the core's entire write
// surface is exercised against this in tests, with no database.

export function createFakeAdapter(seed = {}) {
  const store = {
    comments: [...(seed.comments || [])],
    requests: [...(seed.requests || [])],
    attachments: [...(seed.attachments || [])],
    types: [...(seed.types || [])],
    translateWith: seed.translateWith || ((text) => `[zh] ${text}`),
  };
  let n = seed.startId || 1;
  const nextId = () => `id-${n++}`;
  const find = (arr, id) => arr.find((r) => r.id === id);

  const adapter = {
    async insertComment(row) {
      const created = { ...row, id: nextId(), created_at: `2026-01-0${store.comments.length + 1}T00:00:00Z` };
      store.comments.push(created);
      return created;
    },
    async updateComment(id, patch) {
      const r = find(store.comments, id);
      if (!r) throw new Error(`updateComment: ${id} not found`);
      Object.assign(r, patch);
    },
    async deleteComment(id) {
      const i = store.comments.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`deleteComment: ${id} not found`);
      store.comments.splice(i, 1);
    },
    async updateRequest(id, patch) {
      const r = find(store.requests, id);
      if (!r) throw new Error(`updateRequest: ${id} not found`);
      Object.assign(r, patch);
    },
    async deleteRequest(id) {
      const k = store.requests.findIndex((r) => r.id === id);
      if (k === -1) throw new Error(`deleteRequest: ${id} not found`);
      store.requests.splice(k, 1);
      // Mirrors the database's ON DELETE CASCADE so a test sees the same
      // aftermath the real schema produces.
      store.comments = store.comments.filter((c) => c.maintenance_request_id !== id);
      store.attachments = (store.attachments || []).filter((a) => a.maintenance_request_id !== id);
    },
    async removeFiles(paths) {
      store.removedFiles = [...(store.removedFiles || []), ...paths];
    },
    async insertRequest(row) {
      const created = { ...row, id: nextId(), created_at: "2026-01-01T00:00:00Z" };
      store.requests.push(created);
      return created;
    },
    async insertType(row) {
      const created = { ...row, id: nextId() };
      store.types.push(created);
      return created;
    },
    async translate(text) {
      return store.translateWith(text);
    },
    async createRequest(formData) {
      return { ok: true, formData };
    },
  };

  // Expose the store for assertions.
  return Object.assign(adapter, { _store: store });
}
