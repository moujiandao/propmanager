import { test } from "node:test";
import assert from "node:assert/strict";
import { createContract, updateContract } from "./core.js";
import { createFakeContractsAdapter } from "./fake.js";

const lease = {
  landlordId: "landlord-1",
  propertyId: "property-1",
  unit: "2B",
  startDate: "2026-10-01",
  endDate: "2027-09-30",
  rentAmount: "2400",
  dueDay: "1",
};

test("a two-person lease creates one contract and two junction rows", async () => {
  const adapter = createFakeContractsAdapter({
    tenants: [
      { id: "tenant-a", landlord_id: "landlord-1" },
      { id: "tenant-b", landlord_id: "landlord-1" },
    ],
  });

  const result = await createContract(adapter, { ...lease, tenantIds: ["tenant-a", "tenant-b"] });
  assert.equal(result.contractId, "contract-1");
  assert.equal(adapter._store.contracts.length, 1);
  assert.deepEqual(adapter._store.contract_tenants, [
    { contract_id: "contract-1", tenant_id: "tenant-a" },
    { contract_id: "contract-1", tenant_id: "tenant-b" },
  ]);
  assert.equal(adapter._store.contracts[0].rent_amount, 2400);
});

test("a failed party-link insert leaves no partially-created contract", async () => {
  const adapter = createFakeContractsAdapter({ failLinkInsert: true });
  await assert.rejects(
    () => createContract(adapter, { ...lease, tenantIds: ["tenant-a", "tenant-b"] }),
    /contract_tenants insert failed/,
  );
  assert.deepEqual(adapter._store.contracts, []);
  assert.deepEqual(adapter._store.contract_tenants, []);
});

test("a failed replacement link insert preserves the prior party list and lease", async () => {
  const adapter = createFakeContractsAdapter({
    contracts: [{ id: "contract-1", landlord_id: "landlord-1", unit: "2B", rent_amount: 2400 }],
    contract_tenants: [{ contract_id: "contract-1", tenant_id: "tenant-a" }],
    failLinkInsert: true,
  });

  await assert.rejects(
    () => updateContract(adapter, { ...lease, contractId: "contract-1", unit: "3C", tenantIds: ["tenant-b"] }),
    /contract_tenants insert failed/,
  );
  assert.equal(adapter._store.contracts[0].unit, "2B");
  assert.deepEqual(adapter._store.contract_tenants, [{ contract_id: "contract-1", tenant_id: "tenant-a" }]);
});

test("lease input rejects duplicate parties, invalid dates, and invalid due days before any write", async () => {
  const adapter = createFakeContractsAdapter();
  await assert.rejects(() => createContract(adapter, { ...lease, tenantIds: ["tenant-a", "tenant-a"] }), /only once/);
  await assert.rejects(() => createContract(adapter, { ...lease, endDate: "2026-09-30", tenantIds: ["tenant-a"] }), /cannot precede/);
  await assert.rejects(() => createContract(adapter, { ...lease, dueDay: "32", tenantIds: ["tenant-a"] }), /between 1 and 31/);
  assert.deepEqual(adapter._store.contracts, []);
});
