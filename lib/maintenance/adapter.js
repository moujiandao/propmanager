// Real persistence adapter: satisfies the narrow domain interface the core
// needs, backed by the browser (anon-key) Supabase client + the maintenance
// API routes. RLS / is_team_member stays the security boundary — this adapter
// does not change where auth lives, it only hides the table names, snake_case,
// and the client-vs-route split from callers.
//
// The interface (the set of methods below) is the seam. fake.js implements the
// same one in memory for tests.

export function createSupabaseAdapter(supabase, {
  fetchImpl = (...a) => fetch(...a),
  translateUrl = "/api/maintenance/translate",
  createUrl = "/api/maintenance/create",
} = {}) {
  const ok = (error, what) => { if (error) throw new Error(`${what}: ${error.message || error}`); };

  return {
    async insertComment(row) {
      const { data, error } = await supabase.from("maintenance_comments").insert(row).select().single();
      ok(error, "insertComment");
      if (!data) throw new Error("insertComment: no row returned");
      return data;
    },
    async updateComment(id, patch) {
      const { error } = await supabase.from("maintenance_comments").update(patch).eq("id", id);
      ok(error, "updateComment");
    },
    async deleteComment(id) {
      const { error } = await supabase.from("maintenance_comments").delete().eq("id", id);
      ok(error, "deleteComment");
    },
    async updateRequest(id, patch) {
      const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", id);
      ok(error, "updateRequest");
    },
    async insertRequest(row) {
      const { data, error } = await supabase.from("maintenance_requests").insert(row).select().single();
      ok(error, "insertRequest");
      if (!data) throw new Error("insertRequest: no row returned");
      return data;
    },
    async insertType(row) {
      const { data, error } = await supabase.from("maintenance_types").insert(row).select().single();
      ok(error, "insertType");
      if (!data) throw new Error("insertType: no row returned");
      return data;
    },
    async translate(text, landlordId) {
      const res = await fetchImpl(translateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, landlordId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "translate failed");
      return json.translation || "";
    },
    async createRequest(formData) {
      const res = await fetchImpl(createUrl, { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      return json;
    },
  };
}
