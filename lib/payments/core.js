// Payment writes. React-free, adapter-injected -- mirrors lib/parking/core.js.

import { isValidPaymentStatus, isValidPaymentType } from "./status.js";

// Money is stored numeric. Blank is rejected separately from non-numeric,
// because Number("") is 0 -- an emptied field would otherwise sail through as a
// deliberate zero and quietly rewrite what a tenant owes. A typed 0 is still
// legal; the month grid records $0 rows for tenants with no rent set.
//
// Negative is rejected outright: a refund is its own record, not a payment with
// a minus sign.
function normalizeAmount(amount) {
  if (amount === "" || amount == null) throw new Error("updatePayment: amount is required");
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error("updatePayment: amount must be a number of 0 or more");
  return n;
}

// Edit a payment's own terms. Deliberately narrow.
//
// tenant_id and contract_id are NOT editable: a payment belongs to whoever made
// it, and re-pointing one at a different tenant rewrites two people's ledgers at
// once rather than correcting anything. Delete and re-record instead -- the same
// rule updateSpot follows for a spot's property.
//
// ach_status is not editable either. Stripe's webhook owns it, so a hand-edited
// value would be overwritten without warning the next time the webhook fires,
// which is worse than not offering the field.
export async function updatePayment(adapter, id, { amount, dueDate, paidDate, status, type }) {
  if (!dueDate) throw new Error("updatePayment: dueDate is required");
  if (!isValidPaymentStatus(status)) throw new Error(`updatePayment: invalid status "${status}"`);
  if (!isValidPaymentType(type)) throw new Error(`updatePayment: invalid type "${type}"`);
  // paid_date is deliberately NOT constrained against due_date. Paying late is
  // the normal case and paying early is legal, so there is no ordering rule to
  // enforce -- and a completed payment with no paid date at all is exactly what
  // the month grid's checkbox produces.

  await adapter.updatePayment(id, {
    amount: normalizeAmount(amount),
    due_date: dueDate,
    paid_date: paidDate || null,
    status,
    type: (type || "").trim() || null,
  });
}

// Remove a payment record. Goes through the same bulk route the month grid's
// uncheck already uses, so there is one server-side delete path for payments
// rather than two that could drift.
export async function deletePayment(adapter, id) {
  const removed = await adapter.deletePayments([id]);
  if (removed !== 1) throw new Error(`deletePayment: expected to remove 1 row, removed ${removed}`);
}
