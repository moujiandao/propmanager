# Move vehicle and rate from the parking spot to the parking lease

**Date:** 2026-08-11
**Status:** Approved, ready for implementation plan

## Problem

`parking_spots` currently carries `car_make` / `car_model` / `car_year` and `monthly_rate`.
Both describe an *agreement*, not a piece of asphalt:

- The vehicle belongs to whoever is leasing the spot. When a lease ends today, the previous
  renter's car stays listed against the spot until somebody manually clears it, and there is
  no record of which car occupied which spot when. This tradeoff was made knowingly (see
  `scripts/add-parking-spot-car.sql`) and is now being reversed.
- `parking_spots.monthly_rate` duplicates `parking_leases.rate`, which already exists and is
  `NOT NULL`. The spot column functioned as an "asking rate" that prefilled the lease form.

## Goal

A parking spot describes physical reality only: property, label, layout type, market status.
Everything about the deal — who, how much, when, and which car — lives on `parking_leases`.

## Decisions

| Decision | Choice | Rejected alternative |
|---|---|---|
| `parking_spots.monthly_rate` | Drop the column entirely | Keep it, relabelled "Asking Rate", still prefilling the lease form. Rejected: leaves two rate columns and the concept the user is trying to remove. |
| Editing the vehicle after lease creation | New **Edit Lease** modal (rate, end date, vehicle) | Vehicle immutable after create; correct a typo by ending the lease and starting a new one. Rejected: a typo becomes unfixable in the UI, and no edit-lease path exists today regardless. |
| `endLease` vs the new `updateLease` | Keep both as separate core ops | Fold ending into `updateLease`. Rejected: "End Lease" is a distinct one-click intent on the card and reads clearly as its own op. |

### Accepted data loss

The migration destroys data. This is accepted, not overlooked:

1. Car fields on a spot with **no currently active lease** have nowhere to land and are discarded.
2. Every `parking_spots.monthly_rate` value is dropped. There is no asking-rate concept afterwards,
   so a vacant spot displays no price anywhere in the UI.

The backfill runs before the drop inside one transaction, so an aborted run leaves the old columns intact.

## Changes

### 1. Schema — `scripts/move-parking-vehicle-to-lease.sql`

Idempotent, single transaction, run in Supabase → SQL Editor (same convention as the other scripts).

1. Add `car_make text`, `car_model text`, `car_year smallint` to `parking_leases` (all nullable).
2. Backfill each spot's car fields onto that spot's currently active lease, where "active" is
   `start_date <= today and (end_date is null or end_date >= today)` — the same rule
   `lib/parking/status.js` derives occupancy from.
3. Drop `car_make`, `car_model`, `car_year`, `monthly_rate` from `parking_spots`.

`scripts/add-parking-spot-car.sql` stays in place as history, with a header note pointing here.

### 2. `lib/parking/`

- **`core.js`** — `carFields()` moves off `createSpot`/`updateSpot` and onto `createLease`.
  `updateSpot` loses its `monthlyRate` handling. New op:
  `updateLease(adapter, id, { rate, endDate, carMake, carModel, carYear })`.
  `endLease` is untouched.
- **`mappers.js`** — `mapParkingSpot` loses `carMake` / `carModel` / `carYear` / `monthlyRate`;
  `mapParkingLease` gains them, with the same normalization the spot mapper used
  (`"" ` for the text fields, `null` for a missing year).
- **`fake.js`** — `createLease`'s destructure gains the three car fields so they land in the store.
- **`adapter.js`** — unchanged. `updateLease` already exists on both adapters.

### 3. `app/api/parking/leases/create/route.js`

Accepts and inserts `car_make` / `car_model` / `car_year`. `core.js` normalizes before the
adapter's fetch; the route additionally coerces the year defensively so a direct API call
cannot write a non-numeric value into a `smallint` column.

### 4. UI — `property-management-app.jsx`

- **`EMPTY_SPOT_FORM`** loses `monthlyRate`, `carMake`, `carModel`, `carYear`.
  **`EMPTY_LEASE_FORM`** gains the three car fields.
- **Add/Edit Spot modal** — the Monthly Rate input and the entire VEHICLE section are removed.
  The modal is reduced to property, label, and type.
- **Add Lease modal** — gains the VEHICLE section, reusing the existing two-column make/model
  layout with year beneath. The rate field starts blank (`openAddLease` no longer prefills
  from the spot).
- **Spot card** — the standalone `$X/mo` line is removed. An occupied card already prints
  `$80.00/mo · since Jan 1` from the lease; its car line now reads from `occ.lease` rather
  than `spot`. A vacant card shows no price and no vehicle.
- **Spot detail modal** — the `Vehicle` and `Monthly Rate` rows move out of the spot block and
  under the existing `Parking Lease` heading. A vacant spot shows neither.
- **New Edit Lease modal** — fields: rate, end date, vehicle (make/model/year). Opened from the
  occupied spot card and from the detail modal, alongside Edit Spot and End Lease.
- **Translations** — new keys `parkEditLease`, `parkEditLeaseTitle`, `parkFailedUpdateLease`
  added to both `T.en` and `T.zh` before use, per the project translation rule.
  `parkVehicle` / `parkCarMake` / `parkCarModel` / `parkCarYear` / `parkMonthlyRate` are all
  retained — they move to new call sites rather than disappearing.

### 5. Documentation

- **CLAUDE.md** — the Non-Obvious Decision *"A parking spot's vehicle is attached to the spot,
  not the lease"* currently documents the opposite of this design and must be rewritten, not
  merely amended. The `parking_spots` and `parking_leases` entries under Database Tables, and
  the Parking module description under Architecture, are updated to match.
- **CHANGELOG.md** — a `### Changed` entry under today's date.

## Testing

- **Unit (`npm test`)** — car-field assertions move from the `createSpot`/`updateSpot` tests to
  `createLease`. New `updateLease` tests cover rate coercion, blank year → `null`, and a partial
  edit leaving untouched fields alone. Mapper tests assert the fields left `mapParkingSpot` and
  arrived on `mapParkingLease`.
- **Manual** — the migration and the modal wiring are not unit-testable. Verify against the dev
  server: create a lease with a vehicle, edit that lease's vehicle and rate, end it, and confirm
  a vacant spot renders no price and no car.

## Out of scope

- Vehicle history across leases. Once the fields are on `parking_leases`, past leases retain the
  car that was on them, which is a side effect of the move rather than a feature being built.
  No UI surfaces prior leases.
- Any asking-rate or listing-price replacement for the dropped `parking_spots.monthly_rate`.
