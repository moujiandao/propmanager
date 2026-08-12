// In-memory payments adapter. Mirrors what the real one does, including
// returning the number of rows the delete route actually removed -- that count
// is what lets core notice a delete that silently matched nothing.
export function createFakePaymentsAdapter(seed = {}) {
  const store = { payments: [...(seed.payments || [])] };
  const adapter = {
    async updatePayment(id, patch) {
      const p = store.payments.find((r) => r.id === id);
      if (!p) throw new Error(`updatePayment: ${id} not found`);
      Object.assign(p, patch);
    },
    async deletePayments(ids) {
      const before = store.payments.length;
      store.payments = store.payments.filter((p) => !ids.includes(p.id));
      return before - store.payments.length;
    },
  };
  return Object.assign(adapter, { _store: store });
}
