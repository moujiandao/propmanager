// Real adapter over the anon Supabase client. Preserves the existing upsert
// semantics exactly (onConflict: landlord_id; the row's landlord_id is set by
// the DB/RLS, not in the patch — unchanged from the prior inline code).
export function createPaymentReminderAdapter(supabase) {
  return {
    async upsertSettings(patch) {
      const { error } = await supabase.from("email_settings").upsert(patch, { onConflict: "landlord_id" });
      if (error) throw new Error(`upsertSettings: ${error.message || error}`);
    },
  };
}
