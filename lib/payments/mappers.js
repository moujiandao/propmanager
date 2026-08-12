// The one home for the camelCase shape of a payments row. Moved out of
// fetchAllData for the same reason as the other seamed entities: the read shape
// and the write ops belong together.
export const mapPayment = (p) => ({
  id: p.id,
  tenantId: p.tenant_id,
  contractId: p.contract_id,
  amount: p.amount,
  dueDate: p.due_date,
  paidDate: p.paid_date,
  status: p.status,
  type: p.type,
  // Written by Stripe's webhook, never by the app's own edit path.
  achStatus: p.ach_status,
});
