// In-memory adapter — accumulates upsert patches so tests can assert what would
// be written (and that field names were mapped to snake_case columns).
//
// It takes and stamps `landlordId` for the same reason the real adapter does.
// The previous fake accepted a patch with no landlord_id and recorded it
// happily, so it agreed with the core and disagreed with the database — which
// is why a write path that could never succeed had passing tests. A fake stands
// in for the thing it replaces, not for its caller.
export function createFakePaymentReminderAdapter(landlordId = "landlord-1") {
  if (!landlordId) throw new Error("createFakePaymentReminderAdapter: landlordId is required");
  const store = { patches: [], merged: {} };
  const adapter = {
    async upsertSettings(patch) {
      const row = { ...patch, landlord_id: landlordId };
      store.patches.push(row);
      Object.assign(store.merged, row);
    },
  };
  return Object.assign(adapter, { _store: store });
}
