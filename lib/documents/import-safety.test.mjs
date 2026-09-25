import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupCreatedTenantAccounts, oneTenantMatch, validateLeaseAssignment } from "./import-safety.js";

test("lease assignment must use a team-owned property and a unit under that property", async () => {
  const adapter = {
    findPropertyForLandlord: async (id, landlordId) => id === "property-1" && landlordId === "team-1" ? { id } : null,
    findUnit: async (id) => id === "unit-1" ? { id, property_id: "property-1", unit_number: "2B" } : null,
  };
  assert.equal(await validateLeaseAssignment(adapter, { landlordId: "team-1", propertyId: "property-1", unitId: "unit-1" }), "2B");
  await assert.rejects(() => validateLeaseAssignment(adapter, { landlordId: "team-1", propertyId: "foreign", unitId: "unit-1" }), /not found/);
  await assert.rejects(() => validateLeaseAssignment(adapter, { landlordId: "team-1", propertyId: "property-1", unitId: "foreign" }), /does not belong/);
});

test("an ambiguous display-name match is rejected instead of selecting an arbitrary tenant", () => {
  assert.throws(() => oneTenantMatch([{ id: "tenant-a" }, { id: "tenant-b" }], "Alex Lee"), /More than one tenant/);
  assert.deepEqual(oneTenantMatch([{ id: "tenant-a" }], "Alex Lee"), { id: "tenant-a" });
});

test("compensation deletes profiles before auth users and propagates cleanup failures", async () => {
  const calls = [];
  await cleanupCreatedTenantAccounts({
    deleteTenantProfiles: async (ids) => calls.push(["profiles", ids]),
    deleteAuthUser: async (id) => calls.push(["auth", id]),
  }, ["tenant-a", "tenant-b", "tenant-a"]);
  assert.deepEqual(calls, [
    ["profiles", ["tenant-a", "tenant-b"]],
    ["auth", "tenant-a"],
    ["auth", "tenant-b"],
  ]);

  await assert.rejects(
    () => cleanupCreatedTenantAccounts({
      deleteTenantProfiles: async () => {},
      deleteAuthUser: async () => { throw new Error("Auth unavailable"); },
    }, ["tenant-a"]),
    /could not remove every auth user/,
  );
});
