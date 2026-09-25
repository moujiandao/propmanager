// Residential lease writes. Both the manual lease form and the reviewed
// document-import path pass through this module so the contract and its party
// links have one shape and one set of invariants.

function requiredId(value, label) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) throw new Error(`${label} is required.`);
  return id;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalDate(value, label) {
  const date = optionalText(value);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}

function normalizedTenantIds(tenantIds) {
  if (!Array.isArray(tenantIds)) throw new Error("tenantIds must be an array.");
  const ids = tenantIds.map((id) => requiredId(id, "tenantId"));
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Error("At least one tenant is required.");
  if (unique.length !== ids.length) throw new Error("Each tenant may appear only once on a lease.");
  return unique;
}

function normalizedRent(value) {
  const rent = Number(value);
  if (!Number.isFinite(rent) || rent <= 0) throw new Error("rentAmount must be greater than zero.");
  return rent;
}

function normalizedDueDay(value) {
  if (value === "" || value == null) return null;
  const dueDay = Number(value);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("dueDay must be between 1 and 31.");
  }
  return dueDay;
}

function normalizeLease(input, { requireContractId = false } = {}) {
  const startDate = optionalDate(input.startDate, "startDate");
  const endDate = optionalDate(input.endDate, "endDate");
  if (startDate && endDate && endDate < startDate) {
    throw new Error("endDate cannot precede startDate.");
  }

  return {
    ...(requireContractId ? { contractId: requiredId(input.contractId, "contractId") } : {}),
    landlordId: requiredId(input.landlordId, "landlordId"),
    propertyId: optionalText(input.propertyId),
    unit: optionalText(input.unit),
    startDate,
    endDate,
    rentAmount: normalizedRent(input.rentAmount),
    dueDay: normalizedDueDay(input.dueDay),
    tenantIds: normalizedTenantIds(input.tenantIds),
  };
}

// `adapter` is deliberately one operation, not insert-contract then
// insert-links. The production adapter maps it to a PostgreSQL function, where
// both writes share one transaction. The fake has the same all-or-nothing
// contract, which makes the failure behavior testable without Supabase.
export async function createContract(adapter, input) {
  return adapter.createContractWithTenants(normalizeLease(input));
}

// Editing must replace the contract row and its party list together. The old
// route deleted the links before it tried to insert replacements, so a failed
// insert could leave a lease with no tenants.
export async function updateContract(adapter, input) {
  return adapter.updateContractWithTenants(normalizeLease(input, { requireContractId: true }));
}
