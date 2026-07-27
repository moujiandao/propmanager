import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePropertyAdapter } from "./fake.js";
import { createProperty, deleteProperty, setDriveLink } from "./core.js";
import { mapProperty } from "./mappers.js";

test("createProperty writes snake_case landlord_id and coerces units to a number", async () => {
  const a = createFakePropertyAdapter();
  await createProperty(a, { landlordId: "L1", address: "1 Main", city: "SF", state: "CA", zip: "94016", units: "4", type: "Multi", status: "vacant" });
  const row = a._store.properties[0];
  assert.equal(row.landlord_id, "L1");
  assert.equal(row.units, 4);          // "4" -> 4
  assert.equal(typeof row.units, "number");
  assert.equal(row.address, "1 Main");
});

test("createProperty defaults in_production to true; false must be explicit", async () => {
  const a = createFakePropertyAdapter();
  await createProperty(a, { landlordId: "L1", address: "1 Main", units: "1" });
  assert.equal(a._store.properties[0].in_production, true);

  await createProperty(a, { landlordId: "L1", address: "2 Main", units: "1", inProduction: false });
  assert.equal(a._store.properties[1].in_production, false);
});

test("deleteProperty removes the row; unknown id throws", async () => {
  const a = createFakePropertyAdapter({ properties: [{ id: "p1" }] });
  await deleteProperty(a, "p1");
  assert.equal(a._store.properties.length, 0);
  await assert.rejects(() => deleteProperty(a, "missing"), /not found/);
});

test("setDriveLink trims and stores; empty becomes null", async () => {
  const a = createFakePropertyAdapter({ properties: [{ id: "p1" }] });
  const v = await setDriveLink(a, "p1", "  https://drive  ");
  assert.equal(v, "https://drive");
  assert.equal(a._store.properties[0].drive_link, "https://drive");

  const cleared = await setDriveLink(a, "p1", "   ");
  assert.equal(cleared, null);
  assert.equal(a._store.properties[0].drive_link, null);
});

test("mapProperty maps snake->camel and defaults state to CA", () => {
  const m = mapProperty({ id: "p1", address: "1 Main", drive_link: "x", image_url: null });
  assert.equal(m.state, "CA");
  assert.equal(m.driveLink, "x");
  assert.equal(m.imageUrl, null);
  assert.equal(mapProperty({ id: "p2", state: "NY" }).state, "NY");
});

test("mapProperty defaults inProduction to true; only an explicit false excludes it", () => {
  assert.equal(mapProperty({ id: "p1", in_production: true }).inProduction, true);
  assert.equal(mapProperty({ id: "p2", in_production: false }).inProduction, false);
  assert.equal(mapProperty({ id: "p3" }).inProduction, true, "missing column -> true");
  assert.equal(mapProperty({ id: "p4", in_production: null }).inProduction, true, "null -> true");
});
