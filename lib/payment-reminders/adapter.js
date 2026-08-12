// Real adapter over the anon Supabase client.
//
// `landlordId` is required and stamped into every patch. It used to be omitted,
// on the belief that "the row's landlord_id is set by the DB/RLS". It is not:
// RLS *checks* landlord_id, it does not supply one, and there is no column
// default. So every write inserted a row with a null landlord_id, failed
// `is_team_member(null)`, and came back 403 — the toggle flipped optimistically
// and then rolled back a second later. It also meant `onConflict: landlord_id`
// could never match an existing row, so this was an insert every time.
//
// This is the TEAM id (landlord_profiles.id / user.id), never the auth user id.
export function createPaymentReminderAdapter(supabase, landlordId) {
  if (!landlordId) throw new Error("createPaymentReminderAdapter: landlordId is required");
  return {
    async upsertSettings(patch) {
      const { error } = await supabase
        .from("email_settings")
        .upsert({ ...patch, landlord_id: landlordId }, { onConflict: "landlord_id" });
      if (error) throw new Error(`upsertSettings: ${error.message || error}`);
    },
  };
}
