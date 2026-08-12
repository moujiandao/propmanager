// The one home for the camelCase shape of a `contracts` row and of the
// `contract_tenants` join.
//
// NOTE on `tenantIds`: the embed `contracts(*, contract_tenants(tenant_id))` is
// blocked by RLS for the browser client, so it comes back empty. The loader
// overlays the real ids from the service-role `/api/contracts/tenant-links`
// route. This mapper therefore returns whatever the embed gave it (usually an
// empty array) and is not the authority on that field — see loadAllData.
export const mapContract = (c) => ({
  id: c.id,
  tenantIds: (c.contract_tenants || []).map((ct) => ct.tenant_id),
  propertyId: c.property_id,
  unit: c.unit,
  startDate: c.start_date,
  endDate: c.end_date,
  rentAmount: c.rent_amount,
  dueDay: c.due_day,
  status: c.status || 'active',
});

export const mapContractTenant = (ct) => ({
  contractId: ct.contract_id,
  tenantId: ct.tenant_id,
});
