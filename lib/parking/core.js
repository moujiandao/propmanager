// Parking writes. React-free, adapter-injected -- mirrors lib/property/core.js.

import { isValidSpotType } from "./status.js";

const MARKET_STATUSES = ["tenant_priority", "open_market"];

// Optional layout type, validated against the SPOT_TYPES vocabulary in status.js.
// Trimmed; empty -> null so the column holds a real value or nothing, never a
// blank string to filter on.
function normalizeType(type) {
  const trimmed = (type || "").trim();
  if (!isValidSpotType(trimmed)) throw new Error(`invalid spot type "${trimmed}"`);
  return trimmed || null;
}

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
// body the API route parses. Getting these backwards is what broke createLease
// -- see its comment below.
function carColumns(car) {
  const c = normalizeCar(car);
  return { car_make: c.make, car_model: c.model, car_year: c.year };
}

function carPayload(car) {
  const c = normalizeCar(car);
  return { carMake: c.make, carModel: c.model, carYear: c.year };
}

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
// instead. market_status has its own op above; it's a toggle, not a form field.
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

export async function setMarketStatus(adapter, id, marketStatus) {
  if (!MARKET_STATUSES.includes(marketStatus)) {
    throw new Error(`setMarketStatus: invalid market_status "${marketStatus}"`);
  }
  await adapter.updateSpot(id, { market_status: marketStatus });
}

export async function deleteSpot(adapter, id) {
  await adapter.deleteSpot(id);
}

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

// Edit an existing lease's terms: its dates, its rate, and the vehicle on it.
// rate and start_date are both NOT NULL on parking_leases, so a blank is
// rejected here rather than surfaced as a constraint error.
//
// What is NOT editable is who the lease is for. Moving a lease between a tenant
// and a renter -- or between two tenants -- is not an edit to an agreement, it
// is a different agreement; the CHECK that exactly one of tenant_id/renter_id
// is set exists to keep that unambiguous. Delete and recreate instead, the same
// rule updateSpot follows for a spot's property.
//
// endLease below stays a separate op: "end this lease today" is a one-click
// intent from the card, not a form submission.
export async function updateLease(adapter, id, { rate, startDate, endDate, carMake, carModel, carYear }) {
  const amount = Number(rate);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("updateLease: rate is required");
  if (!startDate) throw new Error("updateLease: startDate is required");
  // The DB has this as a CHECK too; catching it here turns a raw constraint
  // string into something a caller can show.
  if (endDate && endDate < startDate) throw new Error("updateLease: endDate cannot precede startDate");
  await adapter.updateLease(id, {
    rate: amount,
    start_date: startDate,
    end_date: endDate || null,
    ...carColumns({ carMake, carModel, carYear }),
  });
}

// Remove a lease outright. Distinct from endLease: ending one is part of its
// normal life and keeps the record, while deleting says it should never have
// existed. Nothing references parking_leases, so there is no blocker to check --
// unlike deleteUnit, which has to re-read its tenants first.
export async function deleteLease(adapter, id) {
  await adapter.deleteLease(id);
}

// End a lease early (or set its scheduled end date) by writing end_date.
// Occupancy is derived from this via lib/parking/status.js -- no separate
// status column to keep in sync.
export async function endLease(adapter, id, endDate) {
  await adapter.updateLease(id, { end_date: endDate });
}
