import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, deriveRenewalTerm, pickOriginalLeaseDate } from "./renewal.js";

test("addDays rolls across month/year boundaries (UTC, no off-by-one)", () => {
  assert.equal(addDays("2026-06-30", 1), "2026-07-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays(null, 1), null);
});

test("addMonths clamps to the target month length", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28"); // non-leap
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29"); // leap
  assert.equal(addMonths("2026-07-01", 12), "2027-07-01");
});

test("deriveRenewalTerm: start = end + 1 day, end = +12 months", () => {
  assert.deepEqual(deriveRenewalTerm("2026-06-30"), {
    newTermStart: "2026-07-01",
    newTermEnd: "2027-07-01",
  });
});

test("deriveRenewalTerm: leap-day current end yields a clamped follow-on term", () => {
  // end 2027-02-28 -> start 2027-03-01 -> +12mo 2028-03-01
  assert.deepEqual(deriveRenewalTerm("2027-02-28"), {
    newTermStart: "2027-03-01",
    newTermEnd: "2028-03-01",
  });
});

test("deriveRenewalTerm tolerates a missing end date", () => {
  assert.deepEqual(deriveRenewalTerm(null), { newTermStart: null, newTermEnd: null });
});

test("pickOriginalLeaseDate returns the earliest-created renewal's original date", () => {
  const rows = [
    { original_lease_date: "2024-08-01", created_at: "2025-05-01T10:00:00Z" },
    { original_lease_date: "2024-08-01", created_at: "2024-05-01T10:00:00Z" }, // earliest
  ];
  assert.equal(pickOriginalLeaseDate(rows, "2099-01-01"), "2024-08-01");
});

test("pickOriginalLeaseDate accepts camelCase rows and ignores null originals", () => {
  const rows = [
    { originalLeaseDate: null, createdAt: "2024-01-01T00:00:00Z" },
    { originalLeaseDate: "2024-08-01", createdAt: "2024-06-01T00:00:00Z" },
  ];
  assert.equal(pickOriginalLeaseDate(rows, "2099-01-01"), "2024-08-01");
});

test("pickOriginalLeaseDate falls back to the contract start when no chain exists", () => {
  assert.equal(pickOriginalLeaseDate([], "2024-08-01"), "2024-08-01");
  assert.equal(pickOriginalLeaseDate(null, "2024-08-01"), "2024-08-01");
});
