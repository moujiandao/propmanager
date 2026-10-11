import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePaymentsAdapter } from "./fake.js";
import { updatePayment, deletePayment } from "./core.js";
import { mapPayment } from "./mappers.js";
import { PAYMENT_STATUSES, PAYMENT_TYPES, isValidPaymentStatus, isValidPaymentType, isPaid } from "./status.js";

const seed = () => createFakePaymentsAdapter({
  payments: [{ id: "p1", tenant_id: "t1", contract_id: "c1", amount: 1200, due_date: "2026-08-01", paid_date: null, status: "pending", type: "recurring", ach_status: null }],
});

test("updatePayment writes snake_case columns and coerces the amount to a number", async () => {
  const a = seed();
  await updatePayment(a, "p1", { amount: "1350.5", dueDate: "2026-09-01", paidDate: "2026-09-03", status: "completed", type: "one-time" });
  const row = a._store.payments[0];
  assert.equal(row.amount, 1350.5);
  assert.equal(typeof row.amount, "number");
  assert.equal(row.due_date, "2026-09-01");
  assert.equal(row.paid_date, "2026-09-03");
  assert.equal(row.status, "completed");
  assert.equal(row.type, "one-time");
});

test("a completed payment may have no paid date — that is what the month grid produces", async () => {
  const a = seed();
  await updatePayment(a, "p1", { amount: "1200", dueDate: "2026-08-01", paidDate: "", status: "completed", type: "recurring" });
  assert.equal(a._store.payments[0].paid_date, null, "blank paid date is null, not an empty string");
});

test("paying early or late is legal — there is no ordering rule between the dates", async () => {
  const a = seed();
  await updatePayment(a, "p1", { amount: "1200", dueDate: "2026-08-01", paidDate: "2026-07-20", status: "completed", type: "recurring" });
  assert.equal(a._store.payments[0].paid_date, "2026-07-20");
  await updatePayment(a, "p1", { amount: "1200", dueDate: "2026-08-01", paidDate: "2026-11-30", status: "completed", type: "recurring" });
  assert.equal(a._store.payments[0].paid_date, "2026-11-30");
});

test("updatePayment rejects a bad amount, a missing due date, and off-list values", async () => {
  const a = seed();
  const good = { amount: "1200", dueDate: "2026-08-01", status: "pending", type: "recurring" };

  // Blank is its own case: Number("") is 0, so without an explicit check an
  // emptied field would sail through as a deliberate zero.
  await assert.rejects(() => updatePayment(a, "p1", { ...good, amount: "" }), /amount is required/);
  await assert.rejects(() => updatePayment(a, "p1", { ...good, amount: null }), /amount is required/);
  await assert.rejects(() => updatePayment(a, "p1", { ...good, amount: "abc" }), /amount must be a number/);
  // A refund is its own record, not a payment with a minus sign.
  await assert.rejects(() => updatePayment(a, "p1", { ...good, amount: "-50" }), /amount must be a number/);
  await assert.rejects(() => updatePayment(a, "p1", { ...good, dueDate: "" }), /dueDate is required/);
  await assert.rejects(() => updatePayment(a, "p1", { ...good, status: "paid" }), /invalid status/);
  await assert.rejects(() => updatePayment(a, "p1", { ...good, type: "monthly" }), /invalid type/);

  // Zero is allowed: the month grid records $0 rows for tenants with no rent set.
  await updatePayment(a, "p1", { ...good, amount: "0" });
  assert.equal(a._store.payments[0].amount, 0);
});

test("updatePayment cannot move a payment to another tenant, contract, or ACH state", async () => {
  // Re-pointing a payment rewrites two people's ledgers at once rather than
  // correcting anything; ach_status belongs to Stripe's webhook, so a
  // hand-edited value would be silently overwritten later.
  const a = seed();
  await updatePayment(a, "p1", {
    amount: "1200", dueDate: "2026-08-01", status: "pending", type: "recurring",
    tenantId: "t9", tenant_id: "t9", contractId: "c9", contract_id: "c9", achStatus: "settled", ach_status: "settled",
  });
  const row = a._store.payments[0];
  assert.equal(row.tenant_id, "t1");
  assert.equal(row.contract_id, "c1");
  assert.equal(row.ach_status, null);
});

test("deletePayment removes exactly the named row", async () => {
  const a = createFakePaymentsAdapter({ payments: [{ id: "p1" }, { id: "p2" }] });
  await deletePayment(a, "p1");
  assert.deepEqual(a._store.payments.map((p) => p.id), ["p2"]);
});

test("deletePayment throws when the server removed nothing", async () => {
  // The delete route reports how many rows it actually removed. A payment that
  // matched nothing -- already deleted, or hidden by RLS -- must not be reported
  // to the landlord as a successful delete of their financial record.
  const a = createFakePaymentsAdapter({ payments: [{ id: "p1" }] });
  await assert.rejects(() => deletePayment(a, "missing"), /expected to remove 1 row, removed 0/);
  assert.equal(a._store.payments.length, 1);
});

test("the vocabularies are closed, and isPaid means exactly what the grid's checkbox means", () => {
  for (const s of PAYMENT_STATUSES) assert.equal(isValidPaymentStatus(s), true);
  assert.equal(isValidPaymentStatus("paid"), false);
  assert.equal(isValidPaymentStatus(""), false, "status is required, so blank is not valid");

  for (const ty of PAYMENT_TYPES) assert.equal(isValidPaymentType(ty), true);
  assert.equal(isValidPaymentType(""), true, "type is optional");
  assert.equal(isValidPaymentType("monthly"), false);

  assert.equal(isPaid({ status: "completed" }), true);
  assert.equal(isPaid({ status: "pending" }), false);
  assert.equal(isPaid(null), false);
});

test("mapPayment converts a payments row to the UI shape", () => {
  const p = mapPayment({ id: "p1", tenant_id: "t1", contract_id: "c1", amount: 1200, due_date: "2026-08-01", paid_date: null, status: "pending", type: "recurring", ach_status: null });
  assert.deepEqual(p, {
    id: "p1", tenantId: "t1", contractId: "c1", amount: 1200,
    dueDate: "2026-08-01", paidDate: null, status: "pending", type: "recurring", achStatus: null,
  });
});
