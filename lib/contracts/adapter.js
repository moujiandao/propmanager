// Production adapter for the residential-lease aggregate. RPC keeps the
// contract row and contract_tenants junction writes in one database
// transaction, unlike a sequence of independent PostgREST calls.

function rpcError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message || error}`);
}

function rpcPayload(lease) {
  return {
    p_landlord_id: lease.landlordId,
    p_property_id: lease.propertyId,
    p_unit: lease.unit,
    p_start_date: lease.startDate,
    p_end_date: lease.endDate,
    p_rent_amount: lease.rentAmount,
    p_due_day: lease.dueDay,
    p_tenant_ids: lease.tenantIds,
  };
}

export function createContractsAdapter(supabase) {
  return {
    async createContractWithTenants(lease) {
      const { data, error } = await supabase.rpc("create_contract_with_tenants", rpcPayload(lease));
      rpcError(error, "createContractWithTenants");
      return { contractId: data };
    },
    async updateContractWithTenants(lease) {
      const { error } = await supabase.rpc("update_contract_with_tenants", {
        p_contract_id: lease.contractId,
        ...rpcPayload(lease),
      });
      rpcError(error, "updateContractWithTenants");
      return { contractId: lease.contractId };
    },
  };
}
