// Real property persistence adapter over the anon Supabase client (RLS-enforced).
export function createPropertyAdapter(supabase) {
  const ok = (error, what) => { if (error) throw new Error(`${what}: ${error.message || error}`); };
  return {
    async insertProperty(row) {
      const { error } = await supabase.from("properties").insert(row);
      ok(error, "insertProperty");
    },
    async deleteProperty(id) {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      ok(error, "deleteProperty");
    },
    async updateProperty(id, patch) {
      const { error } = await supabase.from("properties").update(patch).eq("id", id);
      ok(error, "updateProperty");
    },
  };
}
