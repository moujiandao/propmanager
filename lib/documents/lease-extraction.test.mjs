import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewedLeaseImport } from "./lease-extraction.js";

const extracted = {
  tenant_name: "Avery Chen",
  housemates: ["Jordan Singh"],
  lease_start_date: "2026-10-01",
  lease_end_date: "2027-09-30",
  rent_amount: "2400",
  email: "avery@example.com",
  phone: "+1 (415) 555-0100",
};

test("reviewed import keeps a two-person lease together and applies contact data only to the primary tenant", () => {
  const result = reviewedLeaseImport(extracted, {
    approvedTenants: ["Avery Chen", "Jordan Singh"],
    approvedFields: { lease_start_date: true, lease_end_date: true, rent_amount: true, email: true, phone: true },
  });
  assert.deepEqual(result.people, ["Avery Chen", "Jordan Singh"]);
  assert.deepEqual(result.contract, { startDate: "2026-10-01", endDate: "2027-09-30", rentAmount: 2400 });
  assert.equal(result.primaryProfile.email, "avery@example.com");
});

test("reviewed import rejects malformed approved contact values before it creates tenant records", () => {
  assert.throws(
    () => reviewedLeaseImport({ ...extracted, email: "not-an-email" }, { approvedFields: { email: true } }),
    /email is malformed/,
  );
  assert.throws(
    () => reviewedLeaseImport({ ...extracted, tenant_name: "12345" }),
    /valid name/,
  );
});

test("reviewed import requires the reviewed contract essentials together", () => {
  assert.throws(
    () => reviewedLeaseImport({ ...extracted, rent_amount: null }, { approvedFields: { lease_start_date: true } }),
    /start date and rent amount/,
  );
  assert.throws(
    () => reviewedLeaseImport({ ...extracted, lease_end_date: "2026-09-01" }),
    /cannot precede/,
  );
});
