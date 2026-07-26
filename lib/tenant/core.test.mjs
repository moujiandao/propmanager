import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeTenantAdapter } from "./fake.js";
import { setRecurringPayment, setBankConnected, updateDisplayName } from "./core.js";
import { mapTenant } from "./mappers.js";

test("setRecurringPayment writes the snake_case column and returns the value", async () => {
  const a = createFakeTenantAdapter({ profiles: [{ id: "t1", recurring_payment: false }] });
  const v = await setRecurringPayment(a, "t1", true);
  assert.equal(v, true);
  assert.equal(a._store.profiles[0].recurring_payment, true);
});

test("setBankConnected sets bank_connected true", async () => {
  const a = createFakeTenantAdapter({ profiles: [{ id: "t1", bank_connected: false }] });
  await setBankConnected(a, "t1");
  assert.equal(a._store.profiles[0].bank_connected, true);
});

test("updateDisplayName trims, persists, and returns the trimmed name; rejects empty", async () => {
  const a = createFakeTenantAdapter({ profiles: [{ id: "t1", name: "Old" }] });
  const n = await updateDisplayName(a, "t1", "  New Name  ");
  assert.equal(n, "New Name");
  assert.equal(a._store.profiles[0].name, "New Name");
  await assert.rejects(() => updateDisplayName(a, "t1", "   "), /empty/);
});

test("adapter errors propagate (e.g. unknown id)", async () => {
  const a = createFakeTenantAdapter();
  await assert.rejects(() => setRecurringPayment(a, "missing", true), /not found/);
});

test("mapTenant derives status from dates and maps snake->camel", () => {
  const row = {
    id: "t1", name: "Bri", last_name: "M", email: "b@x.com", property_id: "p1", unit: "2B",
    status: "active", bank_connected: true, recurring_payment: false, monthly_rent: 1500,
    move_in_date: "2026-01-01", security_deposit_refunded: false, landlord_id: "L1",
  };
  const t = mapTenant(row);
  assert.equal(t.status, "current tenant");      // moved in, no move-out date
  assert.equal(t.lastName, "M");
  assert.equal(t.propertyId, "p1");
  assert.equal(t.bankConnected, true);
  assert.equal(t.monthlyRent, 1500);
  assert.equal(t.landlordId, "L1");

  // The stored column is legacy and must NOT be consulted — the dates decide.
  // A legacy "inactive" row with no dates is current, not previous; the backfill
  // (scripts/backfill-tenant-status-dates.sql) is what gives those rows a date.
  assert.equal(mapTenant({ id: "t2", status: "inactive" }).status, "current tenant");
  assert.equal(mapTenant({ id: "t3" }).status, "current tenant");
  assert.equal(
    mapTenant({ id: "t4", status: "current tenant", move_in_date: "2999-01-01" }).status,
    "future tenant",
    "a stored 'current tenant' with a future move-in derives as future — the drift this replaces",
  );
  assert.equal(
    mapTenant({ id: "t5", status: "current tenant", move_out_date: "2020-01-01" }).status,
    "previous tenant",
  );
});
