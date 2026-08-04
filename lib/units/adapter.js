// Real unit persistence adapter over the anon Supabase client (RLS-enforced).
export function createUnitAdapter(supabase) {
  const ok = (error, what) => { if (error) throw new Error(`${what}: ${error.message || error}`); };
  return {
    async insertUnit(row) {
      const { error } = await supabase.from("units").insert(row);
      ok(error, "insertUnit");
    },
    async updateUnit(id, patch) {
      const { error } = await supabase.from("units").update(patch).eq("id", id);
      ok(error, "updateUnit");
    },
    async deleteUnit(id) {
      const { error } = await supabase.from("units").delete().eq("id", id);
      ok(error, "deleteUnit");
    },
    // head:true + count:"exact" asks Postgrest for the count only, so this
    // stays a cheap pre-delete guard even on a unit with many tenants.
    async countTenantsInUnit(id) {
      const { count, error } = await supabase
        .from("tenant_profiles")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", id);
      ok(error, "countTenantsInUnit");
      return count || 0;
    },
  };
}
