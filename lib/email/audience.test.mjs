import { test } from "node:test";
import assert from "node:assert/strict";
import { candidates, matchesScope } from "./audience.js";

// Small in-memory fixtures. Contracts carry tenantIds so contractForTenant can
// resolve them (matching loadLandlordDataset's shape).
const tenants = [
  { id: "t1", status: "current tenant", moveOutDate: "2026-07-31", moveInDate: "2025-08-01", propertyId: "p1" },
  { id: "t2", status: "current tenant", moveOutDate: null, moveInDate: "2025-09-01", propertyId: "p2" },
  { id: "t3", status: "future tenant", moveOutDate: null, moveInDate: "2026-08-15", propertyId: "p1" },
  { id: "t4", status: "future tenant", moveOutDate: null, moveInDate: null, propertyId: "p2" },
  { id: "t5", status: "previous tenant", moveOutDate: "2025-12-31", moveInDate: "2024-01-01", propertyId: "p1" },
];

const contracts = [
  { id: "c1", tenantIds: ["t1"], endDate: "2026-07-31", dueDay: 1 },
  { id: "c2", tenantIds: ["t2"], endDate: "2026-09-30", dueDay: null },
  // t3 (future tenant) has a contract with an endDate but no dueDay.
  { id: "c3", tenantIds: ["t3"], endDate: "2027-08-14", dueDay: 5 },
];

const ds = { tenants, contracts };
const ids = (arr) => arr.map(t => t.id);

test("candidates(move_out): current tenants with a move-out date", () => {
  assert.deepEqual(ids(candidates("move_out", ds)), ["t1"]);
});

test("candidates(projected_move_out): current tenants with move-out date OR contract end date", () => {
  // t1 has a move-out date; t2 has no move-out date but its contract has an endDate.
  assert.deepEqual(ids(candidates("projected_move_out", ds)), ["t1", "t2"]);
});

test("candidates(move_in): future tenants with a move-in date", () => {
  // t3 is future + has move-in date; t4 is future but has no move-in date.
  assert.deepEqual(ids(candidates("move_in", ds)), ["t3"]);
});

test("candidates(lease_end): any tenant whose contract has an end date, regardless of status", () => {
  // t1, t2, t3 all have contracts with endDate; status is not considered.
  assert.deepEqual(ids(candidates("lease_end", ds)), ["t1", "t2", "t3"]);
});

test("candidates(rent_due): current tenants whose contract has a dueDay", () => {
  // t1 current + dueDay 1; t2 current but dueDay null; t3 has dueDay but is a future tenant.
  assert.deepEqual(ids(candidates("rent_due", ds)), ["t1"]);
});

test("candidates(unknown event): empty list", () => {
  assert.deepEqual(candidates("not_a_real_event", ds), []);
});

test("matchesScope: no scope matches everyone", () => {
  assert.equal(matchesScope(tenants[0], null), true);
  assert.equal(matchesScope(tenants[0], undefined), true);
  assert.equal(matchesScope(tenants[0], {}), true);
});

test("matchesScope: propertyId match and mismatch", () => {
  assert.equal(matchesScope({ propertyId: "p1" }, { propertyId: "p1" }), true);
  assert.equal(matchesScope({ propertyId: "p2" }, { propertyId: "p1" }), false);
});

test("matchesScope: status match and mismatch", () => {
  assert.equal(matchesScope({ status: "current tenant" }, { status: "current tenant" }), true);
  assert.equal(matchesScope({ status: "future tenant" }, { status: "current tenant" }), false);
});

test("matchesScope: combined propertyId + status, both must match", () => {
  const scope = { propertyId: "p1", status: "current tenant" };
  assert.equal(matchesScope({ propertyId: "p1", status: "current tenant" }, scope), true);
  assert.equal(matchesScope({ propertyId: "p1", status: "future tenant" }, scope), false);
  assert.equal(matchesScope({ propertyId: "p2", status: "current tenant" }, scope), false);
});
