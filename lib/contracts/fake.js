// In-memory implementation of the contracts adapter. It stages every write
// before swapping it into the store, mirroring PostgreSQL transaction rollback.

export function createFakeContractsAdapter(seed = {}) {
  const store = {
    contracts: [...(seed.contracts || [])],
    contract_tenants: [...(seed.contract_tenants || [])],
    tenants: [...(seed.tenants || [])],
    failLinkInsert: seed.failLinkInsert || false,
  };
  let nextId = seed.nextId || 1;

  function assertKnownTeamTenants(lease) {
    if (!store.tenants.length) return;
    for (const tenantId of lease.tenantIds) {
      const tenant = store.tenants.find((row) => row.id === tenantId);
      if (!tenant || tenant.landlord_id !== lease.landlordId) {
        throw new Error("tenant does not belong to this landlord.");
      }
    }
  }

  function linksFor(contractId, tenantIds) {
    if (store.failLinkInsert) throw new Error("contract_tenants insert failed");
    return tenantIds.map((tenant_id) => ({ contract_id: contractId, tenant_id }));
  }

  const adapter = {
    async createContractWithTenants(lease) {
      assertKnownTeamTenants(lease);
      const contractId = `contract-${nextId++}`;
      // All potentially failing work occurs before committing either array.
      const newLinks = linksFor(contractId, lease.tenantIds);
      const contract = {
        id: contractId,
        landlord_id: lease.landlordId,
        property_id: lease.propertyId,
        unit: lease.unit,
        start_date: lease.startDate,
        end_date: lease.endDate,
        rent_amount: lease.rentAmount,
        due_day: lease.dueDay,
        status: "active",
      };
      store.contracts = [...store.contracts, contract];
      store.contract_tenants = [...store.contract_tenants, ...newLinks];
      return { contractId };
    },
    async updateContractWithTenants(lease) {
      const existing = store.contracts.find((row) => row.id === lease.contractId);
      if (!existing || existing.landlord_id !== lease.landlordId) {
        throw new Error("contract does not belong to this landlord.");
      }
      assertKnownTeamTenants(lease);
      const newLinks = linksFor(lease.contractId, lease.tenantIds);
      const replacement = {
        ...existing,
        property_id: lease.propertyId,
        unit: lease.unit,
        start_date: lease.startDate,
        end_date: lease.endDate,
        rent_amount: lease.rentAmount,
        due_day: lease.dueDay,
      };
      store.contracts = store.contracts.map((row) => row.id === lease.contractId ? replacement : row);
      store.contract_tenants = [
        ...store.contract_tenants.filter((row) => row.contract_id !== lease.contractId),
        ...newLinks,
      ];
      return { contractId: lease.contractId };
    },
  };

  return Object.assign(adapter, { _store: store });
}
