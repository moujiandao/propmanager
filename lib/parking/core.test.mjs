import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeParkingAdapter } from "./fake.js";
import { createSpot, setMarketStatus, deleteSpot, createLease, endLease } from "./core.js";
import { mapParkingSpot, mapParkingRenter, mapParkingLease } from "./mappers.js";
import { isActiveLease, isSpotLeased, activeLeaseForSpot } from "./status.js";

test("createSpot writes snake_case fields, defaults market_status, coerces rate to a number", async () => {
  const a = createFakeParkingAdapter();
  await createSpot(a, { landlordId: "L1", propertyId: "P1", label: "A12", monthlyRate: "75" });
  const row = a._store.parking_spots[0];
  assert.equal(row.landlord_id, "L1");
  assert.equal(row.market_status, "tenant_priority");
  assert.equal(row.monthly_rate, 75);
  assert.equal(typeof row.monthly_rate, "number");
});

test("setMarketStatus rejects an invalid value and leaves the row untouched", async () => {
  const a = createFakeParkingAdapter({ parking_spots: [{ id: "s1", market_status: "tenant_priority" }] });
  await assert.rejects(() => setMarketStatus(a, "s1", "bogus"), /invalid market_status/);
  assert.equal(a._store.parking_spots[0].market_status, "tenant_priority");
});

test("setMarketStatus flips an existing spot to open_market", async () => {
  const a = createFakeParkingAdapter({ parking_spots: [{ id: "s1", market_status: "tenant_priority" }] });
  await setMarketStatus(a, "s1", "open_market");
  assert.equal(a._store.parking_spots[0].market_status, "open_market");
});

test("deleteSpot removes the row; unknown id throws", async () => {
  const a = createFakeParkingAdapter({ parking_spots: [{ id: "s1" }] });
  await deleteSpot(a, "s1");
  assert.equal(a._store.parking_spots.length, 0);
  await assert.rejects(() => deleteSpot(a, "missing"), /not found/);
});

test("createLease requires exactly one of tenantId, renterId, or renter", async () => {
  const a = createFakeParkingAdapter();
  const base = { landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01" };
  await assert.rejects(() => createLease(a, { ...base }), /exactly one/);
  await assert.rejects(
    () => createLease(a, { ...base, tenantId: "t1", renterId: "r1" }),
    /exactly one/,
  );
  assert.equal(a._store.parking_leases.length, 0);
});

test("createLease against an existing tenant writes tenant_id and leaves renter_id null", async () => {
  const a = createFakeParkingAdapter();
  await createLease(a, { landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01", tenantId: "t1" });
  const lease = a._store.parking_leases[0];
  assert.equal(lease.tenant_id, "t1");
  assert.equal(lease.renter_id, null);
  assert.equal(a._store.parking_renters.length, 0);
});

test("createLease for a brand-new market renter creates the renter row and links it", async () => {
  const a = createFakeParkingAdapter();
  await createLease(a, {
    landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01",
    renter: { name: "Alex Chen", email: "alex@example.com", phone: "555-1234" },
  });
  assert.equal(a._store.parking_renters.length, 1);
  const renter = a._store.parking_renters[0];
  assert.equal(renter.name, "Alex Chen");
  const lease = a._store.parking_leases[0];
  assert.equal(lease.renter_id, renter.id);
  assert.equal(lease.tenant_id, null);
});

test("endLease writes end_date", async () => {
  const a = createFakeParkingAdapter({ parking_leases: [{ id: "l1", end_date: null }] });
  await endLease(a, "l1", "2026-09-01");
  assert.equal(a._store.parking_leases[0].end_date, "2026-09-01");
});

test("mappers map snake_case to camelCase and default marketStatus", () => {
  const spot = mapParkingSpot({ id: "s1", landlord_id: "L1", property_id: "P1", label: "A12", monthly_rate: 75 });
  assert.equal(spot.marketStatus, "tenant_priority");
  assert.equal(spot.monthlyRate, 75);

  const renter = mapParkingRenter({ id: "r1", landlord_id: "L1", name: "Alex", email: null });
  assert.equal(renter.email, "");

  const lease = mapParkingLease({ id: "l1", parking_spot_id: "s1", tenant_id: "t1", renter_id: null, rate: 100, start_date: "2026-08-01", end_date: null });
  assert.equal(lease.parkingSpotId, "s1");
  assert.equal(lease.tenantId, "t1");
  assert.equal(lease.renterId, null);
});

test("isActiveLease: future start is not yet active, past end is no longer active, null end is ongoing", () => {
  const today = new Date("2026-07-26T00:00:00");
  assert.equal(isActiveLease({ startDate: "2026-08-01", endDate: null }, today), false);
  assert.equal(isActiveLease({ startDate: "2026-01-01", endDate: "2026-06-01" }, today), false);
  assert.equal(isActiveLease({ startDate: "2026-01-01", endDate: null }, today), true);
  assert.equal(isActiveLease({ startDate: "2026-07-26", endDate: "2026-07-26" }, today), true);
});

test("isSpotLeased / activeLeaseForSpot pick the currently-active lease among a spot's history", () => {
  const today = new Date("2026-07-26T00:00:00");
  const leases = [
    { id: "old", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "current", startDate: "2026-01-01", endDate: null },
  ];
  assert.equal(isSpotLeased(leases, today), true);
  assert.equal(activeLeaseForSpot(leases, today).id, "current");
  assert.equal(activeLeaseForSpot([], today), null);
});
