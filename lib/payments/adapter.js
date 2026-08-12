// Real payments persistence adapter.
//
// The update is a plain RLS-protected write over the anon client, matching the
// insert the month grid already does. The delete goes through
// /api/payments/delete instead -- that route existed first, the grid's uncheck
// already uses it, and routing both through it keeps one server-side delete
// path rather than two that could drift.
export function createPaymentsAdapter(supabase) {
  return {
    async updatePayment(id, patch) {
      const { error } = await supabase.from("payments").update(patch).eq("id", id);
      if (error) throw new Error(`updatePayment: ${error.message || error}`);
    },
    async deletePayments(ids) {
      const res = await fetch("/api/payments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "deletePayments failed");
      return json.deletedCount ?? 0;
    },
  };
}
