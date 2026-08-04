import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeUnitAdapter } from "./fake.js";
import { createUnit, updateUnit, deleteUnit, UnitHasTenantsError } from "./core.js";
import { mapUnit } from "./mappers.js";

test("createUnit writes snake_case columns under the property", async () => {
  const a = createFakeUnitAdapter();
  await createUnit(a, { propertyId: "p1", unitNumber: " 2B ", bedrooms: "3", bathrooms: "2", monthlyRent: "1500" });
  const row = a._store.units[0];
  assert.equal(row.property_id, "p1");
  assert.equal(row.unit_number, "2B");   // trimmed
  assert.equal(row.bedrooms, 3);
  assert.equal(row.bathrooms, 2);
  assert.equal(row.monthly_rent, 1500);
});

test("createUnit defaults bed/bath to 1 and leaves blank rent null", async () => {
  const a = createFakeUnitAdapter();
  await createUnit(a, { propertyId: "p1", unitNumber: "1", bedrooms: "", bathrooms: "", monthlyRent: "" });
  const row = a._store.units[0];
  assert.equal(row.bedrooms, 1);
  assert.equal(row.bathrooms, 1);
  assert.equal(row.monthly_rent, null);  // blank means "not set", not 0
});

test("createUnit never writes status — occupancy is derived on read", async () => {
  const a = createFakeUnitAdapter();
  await createUnit(a, { propertyId: "p1", unitNumber: "1", status: "occupied" });
  assert.equal("status" in a._store.units[0], false);
});

test("createUnit requires a property and a unit number", async () => {
  const a = createFakeUnitAdapter();
  await assert.rejects(() => createUnit(a, { unitNumber: "1" }), /propertyId is required/);
  await assert.rejects(() => createUnit(a, { propertyId: "p1", unitNumber: "   " }), /unit number is required/);
  assert.equal(a._store.units.length, 0);
});

test("updateUnit edits the unit's own fields", async () => {
  const a = createFakeUnitAdapter({ units: [{ id: "u1", property_id: "p1", unit_number: "1", bedrooms: 1 }] });
  await updateUnit(a, "u1", { unitNumber: "1A", bedrooms: "2", bathrooms: "1", monthlyRent: "999.50" });
  const row = a._store.units[0];
  assert.equal(row.unit_number, "1A");
  assert.equal(row.bedrooms, 2);
  assert.equal(row.monthly_rent, 999.5);
});

test("updateUnit cannot move a unit to another property", async () => {
  const a = createFakeUnitAdapter({ units: [{ id: "u1", property_id: "p1", unit_number: "1" }] });
  await updateUnit(a, "u1", { unitNumber: "1", propertyId: "p2", property_id: "p2" });
  assert.equal(a._store.units[0].property_id, "p1");
});

test("updateUnit rejects a blank unit number rather than clearing it", async () => {
  const a = createFakeUnitAdapter({ units: [{ id: "u1", property_id: "p1", unit_number: "1" }] });
  await assert.rejects(() => updateUnit(a, "u1", { unitNumber: "" }), /unit number is required/);
  assert.equal(a._store.units[0].unit_number, "1");
});

test("deleteUnit removes a unit nothing is assigned to", async () => {
  const a = createFakeUnitAdapter({ units: [{ id: "u1" }, { id: "u2" }], tenants: [{ id: "t1", unit_id: "u2" }] });
  await deleteUnit(a, "u1");
  assert.deepEqual(a._store.units.map(u => u.id), ["u2"]);
});

test("deleteUnit blocks while ANY tenant is linked, and reports how many", async () => {
  const a = createFakeUnitAdapter({
    units: [{ id: "u1" }],
    // A previous tenant counts: their unit_id is what Unit Transitions reads.
    tenants: [{ id: "t1", unit_id: "u1" }, { id: "t2", unit_id: "u1" }],
  });
  const err = await deleteUnit(a, "u1").then(() => null, e => e);
  assert.ok(err instanceof UnitHasTenantsError);
  assert.equal(err.code, "UNIT_HAS_TENANTS");
  assert.equal(err.count, 2);
  assert.equal(a._store.units.length, 1);  // still there
});

test("deleteUnit's guard reads the store, so a stale caller can't force it", async () => {
  // Caller believes the unit is empty; the adapter is the authority.
  const a = createFakeUnitAdapter({ units: [{ id: "u1" }], tenants: [] });
  a._store.tenants.push({ id: "t9", unit_id: "u1" });   // moved in since page load
  await assert.rejects(() => deleteUnit(a, "u1"), UnitHasTenantsError);
});

test("mapUnit converts a units row to the UI shape", () => {
  assert.deepEqual(
    mapUnit({ id: "u1", property_id: "p1", unit_number: "2B", bedrooms: 2, bathrooms: 1, monthly_rent: 1500, status: "vacant" }),
    { id: "u1", propertyId: "p1", unitNumber: "2B", bedrooms: 2, bathrooms: 1, monthlyRent: 1500, status: "vacant" },
  );
});
