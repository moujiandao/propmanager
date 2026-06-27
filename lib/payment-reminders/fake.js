// In-memory adapter — accumulates upsert patches so tests can assert what would
// be written (and that field names were mapped to snake_case columns).
export function createFakePaymentReminderAdapter() {
  const store = { patches: [], merged: {} };
  const adapter = {
    async upsertSettings(patch) {
      store.patches.push(patch);
      Object.assign(store.merged, patch);
    },
  };
  return Object.assign(adapter, { _store: store });
}
