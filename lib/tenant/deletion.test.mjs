import { test } from "node:test";
import assert from "node:assert/strict";
import { TENANT_DELETE_BLOCKERS, summarizeBlockers, isDeletable } from "./deletion.js";

test("a tenant with nothing pointing at them is deletable", () => {
  assert.equal(isDeletable({}), true);
  assert.equal(isDeletable({ payments: 0, documents: 0 }), true);
  assert.deepEqual(summarizeBlockers({}), []);
});

test("summarizeBlockers reports only the relations that actually have rows", () => {
  assert.deepEqual(
    summarizeBlockers({ payments: 12, maintenance: 0, documents: 3 }),
    [{ key: "payments", count: 12 }, { key: "documents", count: 3 }],
  );
});

test("summarizeBlockers keeps the declared display order, not the caller's", () => {
  // Caller passes documents first; payments must still lead.
  const out = summarizeBlockers({ documents: 1, payments: 1, contracts: 1 });
  assert.deepEqual(out.map(b => b.key), ["payments", "contracts", "documents"]);
});

test("a missing count is not a phantom blocker", () => {
  // A relation the route couldn't count (older DB without the table) comes back
  // undefined and must read as "nothing there", not as something in the way.
  assert.equal(isDeletable({ payments: undefined, parkingLeases: null }), true);
});

test("cascading relations still block", () => {
  // contract_tenants and parking_leases cascade in Postgres, so without an
  // explicit block they'd vanish silently -- the thing this guard prevents.
  assert.equal(isDeletable({ contracts: 1 }), false);
  assert.equal(isDeletable({ parkingLeases: 1 }), false);
  const cascading = TENANT_DELETE_BLOCKERS.filter(b => b.cascades).map(b => b.key);
  assert.deepEqual(cascading, ["contracts", "parkingLeases"]);
});

test("every blocker declares the table and column the route has to query", () => {
  for (const b of TENANT_DELETE_BLOCKERS) {
    assert.ok(b.key && b.table && b.column, `incomplete blocker: ${JSON.stringify(b)}`);
    assert.equal(typeof b.cascades, "boolean");
  }
  // Keys must be unique -- they're the map keys the counts come back under.
  const keys = TENANT_DELETE_BLOCKERS.map(b => b.key);
  assert.equal(new Set(keys).size, keys.length);
});
