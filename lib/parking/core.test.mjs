import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeParkingAdapter } from "./fake.js";
import { createSpot, updateSpot, setMarketStatus, deleteSpot, createLease, updateLease, endLease } from "./core.js";
import { mapParkingSpot, mapParkingRenter, mapParkingLease } from "./mappers.js";
import { isActiveLease, isSpotLeased, activeLeaseForSpot, SPOT_TYPES, isValidSpotType } from "./status.js";

test("createSpot writes snake_case fields and defaults market_status", async () => {
  const a = createFakeParkingAdapter();
  await createSpot(a, { landlordId: "L1", propertyId: "P1", label: "A12" });
  const row = a._store.parking_spots[0];
  assert.equal(row.landlord_id, "L1");
  assert.equal(row.property_id, "P1");
  assert.equal(row.label, "A12");
  assert.equal(row.market_status, "tenant_priority");
  // The spot describes physical reality only -- money and vehicle live on the lease.
  assert.equal("monthly_rate" in row, false);
  assert.equal("car_make" in row, false);
});

test("createSpot trims type; blank becomes null rather than an empty string", async () => {
  const a = createFakeParkingAdapter();
  await createSpot(a, { landlordId: "L1", propertyId: "P1", label: "1", type: "  right side (diagonal)  " });
  assert.equal(a._store.parking_spots[0].type, "right side (diagonal)");

  await createSpot(a, { landlordId: "L1", propertyId: "P1", label: "2", type: "   " });
  assert.equal(a._store.parking_spots[1].type, null, "whitespace-only -> null");

  await createSpot(a, { landlordId: "L1", propertyId: "P1", label: "3" });
  assert.equal(a._store.parking_spots[2].type, null, "omitted -> null");
});

test("spot type is validated against the SPOT_TYPES vocabulary", async () => {
  const a = createFakeParkingAdapter({ parking_spots: [{ id: "s1", label: "1" }] });

  // Every listed value is accepted.
  for (const t of SPOT_TYPES) {
    assert.equal(isValidSpotType(t), true, `${t} should be valid`);
  }
  // Optional: empty is valid, since type is not required.
  assert.equal(isValidSpotType(""), true);
  assert.equal(isValidSpotType(undefined), true);
  // Anything else is not -- this is what the dropdown prevents in the UI and
  // the core enforces for any other caller (seed scripts, future API routes).
  assert.equal(isValidSpotType("front side (diagonal)"), false);

  await assert.rejects(
    () => createSpot(a, { landlordId: "L1", propertyId: "P1", label: "9", type: "nonsense" }),
    /invalid spot type/,
  );
  await assert.rejects(
    () => updateSpot(a, "s1", { label: "1", type: "nonsense" }),
    /invalid spot type/,
  );
});

test("updateSpot edits label and type, trims, and rejects a blank label", async () => {
  const a = createFakeParkingAdapter({
    parking_spots: [{ id: "s1", property_id: "P1", label: "1", type: "right side (diagonal)" }],
  });

  await updateSpot(a, "s1", { label: "  1A  ", type: "  left side (straight)  " });
  const row = a._store.parking_spots[0];
  assert.equal(row.label, "1A");
  assert.equal(row.type, "left side (straight)");

  // Rate and vehicle are not the spot's to write, even if a caller passes them.
  await updateSpot(a, "s1", { label: "1A", monthlyRate: "80", carMake: "Toyota" });
  assert.equal(a._store.parking_spots[0].monthly_rate, undefined);
  assert.equal(a._store.parking_spots[0].car_make, undefined);

  // Clearing type is legitimate -- it is an optional column.
  await updateSpot(a, "s1", { label: "1A", type: "" });
  assert.equal(a._store.parking_spots[0].type, null);

  await assert.rejects(() => updateSpot(a, "s1", { label: "   " }), /label is required/);
  assert.equal(a._store.parking_spots[0].label, "1A", "rejected edit left the row untouched");
});

test("updateSpot cannot move a spot to another property", async () => {
  const a = createFakeParkingAdapter({ parking_spots: [{ id: "s1", property_id: "P1", label: "1" }] });
  await updateSpot(a, "s1", { label: "1", propertyId: "P2", property_id: "P2" });
  assert.equal(a._store.parking_spots[0].property_id, "P1", "property_id is not editable");
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

test("createLease carries the vehicle, trimmed, with the year coerced to a number", async () => {
  const a = createFakeParkingAdapter();
  await createLease(a, {
    landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01", tenantId: "t1",
    carMake: "  Honda  ", carModel: "  Civic  ", carYear: "2019",
  });
  const lease = a._store.parking_leases[0];
  assert.equal(lease.car_make, "Honda");
  assert.equal(lease.car_model, "Civic");
  assert.equal(lease.car_year, 2019);
  assert.equal(typeof lease.car_year, "number");
});

test("createLease with no vehicle writes nulls, and a non-numeric year never reaches the database", async () => {
  const a = createFakeParkingAdapter();
  await createLease(a, { landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01", tenantId: "t1" });
  assert.deepEqual(
    { make: a._store.parking_leases[0].car_make, model: a._store.parking_leases[0].car_model, year: a._store.parking_leases[0].car_year },
    { make: null, model: null, year: null },
  );

  await createLease(a, { landlordId: "L1", parkingSpotId: "s2", rate: "100", startDate: "2026-08-01", tenantId: "t2", carYear: "not a year" });
  assert.equal(a._store.parking_leases[1].car_year, null, "NaN -> null");
});

test("createLease sends the camelCase body the API route parses, not raw column names", async () => {
  // Regression guard. core.js used to hand the adapter snake_case column names
  // while /api/parking/leases/create destructures camelCase, so every field but
  // rate arrived undefined and the route 400'd on its first guard. The adapter
  // POSTs this object verbatim, so its keys ARE the route's contract.
  let sent = null;
  const spy = {
    async createLease(payload) { sent = payload; return { lease: { id: "l1" } }; },
  };
  await createLease(spy, {
    landlordId: "L1", parkingSpotId: "s1", rate: "100", startDate: "2026-08-01",
    endDate: "2027-08-01", tenantId: "t1", carMake: "Honda", carYear: "2019",
  });
  assert.deepEqual(Object.keys(sent).sort(), [
    "carMake", "carModel", "carYear", "endDate", "landlordId",
    "parkingSpotId", "rate", "renter", "renterId", "startDate", "tenantId",
  ]);
  assert.equal(sent.landlordId, "L1");
  assert.equal(sent.parkingSpotId, "s1");
  assert.equal(sent.startDate, "2026-08-01");
  assert.equal(sent.rate, 100);
  assert.equal(sent.carMake, "Honda");
  assert.equal(sent.carYear, 2019);
});

test("updateLease edits rate, end date, and vehicle; rejects a missing rate", async () => {
  const a = createFakeParkingAdapter({
    parking_leases: [{ id: "l1", rate: 80, end_date: null, car_make: "Honda", car_model: "Civic", car_year: 2019 }],
  });

  await updateLease(a, "l1", { rate: "95", endDate: "2027-01-31", carMake: "  Toyota  ", carModel: "Corolla", carYear: "2021" });
  const lease = a._store.parking_leases[0];
  assert.equal(lease.rate, 95);
  assert.equal(typeof lease.rate, "number");
  assert.equal(lease.end_date, "2027-01-31");
  assert.equal(lease.car_make, "Toyota");
  assert.equal(lease.car_year, 2021);

  // Clearing the vehicle and the end date is legitimate -- both are optional.
  await updateLease(a, "l1", { rate: "95", endDate: "", carMake: "", carModel: "", carYear: "" });
  assert.equal(a._store.parking_leases[0].end_date, null);
  assert.equal(a._store.parking_leases[0].car_make, null);
  assert.equal(a._store.parking_leases[0].car_year, null);

  // rate is NOT NULL on parking_leases, so a blank must fail before the write.
  await assert.rejects(() => updateLease(a, "l1", { rate: "" }), /rate is required/);
  assert.equal(a._store.parking_leases[0].rate, 95, "rejected edit left the row untouched");
});

test("endLease writes end_date", async () => {
  const a = createFakeParkingAdapter({ parking_leases: [{ id: "l1", end_date: null }] });
  await endLease(a, "l1", "2026-09-01");
  assert.equal(a._store.parking_leases[0].end_date, "2026-09-01");
});

test("mappers map snake_case to camelCase and default marketStatus", () => {
  const spot = mapParkingSpot({ id: "s1", landlord_id: "L1", property_id: "P1", label: "A12" });
  assert.equal(spot.marketStatus, "tenant_priority");
  assert.equal(spot.type, "", "null type -> empty string, not null");
  assert.equal(mapParkingSpot({ id: "s2", type: "back side (straight)" }).type, "back side (straight)");
  // Money and vehicle belong to the lease now, not the spot.
  assert.equal("monthlyRate" in spot, false);
  assert.equal("carMake" in spot, false);

  const renter = mapParkingRenter({ id: "r1", landlord_id: "L1", name: "Alex", email: null });
  assert.equal(renter.email, "");

  const lease = mapParkingLease({
    id: "l1", parking_spot_id: "s1", tenant_id: "t1", renter_id: null, rate: 100,
    start_date: "2026-08-01", end_date: null,
    car_make: "Honda", car_model: null, car_year: 2019,
  });
  assert.equal(lease.parkingSpotId, "s1");
  assert.equal(lease.tenantId, "t1");
  assert.equal(lease.renterId, null);
  assert.equal(lease.carMake, "Honda");
  assert.equal(lease.carModel, "", "null model -> empty string, so the UI can bind an <Inp>");
  assert.equal(lease.carYear, 2019);
  assert.equal(mapParkingLease({ id: "l2", car_year: null }).carYear, null, "missing year stays null, not 0");
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
