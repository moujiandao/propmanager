# Move Parking Vehicle + Rate onto the Lease — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `parking_spots` describe physical reality only (property, label, type, market status) by moving `car_make` / `car_model` / `car_year` onto `parking_leases` and deleting `parking_spots.monthly_rate` outright.

**Architecture:** Expand/contract migration — add the lease columns and backfill them *before* the code changes, drop the spot columns *after*. Writes go through the existing `lib/parking/` seam (`core.js` + `adapter.js`/`fake.js` + `mappers.js`); the UI calls them through `useParkingMutations()`. A new `updateLease` core op and a new Edit Lease modal supply the edit path the feature needs.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), plain JS ESM modules, `node --test` via `npm test`, inline-style React in `property-management-app.jsx`.

## Global Constraints

- **Migrations are idempotent and run by hand** in Supabase → SQL Editor. Scripts live in `scripts/*.sql`, wrapped in `begin; … commit;`, and open with a comment block explaining *why*, matching `scripts/add-parking.sql`.
- **Every landlord-visible string must exist in both `T.en` and `T.zh`** in `property-management-app.jsx` before it is used, referenced as `t.keyName`. No hardcoded English in JSX — including `title=`, `placeholder=`, modal copy, and error messages.
- **No new direct `supabase.from(...)` writes in the monolith** for parking. All writes go through `lib/parking/core.js` via `useParkingMutations()`.
- **Do not duplicate the `fmt` / `fmtDate` formatters** — import from `lib/format`.
- **`Btn` ignores a `style` prop.** It only spreads `{ children, onClick, variant, size, icon, disabled }`. Use `variant` for color.
- **React Compiler is on.** Hooks use plain consts; manual `useMemo`/`useCallback` triggers a "memoization could not be preserved" lint error.
- **Run `npm test` before every commit.** Never use `--no-verify`.
- Branch: `feat/parking-lease-vehicle`, already created and holding the spec commit.

## Known defect this plan also fixes

`lib/parking/core.js`'s `createLease` builds a **snake_case** payload (`landlord_id`, `parking_spot_id`, `start_date`, …) and `adapter.js` POSTs it verbatim to `/api/parking/leases/create`, which destructures **camelCase** (`landlordId`, `parkingSpotId`, `startDate`, …). Every field except `rate` and `renter` arrives `undefined`, so the route's first guard returns `400 landlordId is required`. Creating a parking lease from the UI cannot currently succeed.

The unit tests do not catch this because `fake.js` mirrors the *core's* payload shape rather than the *route's* contract — the fake and the real adapter disagree, and only the fake is exercised. Task 3 proves the mismatch with a test, then fixes it by making the route-backed adapter ops speak camelCase (routes take camelCase; direct table writes take snake_case).

---

## File Structure

| File | Change | Responsibility after |
|---|---|---|
| `scripts/add-parking-lease-vehicle.sql` | Create | Expand: add car columns to `parking_leases`, backfill from spots |
| `scripts/drop-parking-spot-vehicle.sql` | Create | Contract: drop car + rate columns from `parking_spots` |
| `scripts/add-parking-spot-car.sql` | Modify (header only) | Historical record, points at the superseding migration |
| `lib/parking/core.js` | Modify | Spot ops lose car/rate; lease ops gain them; new `updateLease` |
| `lib/parking/mappers.js` | Modify | `mapParkingSpot` shrinks, `mapParkingLease` grows |
| `lib/parking/fake.js` | Modify | Lease ops accept camelCase, store snake_case rows |
| `lib/parking/adapter.js` | Unchanged | — |
| `lib/parking/core.test.mjs` | Modify | Car assertions move to lease ops; new `updateLease` + contract tests |
| `app/api/parking/leases/create/route.js` | Modify | Accepts + inserts the three car columns |
| `property-management-app.jsx` | Modify | Spot modal shrinks; lease modal grows; new Edit Lease modal |
| `CLAUDE.md`, `CHANGELOG.md` | Modify | Docs |

---

### Task 1: Expand migration — add the lease columns and backfill

No automated test: this is SQL run by hand against Supabase. The verification step is a `select` you read with your own eyes.

**Files:**
- Create: `scripts/add-parking-lease-vehicle.sql`
- Modify: `scripts/add-parking-spot-car.sql` (header comment only, lines 1-11)

**Interfaces:**
- Consumes: nothing.
- Produces: `parking_leases.car_make text`, `parking_leases.car_model text`, `parking_leases.car_year smallint`, populated for every currently-active lease.

- [ ] **Step 1: Write the expand migration**

Create `scripts/add-parking-lease-vehicle.sql`:

```sql
-- =====================================================================
-- Move the vehicle onto the parking lease (expand half)
--
-- car_make / car_model / car_year used to live on parking_spots. That
-- attached the car to the asphalt: when a lease ended, the previous
-- renter's vehicle stayed listed until somebody cleared it by hand, and
-- there was no record of which car occupied a spot when. The vehicle
-- belongs to the agreement, so it moves to parking_leases.
--
-- This is the EXPAND half of an expand/contract migration. It only adds
-- and backfills, so it is safe to run while the old code is still
-- deployed -- nothing reads these columns yet. The matching contract
-- half (scripts/drop-parking-spot-vehicle.sql) drops the old columns and
-- must only run AFTER the new code is live.
--
-- car_year is smallint to match the column it came from, so it sorts and
-- compares numerically. All three are nullable: a lease can exist with
-- no vehicle recorded.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

begin;

alter table public.parking_leases
  add column if not exists car_make  text,
  add column if not exists car_model text,
  add column if not exists car_year  smallint;

-- Backfill: a spot's car belongs to whoever is leasing it right now.
--
-- "Right now" is the same rule lib/parking/status.js derives occupancy
-- from -- started on or before today, and either open-ended or ending
-- today or later. Two cases lose data on purpose and there is nowhere
-- honest to put them: a spot whose only lease is in the future, and a
-- spot with no lease at all.
--
-- The where-clause guard makes the backfill idempotent: a second run
-- finds the target rows already populated and skips them, so it can
-- never overwrite a vehicle someone edited between runs.
update public.parking_leases l
   set car_make  = s.car_make,
       car_model = s.car_model,
       car_year  = s.car_year
  from public.parking_spots s
 where l.parking_spot_id = s.id
   and l.start_date <= current_date
   and (l.end_date is null or l.end_date >= current_date)
   and (s.car_make is not null or s.car_model is not null or s.car_year is not null)
   and l.car_make is null and l.car_model is null and l.car_year is null;

commit;
```

- [ ] **Step 2: Run it in Supabase**

Paste the file into Supabase → SQL Editor and run it. Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the backfill landed, and see what was dropped**

Run this in the SQL Editor and read both result sets:

```sql
-- Leases that now carry a vehicle.
select l.id, s.label, l.car_year, l.car_make, l.car_model
  from public.parking_leases l
  join public.parking_spots s on s.id = l.parking_spot_id
 where l.car_make is not null or l.car_model is not null or l.car_year is not null;

-- Spots whose car data has nowhere to go and will be lost by the
-- contract migration. Expected and accepted -- just know what they are.
select s.label, s.car_year, s.car_make, s.car_model, s.monthly_rate
  from public.parking_spots s
 where (s.car_make is not null or s.car_model is not null or s.car_year is not null)
   and not exists (
     select 1 from public.parking_leases l
      where l.parking_spot_id = s.id
        and l.start_date <= current_date
        and (l.end_date is null or l.end_date >= current_date)
   );
```

Expected: the first query lists one row per occupied spot that had a car. The second lists the accepted losses; if it returns rows you care about, stop and copy them somewhere before Task 6 runs the contract migration.

- [ ] **Step 4: Point the old migration at this one**

In `scripts/add-parking-spot-car.sql`, replace the entire opening comment block (lines 1-11, everything above the `ALTER TABLE`) with:

```sql
-- SUPERSEDED (2026-08-11) by scripts/add-parking-lease-vehicle.sql and
-- scripts/drop-parking-spot-vehicle.sql, which move these three columns
-- onto parking_leases. Kept as history: it records that attaching the
-- vehicle to the spot was a deliberate choice before it was reversed.
-- Do not run this on a fresh database -- run the two scripts above.
--
-- Original note follows.
--
-- Vehicle details for a parking spot: which car is parked there.
-- car_year is a smallint rather than text so it sorts and compares
-- numerically. All three are nullable.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/add-parking-lease-vehicle.sql scripts/add-parking-spot-car.sql
git commit -m "feat: add vehicle columns to parking_leases and backfill from spots"
```

---

### Task 2: Move the vehicle through the seam

**Files:**
- Modify: `lib/parking/core.js`
- Modify: `lib/parking/mappers.js:3-20` (`mapParkingSpot`), `lib/parking/mappers.js:32-43` (`mapParkingLease`)
- Test: `lib/parking/core.test.mjs`

**Interfaces:**
- Consumes: `createFakeParkingAdapter` from `./fake.js`.
- Produces:
  - `createSpot(adapter, { landlordId, propertyId, label, type })` — no car, no rate.
  - `updateSpot(adapter, id, { label, type })` — no car, no rate.
  - `createLease(adapter, { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear })`.
  - `updateLease(adapter, id, { rate, endDate, carMake, carModel, carYear })` → `Promise<void>`. Throws `updateLease: rate is required` on a non-positive or non-numeric rate.
  - `mapParkingLease(row)` gains `carMake: string`, `carModel: string`, `carYear: number|null`.
  - `mapParkingSpot(row)` loses `carMake`, `carModel`, `carYear`, `monthlyRate`.

**Note:** after this task the app renders an occupied card without its car line until Task 4 rewires the UI. That is expected and transient — the monolith reads `spot.carMake`, which becomes `undefined` and renders as nothing. It does not crash.

- [ ] **Step 1: Write the failing tests**

In `lib/parking/core.test.mjs`, add `updateLease` to the import on line 4:

```js
import { createSpot, updateSpot, setMarketStatus, deleteSpot, createLease, updateLease, endLease } from "./core.js";
```

Delete the existing test `"car fields are optional, trimmed, and year is coerced to a number"` (lines 54-77) — its subject moved. Replace it with these three tests, placed just after the `createLease` tests:

```js
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
```

Then strip the car and rate assertions from the two spot tests. Replace `"createSpot writes snake_case fields, defaults market_status, coerces rate to a number"` (lines 8-16) with:

```js
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
```

And replace `"updateSpot edits label/type/rate, trims, and rejects a blank label"` (lines 79-100) with:

```js
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
```

Finally, update the mapper test (lines 167-181) to assert the fields moved:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `updateLease` is not exported from `./core.js` (`SyntaxError: The requested module './core.js' does not provide an export named 'updateLease'`).

- [ ] **Step 3: Move the vehicle in `lib/parking/core.js`**

Replace the `carFields` helper (lines 16-25) with one normalizer and two shape adapters:

```js
// Vehicle fields are all optional. Year is stored numeric, so a blank or
// non-numeric entry becomes null rather than NaN reaching the database.
function normalizeCar({ carMake, carModel, carYear }) {
  const year = carYear === "" || carYear == null ? null : Number(carYear);
  return {
    make: (carMake || "").trim() || null,
    model: (carModel || "").trim() || null,
    year: Number.isFinite(year) ? year : null,
  };
}

// Two shapes for one normalization, named for where each one goes. Direct
// table writes take snake_case columns; route-backed ops take the camelCase
// body the API route parses. Getting these backwards is what broke
// createLease -- see the adapter's comment.
function carColumns(car) {
  const c = normalizeCar(car);
  return { car_make: c.make, car_model: c.model, car_year: c.year };
}

function carPayload(car) {
  const c = normalizeCar(car);
  return { carMake: c.make, carModel: c.model, carYear: c.year };
}
```

Replace `createSpot` and `updateSpot` (lines 27-52) with:

```js
export async function createSpot(adapter, { landlordId, propertyId, label, type }) {
  await adapter.insertSpot({
    landlord_id: landlordId,
    property_id: propertyId,
    label,
    type: normalizeType(type),
  });
}

// Edit a spot's own fields. Deliberately narrow: label and type only.
// property_id is NOT editable -- moving a spot between properties would orphan
// any lease history against a lot it no longer belongs to, and the unique
// (property_id, label) constraint could collide on arrival. Delete and recreate
// instead. market_status has its own op below; it's a toggle, not a form field.
// Rate and vehicle are not here either: both describe the agreement, so they
// live on parking_leases.
export async function updateSpot(adapter, id, { label, type }) {
  const trimmedLabel = (label || "").trim();
  if (!trimmedLabel) throw new Error("updateSpot: label is required");
  await adapter.updateSpot(id, {
    label: trimmedLabel,
    type: normalizeType(type),
  });
}
```

Add the vehicle to `createLease`'s signature and payload:

```js
export async function createLease(adapter, { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear }) {
  const targets = [tenantId, renterId, renter].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error("createLease: exactly one of tenantId, renterId, or renter is required");
  }
  return adapter.createLease({
    landlord_id: landlordId,
    parking_spot_id: parkingSpotId,
    rate: Number(rate),
    start_date: startDate,
    end_date: endDate || null,
    tenant_id: tenantId || null,
    renter_id: renterId || null,
    renter: renter || null,
    ...carColumns({ carMake, carModel, carYear }),
  });
}
```

(Task 3 converts this whole payload to camelCase — leave it snake_case for now so this task's tests stay green against the current fake.)

Add `updateLease` immediately above `endLease`:

```js
// Edit an existing lease's terms. rate is NOT NULL on parking_leases, so a
// blank is rejected here rather than surfaced as a constraint error. endLease
// below stays a separate op: "end this lease today" is a one-click intent from
// the card, not a form submission.
export async function updateLease(adapter, id, { rate, endDate, carMake, carModel, carYear }) {
  const amount = Number(rate);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("updateLease: rate is required");
  await adapter.updateLease(id, {
    rate: amount,
    end_date: endDate || null,
    ...carColumns({ carMake, carModel, carYear }),
  });
}
```

- [ ] **Step 4: Move the fields in `lib/parking/mappers.js`**

Replace `mapParkingSpot` (lines 3-20) with:

```js
export const mapParkingSpot = (s) => ({
  id: s.id,
  landlordId: s.landlord_id,
  propertyId: s.property_id,
  label: s.label,
  // Layout description drawn from SPOT_TYPES (lib/parking/status.js). Normalized
  // to "" so the UI can render it and bind a <Sel> without null checks.
  type: s.type || "",
  marketStatus: s.market_status || "tenant_priority",
  createdAt: s.created_at || null,
  updatedAt: s.updated_at || null,
});
```

Replace `mapParkingLease` (lines 32-43) with:

```js
export const mapParkingLease = (l) => ({
  id: l.id,
  landlordId: l.landlord_id,
  parkingSpotId: l.parking_spot_id,
  tenantId: l.tenant_id || null,
  renterId: l.renter_id || null,
  rate: l.rate,
  startDate: l.start_date,
  endDate: l.end_date || null,
  // The vehicle belongs to the agreement, not the asphalt: it arrives with a
  // lease and leaves with it. Text normalized to "" so the edit modal can bind
  // an <Inp>; year stays null so a missing year never renders as 0.
  carMake: l.car_make || "",
  carModel: l.car_model || "",
  carYear: l.car_year ?? null,
  createdAt: l.created_at || null,
  updatedAt: l.updated_at || null,
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 6: Commit**

```bash
git add lib/parking/core.js lib/parking/mappers.js lib/parking/core.test.mjs
git commit -m "refactor: move parking vehicle from the spot to the lease in the seam"
```

---

### Task 3: Fix the lease-create contract and send the vehicle to the route

The fake currently mirrors the core's payload instead of the route's contract, which is why the camelCase/snake_case mismatch has gone unnoticed. Fix the fake first so it enforces the real contract, watch `createLease` break, then fix it.

**Files:**
- Modify: `lib/parking/fake.js:26-45` (`createLease`)
- Modify: `lib/parking/core.js` (`createLease` payload)
- Modify: `app/api/parking/leases/create/route.js`
- Test: `lib/parking/core.test.mjs`

**Interfaces:**
- Consumes: `createLease` / `updateLease` from Task 2.
- Produces: `adapter.createLease(payload)` where `payload` is camelCase — `{ landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear }` — matching what `app/api/parking/leases/create/route.js` destructures. Rows written into `fake._store.parking_leases` stay snake_case, matching what `mapParkingLease` reads.

- [ ] **Step 1: Make the fake enforce the route's contract**

In `lib/parking/fake.js`, replace `createLease` (lines 26-45) with:

```js
    // Mirrors app/api/parking/leases/create: it receives the camelCase JSON
    // body the route parses, and writes the snake_case row the route inserts.
    // Keeping both shapes honest here is the point -- an earlier version of
    // this fake accepted the core's payload as-is, which let a camelCase /
    // snake_case mismatch with the real route go unnoticed.
    async createLease({ landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear }) {
      if (!landlordId) throw new Error("createLease: landlordId is required");
      if (!parkingSpotId) throw new Error("createLease: parkingSpotId is required");
      if (!startDate) throw new Error("createLease: startDate is required");

      let resolvedRenterId = renterId || null;
      if (!tenantId && !resolvedRenterId) {
        const newRenter = { ...renter, id: `renter-${n++}`, landlord_id: landlordId };
        store.parking_renters.push(newRenter);
        resolvedRenterId = newRenter.id;
      }
      const lease = {
        id: `lease-${n++}`,
        landlord_id: landlordId,
        parking_spot_id: parkingSpotId,
        tenant_id: tenantId || null,
        renter_id: resolvedRenterId,
        rate,
        start_date: startDate,
        end_date: endDate || null,
        car_make: carMake ?? null,
        car_model: carModel ?? null,
        car_year: carYear ?? null,
      };
      store.parking_leases.push(lease);
      return { lease };
    },
```

- [ ] **Step 2: Add a test that pins the payload shape**

Add this test to `lib/parking/core.test.mjs`, just after the other `createLease` tests:

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. The new test fails on the key list (it sees `landlord_id`, `parking_spot_id`, … instead), and the existing `createLease` tests now fail with `createLease: landlordId is required` from the stricter fake. That second failure is the bug reproducing.

- [ ] **Step 4: Send camelCase from `core.js`**

Replace `createLease` in `lib/parking/core.js` with:

```js
// A lease belongs to exactly one of: an existing tenant (tenantId), an
// existing market renter (renterId), or a brand-new market renter (renter:
// {name,email,phone}) that gets created alongside the lease. The DB's CHECK
// constraint is the real guarantee; this check just fails fast with a
// readable message before making a network call.
//
// The payload is camelCase, unlike the spot ops above: it is not a table
// write, it is the JSON body of /api/parking/leases/create, and the route
// destructures camelCase. Routes speak camelCase, tables speak snake_case.
export async function createLease(adapter, { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear }) {
  const targets = [tenantId, renterId, renter].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error("createLease: exactly one of tenantId, renterId, or renter is required");
  }
  return adapter.createLease({
    landlordId,
    parkingSpotId,
    rate: Number(rate),
    startDate,
    endDate: endDate || null,
    tenantId: tenantId || null,
    renterId: renterId || null,
    renter: renter || null,
    ...carPayload({ carMake, carModel, carYear }),
  });
}
```

- [ ] **Step 5: Accept the vehicle in the API route**

In `app/api/parking/leases/create/route.js`, replace the destructure on line 4 with:

```js
  const { landlordId, parkingSpotId, rate, startDate, endDate, tenantId, renterId, renter, carMake, carModel, carYear } = await request.json()
```

Add this just below the `renter.name` guard (after line 17), before the Supabase client is created:

```js
  // car_year is a smallint column. core.js already normalizes, but this route
  // is reachable directly, so coerce here too rather than letting a string or
  // NaN reach Postgres.
  const parsedCarYear = Number(carYear)
  const carColumns = {
    car_make: carMake?.trim() || null,
    car_model: carModel?.trim() || null,
    car_year: Number.isFinite(parsedCarYear) && parsedCarYear > 0 ? parsedCarYear : null,
  }
```

Then add `...carColumns,` to the `parking_leases` insert object, immediately after `end_date: endDate || null,`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add lib/parking/core.js lib/parking/fake.js lib/parking/core.test.mjs app/api/parking/leases/create/route.js
git commit -m "fix: send camelCase to the parking lease route and carry the vehicle"
```

---

### Task 4: Strip rate and vehicle out of the spot UI

No unit tests: `property-management-app.jsx` has no test harness. Verification is `npm run build` plus a browser pass in Task 5, once both halves of the UI are in place.

**Files:**
- Modify: `property-management-app.jsx` — `EMPTY_SPOT_FORM` (2621), `openEditSpot` (2719-2732), `saveSpot` (2743-2748), `openAddLease` (2777-2781), the spot card (2870-2876), the spot modal (2935-2943), the detail modal (2996, 3007-3009)

**Interfaces:**
- Consumes: `mapParkingSpot` without `monthlyRate` / car fields (Task 2); `mx.createSpot` / `mx.updateSpot` without them (Task 2).
- Produces: a spot form of `{ propertyId, label, type }` only.

- [ ] **Step 1: Shrink the spot form state**

Replace line 2621:

```js
const EMPTY_SPOT_FORM = { propertyId: "", label: "", type: "" };
```

Replace `openEditSpot`'s `setSpotForm` call (lines 2721-2729) with:

```js
    setSpotForm({
      propertyId: spot.propertyId,
      label: spot.label,
      type: spot.type || "",
    });
```

Replace the body of the `try` in `saveSpot` (lines 2743-2748) with:

```js
      if (editingSpot) {
        await mx.updateSpot(editingSpot.id, { label: spotForm.label, type: spotForm.type });
      } else {
        await mx.createSpot({ landlordId: user.id, propertyId: spotForm.propertyId, label: spotForm.label.trim(), type: spotForm.type });
      }
```

- [ ] **Step 2: Drop the rate prefill from the lease form**

Replace `openAddLease` (lines 2777-2781) with:

```js
  const openAddLease = (spot) => {
    setLeaseSpot(spot);
    // No rate prefill: the spot no longer carries an asking rate. The lease's
    // rate is the only rate there is, and it is entered here.
    setLeaseForm({ ...EMPTY_LEASE_FORM, startDate: todayStr() });
    setLeaseError(null);
  };
```

- [ ] **Step 3: Rewrite the spot card's detail lines**

Replace lines 2870-2876 (the IIFE that renders the car, plus the rate line that follows) with:

```js
                          {/* "2019 Honda Civic" from whichever parts the active
                              lease filled in; nothing renders if none are, and a
                              vacant spot shows no vehicle at all. */}
                          {(() => {
                            const car = occ ? [occ.lease.carYear, occ.lease.carMake, occ.lease.carModel].filter(Boolean).join(" ") : "";
                            return car ? <div style={{ fontSize: 12, color: "#111111", fontWeight: 600 }}>{car}</div> : null;
                          })()}
```

The `$X/mo` line is deleted outright — an occupied card already prints the lease's rate below, and a vacant spot has no rate to show.

- [ ] **Step 4: Remove rate and vehicle from the spot modal**

Delete lines 2935-2943 entirely — the `parkMonthlyRate` `<Inp>` and the whole `<div>` holding the VEHICLE heading with its three inputs. The modal ends after the type `<Sel>` and goes straight into `{spotError && …}`.

- [ ] **Step 5: Move the vehicle row in the detail modal**

Delete line 2996 (`const car = [spot.carYear, …]`).

Replace the four `DetailRow`s at lines 3006-3009 with three:

```js
            <DetailRow label={t.selectProperty} value={prop?.address || t.parkUnknownProperty} />
            <DetailRow label={t.parkSpotType} value={spot.type} />
```

(`t.parkVehicle` and `t.parkMonthlyRate` move under the Parking Lease heading.) Then, in the occupied branch, replace the three lease `DetailRow`s at lines 3024-3026 with four:

```js
                  <DetailRow label={t.parkMonthlyRate} value={fmt(occ.lease.rate)} />
                  <DetailRow label={t.startDate} value={fmtDate(occ.lease.startDate)} />
                  <DetailRow label={t.endDate} value={occ.lease.endDate ? fmtDate(occ.lease.endDate) : t.parkOngoing} />
                  <DetailRow label={t.parkVehicle} value={[occ.lease.carYear, occ.lease.carMake, occ.lease.carModel].filter(Boolean).join(" ")} />
```

- [ ] **Step 6: Verify nothing still reads the removed fields**

Run: `grep -n "spot\.monthlyRate\|spot\.carMake\|spot\.carModel\|spot\.carYear\|spotForm\.monthlyRate\|spotForm\.car" property-management-app.jsx`
Expected: no output.

Run: `npm test && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add property-management-app.jsx
git commit -m "refactor: drop rate and vehicle from the parking spot UI"
```

---

### Task 5: Vehicle on the lease form, and a new Edit Lease modal

**Files:**
- Modify: `property-management-app.jsx` — `T.en` (~330-347) and `T.zh` (~627-644), `EMPTY_LEASE_FORM` (2622), `ParkingPage` state and handlers (~2697-2812), the add-lease modal (2954-2976), the spot card's occupied branch (2896-2903), the detail modal's action rows (3027-3030)

**Interfaces:**
- Consumes: `updateLease(adapter, id, { rate, endDate, carMake, carModel, carYear })` from Task 2, exposed as `mx.updateLease(id, patch)`.
- Produces: nothing downstream.

- [ ] **Step 1: Add the three new strings to both languages**

In `T.en`, after line 340 (`parkEndLease: …`), add:

```js
    parkEditLease: "Edit Lease", parkEditLeaseTitle: "Edit Parking Lease",
    parkFailedUpdateLease: "Failed to update lease.",
```

In `T.zh`, after the matching `parkEndLease` line (~637), add:

```js
    parkEditLease: "编辑租约", parkEditLeaseTitle: "编辑车位租约",
    parkFailedUpdateLease: "更新租约失败。",
```

- [ ] **Step 2: Expose `updateLease` on the mutations hook**

`useParkingMutations` is at `property-management-app.jsx:3526`. Add this line to its returned object, directly above the existing `endLease` entry:

```js
    updateLease: (id, fields) => parkingOps.updateLease(adapter, id, fields),
```

Do not wrap it in `useMemo`/`useCallback` — the React Compiler handles memoization here and a manual one is a lint error.

- [ ] **Step 3: Add the vehicle to the lease form state**

Replace line 2622:

```js
const EMPTY_LEASE_FORM = { renterType: "tenant", tenantId: "", renterName: "", renterEmail: "", renterPhone: "", rate: "", startDate: "", endDate: "", carMake: "", carModel: "", carYear: "" };
```

Add the car fields to the `mx.createLease` call inside `saveLease` (after `endDate:` on line 2795):

```js
        carMake: leaseForm.carMake,
        carModel: leaseForm.carModel,
        carYear: leaseForm.carYear,
```

- [ ] **Step 4: Add the vehicle section to the add-lease modal**

Insert this between the `endDate` `<Inp>` (line 2972) and the `{leaseError && …}` line:

```jsx
          <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 14, marginTop: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>{t.parkVehicle}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label={t.parkCarMake} value={leaseForm.carMake} onChange={v => setLF("carMake", v)} placeholder="Honda" />
              <Inp label={t.parkCarModel} value={leaseForm.carModel} onChange={v => setLF("carModel", v)} placeholder="Civic" />
            </div>
            <Inp label={t.parkCarYear} value={leaseForm.carYear} onChange={v => setLF("carYear", v)} type="number" placeholder="2019" />
          </div>
```

The heading `<div>` repeats the VEHICLE-heading style now used twice in this file. Hoist it to a file-level const next to `detailSectionHeading` (line 2627) and spread it in both places:

```js
const vehicleSectionHeading = { fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 };
```

- [ ] **Step 5: Add the edit-lease state and handler**

Add alongside the other `ParkingPage` state (after line 2701):

```js
  // The lease being edited, or null. Holds the lease itself rather than an id:
  // unlike the spot detail modal, this one is a form seeded once on open, so a
  // mid-edit refresh must not overwrite what the user is typing.
  const [editingLease, setEditingLease] = useState(null);
  const [leaseEditForm, setLeaseEditForm] = useState({ rate: "", endDate: "", carMake: "", carModel: "", carYear: "" });
  const setLEF = (k, v) => setLeaseEditForm(f => ({ ...f, [k]: v }));
  const [leaseEditError, setLeaseEditError] = useState(null);
  const [savingLeaseEdit, setSavingLeaseEdit] = useState(false);
```

Add these two handlers next to `endLeaseNow` (after line 2812):

```js
  const openEditLease = (lease) => {
    setEditingLease(lease);
    setLeaseEditForm({
      rate: lease.rate == null ? "" : String(lease.rate),
      endDate: lease.endDate || "",
      carMake: lease.carMake || "",
      carModel: lease.carModel || "",
      carYear: lease.carYear == null ? "" : String(lease.carYear),
    });
    setLeaseEditError(null);
  };

  const saveLeaseEdit = async () => {
    if (!leaseEditForm.rate) { setLeaseEditError(t.parkLeaseFieldsRequired); return; }
    setSavingLeaseEdit(true);
    setLeaseEditError(null);
    try {
      await mx.updateLease(editingLease.id, leaseEditForm);
      await refresh();
      setEditingLease(null);
    } catch (e) {
      setLeaseEditError(e.message || t.parkFailedUpdateLease);
    }
    setSavingLeaseEdit(false);
  };
```

- [ ] **Step 6: Render the Edit Lease modal**

Insert this immediately after the add-lease modal's closing `)}` (after line 2976):

```jsx
      {editingLease && (
        <Modal title={t.parkEditLeaseTitle} onClose={() => setEditingLease(null)}>
          <Inp label={t.parkMonthlyRate} value={leaseEditForm.rate} onChange={v => setLEF("rate", v)} type="number" placeholder="0" />
          <Inp label={t.endDate} value={leaseEditForm.endDate} onChange={v => setLEF("endDate", v)} type="date" />
          <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 14, marginTop: 2 }}>
            <div style={vehicleSectionHeading}>{t.parkVehicle}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label={t.parkCarMake} value={leaseEditForm.carMake} onChange={v => setLEF("carMake", v)} placeholder="Honda" />
              <Inp label={t.parkCarModel} value={leaseEditForm.carModel} onChange={v => setLEF("carModel", v)} placeholder="Civic" />
            </div>
            <Inp label={t.parkCarYear} value={leaseEditForm.carYear} onChange={v => setLEF("carYear", v)} type="number" placeholder="2019" />
          </div>
          {leaseEditError && <p style={{ color: "#ef4444", fontSize: 13 }}>{leaseEditError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditingLease(null)}>{t.cancel}</Btn>
            <Btn onClick={saveLeaseEdit} disabled={savingLeaseEdit}>{savingLeaseEdit ? t.saving : t.saveChanges}</Btn>
          </div>
        </Modal>
      )}
```

- [ ] **Step 7: Add the entry points**

On the spot card, replace the single End Lease button (line 2902) with a pair:

```jsx
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Btn size="sm" variant="secondary" onClick={() => openEditLease(occ.lease)}>{t.parkEditLease}</Btn>
                            <Btn size="sm" variant="secondary" onClick={() => endLeaseNow(occ.lease)}>{t.parkEndLease}</Btn>
                          </div>
```

In the detail modal's occupied branch, replace the button row at lines 3027-3030 with:

```jsx
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openEditSpot(spot); }}>{t.parkEditSpot}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openEditLease(occ.lease); }}>{t.parkEditLease}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); endLeaseNow(occ.lease); }}>{t.parkEndLease}</Btn>
                  </div>
```

- [ ] **Step 8: Grep the diff for hardcoded strings**

Run: `git diff property-management-app.jsx | grep -nE '^\+.*"[A-Z][a-z]+ ?[a-z]*"' | grep -v 't\.' | grep -v 'style'`
Expected: only the `placeholder="Honda"` / `"Civic"` / `"2019"` sample values, which are data examples rather than UI copy (they match the existing convention in this file). Any other quoted English is a bug — add it to `T.en` and `T.zh` and reference `t.keyName`.

- [ ] **Step 9: Verify the build**

Run: `npm test && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 10: Browser pass**

Run `npm run dev`, sign in, open Parking. Confirm all six:
1. Add Spot shows only property, label, type — no rate, no vehicle.
2. Add Parking Lease shows a blank rate and a VEHICLE section; creating a lease for a **market renter** succeeds (this is the path Task 3 unbroke).
3. The occupied card shows the car, the lease rate, and both Edit Lease and End Lease.
4. Edit Lease opens seeded with current values, saves a changed car and rate, and the card updates.
5. A vacant card shows no price and no vehicle.
6. Clicking a stall in the lot diagram shows Vehicle under the Parking Lease heading, and nothing vehicle-related for a vacant spot.

- [ ] **Step 11: Commit**

```bash
git add property-management-app.jsx
git commit -m "feat: capture and edit the vehicle on the parking lease"
```

---

### Task 6: Contract migration and documentation

**Files:**
- Create: `scripts/drop-parking-spot-vehicle.sql`
- Modify: `CLAUDE.md` (Architecture → Parking module; Database Tables → `parking_spots` and `parking_leases`; Non-Obvious Decisions → the vehicle entry)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the contract migration**

Create `scripts/drop-parking-spot-vehicle.sql`:

```sql
-- =====================================================================
-- Move the vehicle onto the parking lease (contract half)
--
-- Run scripts/add-parking-lease-vehicle.sql FIRST and deploy the code
-- that reads parking_leases.car_* before running this. Once these
-- columns are gone the old code cannot render a spot's vehicle or rate.
--
-- monthly_rate goes too, and it is not backfilled anywhere: it was an
-- asking rate that prefilled the lease form, and parking_leases.rate --
-- the agreed rate, NOT NULL, already present -- is now the only rate.
-- There is no asking-rate concept afterwards, so a vacant spot shows no
-- price. That is intended, not an oversight.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

begin;

alter table public.parking_spots
  drop column if exists car_make,
  drop column if exists car_model,
  drop column if exists car_year,
  drop column if exists monthly_rate;

commit;
```

- [ ] **Step 2: Run it in Supabase**

Paste into Supabase → SQL Editor and run. Expected: `Success. No rows returned.`

Verify: `select * from public.parking_spots limit 1;` — the four columns are gone.

- [ ] **Step 3: Update CLAUDE.md**

Three edits, all replacing text that now describes the opposite of reality:

**Architecture → Parking module.** In the `lib/parking/` bullet, change the `core.js` description from `(spot CRUD + lease create/end)` to `(spot CRUD + lease create/edit/end)`.

**Database Tables → `parking_spots`.** Delete the sentence `` `car_make`/`car_model`/`car_year` describe the vehicle parked there — attached to the spot, not the lease. `` and replace it with:

```
The spot describes physical reality only: no rate and no vehicle, both of which belong to the lease.
```

**Database Tables → `parking_leases`.** Append to that entry:

```
Carries `rate` (the agreed rate, NOT NULL, the only rate in the system) and the vehicle (`car_make`/`car_model`/`car_year`), which arrive with the lease and leave with it.
```

**Non-Obvious Decisions.** Replace the whole bullet beginning **"A parking spot's vehicle is attached to the spot, not the lease."** with:

```
- **The vehicle and the rate live on the parking lease, not the spot.** `car_make`/`car_model`/`car_year` and the agreed `rate` are all on `parking_leases`; `parking_spots` carries only property, label, `type`, and `market_status`. The vehicle used to sit on the spot for simplicity — one place to look, one modal to edit — but it meant a departed renter's car stayed listed against the asphalt until someone cleared it by hand, with no record of which car occupied a spot when. Now a car arrives with a lease and leaves with it, and past leases retain theirs. The cost, taken knowingly: `parking_spots.monthly_rate` was dropped rather than moved (`parking_leases.rate` already existed), so there is **no asking rate** — a vacant spot shows no price anywhere, and the new-lease form starts blank instead of prefilling. If listing prices ever matter, that is a new column on `parking_spots`, deliberately separate from the agreed rate. Migration: `scripts/add-parking-lease-vehicle.sql` then `scripts/drop-parking-spot-vehicle.sql`.
```

- [ ] **Step 4: Add the CHANGELOG entry**

Insert at the top of `CHANGELOG.md`, directly under the `# Changelog` heading:

```markdown
## [2026-08-11]

### Changed
- **The vehicle and the rate moved from the parking spot to the parking lease.** `car_make`/`car_model`/`car_year` are now columns on `parking_leases`, so a car arrives with a lease and leaves with it instead of sitting on the spot until someone cleared it by hand. `parking_spots.monthly_rate` was dropped outright rather than moved — `parking_leases.rate` already existed and was `NOT NULL`, so the spot column was a duplicate acting as an asking rate. Consequence taken knowingly: there is no asking-rate concept now, so a vacant spot shows no price and the new-lease form no longer prefills. Two migrations, expand then contract: `scripts/add-parking-lease-vehicle.sql` (add + backfill onto each spot's currently-active lease) and `scripts/drop-parking-spot-vehicle.sql`. Car data on a spot with no active lease, and every `monthly_rate` value, were discarded.
- The Add/Edit Parking Spot modal is down to property, label, and type. `updateSpot`/`createSpot` no longer accept a rate or a vehicle, and `mapParkingSpot` no longer returns them.

### Added
- **Edit Parking Lease** modal (rate, end date, vehicle), reachable from the occupied spot card and the lot-diagram detail modal. Backed by a new `updateLease` op in `lib/parking/core.js`. Until now a lease could only be created and ended, so a mistyped rate or a renter's new car had no fix short of ending the lease.

### Fixed
- **Creating a parking lease could not succeed.** `lib/parking/core.js`'s `createLease` built a snake_case payload (`landlord_id`, `parking_spot_id`, `start_date`, …) which `adapter.js` POSTs verbatim to `/api/parking/leases/create`, but that route destructures camelCase — every field except `rate` and `renter` arrived `undefined` and the route returned `400 landlordId is required`. The tests missed it because `fake.js` mirrored the core's payload rather than the route's contract, so the fake and the real adapter disagreed and only the fake was exercised. Route-backed adapter ops now send camelCase (routes speak camelCase, direct table writes speak snake_case), the fake validates the same required fields the route does, and a regression test pins the payload's key set.
```

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run build`
Expected: tests PASS, build succeeds.

```bash
git add scripts/drop-parking-spot-vehicle.sql CLAUDE.md CHANGELOG.md
git commit -m "docs: record the parking vehicle/rate move to the lease"
```

---

## Self-review notes

- **Spec coverage:** schema → Tasks 1 and 6; `lib/parking` → Task 2; API route → Task 3; UI → Tasks 4 and 5; docs → Task 6; testing → Task 2 (unit), Task 5 step 10 (manual). The spec's expand/contract split is realized as two scripts rather than one, which is a refinement, not a gap.
- **Beyond the spec:** the `createLease` camelCase/snake_case defect was found while writing Task 3 and is folded in, since the vehicle-on-create feature is unreachable without it.
- **Type consistency:** `carMake`/`carModel`/`carYear` (camelCase) at every JS boundary; `car_make`/`car_model`/`car_year` only in SQL, in `carColumns()`, and in the fake's stored rows. `updateLease` is named identically in core, the hook, and both call sites.
