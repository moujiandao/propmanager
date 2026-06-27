// Real tenant persistence adapter over the anon Supabase client (RLS-enforced).
// Narrow domain interface (updateProfile) — fake.js implements the same one in
// memory for tests.
export function createTenantAdapter(supabase) {
  return {
    async updateProfile(id, patch) {
      const { error } = await supabase.from("tenant_profiles").update(patch).eq("id", id);
      if (error) throw new Error(`updateProfile: ${error.message || error}`);
    },
  };
}
