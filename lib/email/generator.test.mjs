import { test } from "node:test";
import assert from "node:assert/strict";
import * as generator from "./generator.js";

const unit303 = { id: "unit-303", propertyId: "property-a", unitNumber: "303" };

test("generator row includes only tenants occupying the selected unit during the month", () => {
  const tenants = [
    { name: "Alex", email: "alex@example.com", unitId: "unit-303", moveInDate: "2026-06-30", moveOutDate: null },
    { name: "Sam", email: "sam@example.com", unitId: "unit-303", moveInDate: null, moveOutDate: "2026-06-01" },
    { name: "Early", email: "early@example.com", unitId: "unit-303", moveOutDate: "2026-05-31" },
    { name: "Late", email: "late@example.com", unitId: "unit-303", moveInDate: "2026-07-01" },
    { name: "Other", email: "other@example.com", unitId: "unit-304", moveInDate: null, moveOutDate: null },
  ];

  const result = generator.buildGeneratorRow({ tenants, unit: unit303, month: "2026-06", amount: "74.18" });

  assert.deepEqual(result, {
    mergeValues: {
      name: "Alex and Sam",
      unit_number: "303",
      month_year: "June 2026",
      amount: "74.18",
    },
    emailAddresses: "alex@example.com, sam@example.com",
    missingEmailNames: [],
  });
});

test("generator row supports legacy unit text and reports missing tenant emails", () => {
  const tenants = [
    { name: "Brian", email: " brian@example.com ", propertyId: "property-a", unit: "303", moveInDate: null, moveOutDate: null },
    { name: "Jo", email: "", propertyId: "property-a", unit: "303", moveInDate: null, moveOutDate: null },
    { name: "Wrong property", email: "wrong@example.com", propertyId: "property-b", unit: "303", moveInDate: null, moveOutDate: null },
  ];

  const result = generator.buildGeneratorRow({ tenants, unit: unit303, month: "2026-07", amount: 35.74 });

  assert.equal(result?.mergeValues.name, "Brian and Jo");
  assert.equal(result?.mergeValues.month_year, "July 2026");
  assert.equal(result?.emailAddresses, "brian@example.com");
  assert.deepEqual(result?.missingEmailNames, ["Jo"]);
});

test("generator row de-duplicates email addresses and returns empty values for an invalid month", () => {
  const tenants = [
    { name: "Alex", email: "shared@example.com", unitId: "unit-303" },
    { name: "Sam", email: "shared@example.com", unitId: "unit-303" },
  ];

  const valid = generator.buildGeneratorRow({ tenants, unit: unit303, month: "2026-06", amount: "5.46" });
  assert.equal(valid?.emailAddresses, "shared@example.com");

  const invalid = generator.buildGeneratorRow({ tenants, unit: unit303, month: "June 2026", amount: "5.46" });
  assert.deepEqual(invalid, {
    mergeValues: { name: "", unit_number: "303", month_year: "", amount: "5.46" },
    emailAddresses: "",
    missingEmailNames: [],
  });
});

test("generator results remain hidden whenever any table row becomes incomplete", () => {
  assert.equal(generator.isGeneratorTableComplete?.([]), false);
  assert.equal(generator.isGeneratorTableComplete?.([
    { unitId: "unit-303", month: "2026-06", amount: "74.18" },
  ]), true);
  assert.equal(generator.isGeneratorTableComplete?.([
    { unitId: "unit-303", month: "2026-06", amount: "" },
  ]), false);
});

test("email generator offers units only from production properties", () => {
  const active = { id: "active", propertyId: "property-active" };
  const retired = { id: "retired", propertyId: "property-retired" };
  const legacy = { id: "legacy", propertyId: "property-legacy" };

  const result = generator.availableGeneratorUnits?.([active, retired, legacy], [
    { id: "property-active", inProduction: true },
    { id: "property-retired", inProduction: false },
    { id: "property-legacy" },
  ]);

  assert.deepEqual(result, [active, legacy]);
});

test("generator combines same-unit rows with the same recipients into one chronological email", () => {
  const tenants = [
    { id: "alex", name: "Alex", email: "alex@example.com", unitId: "unit-303" },
    { id: "sam", name: "Sam", email: "sam@example.com", unitId: "unit-303" },
  ];
  const rows = [
    { unitId: "unit-303", month: "2026-07", amount: "86.77" },
    { unitId: "unit-303", month: "2026-06", amount: "74.18" },
  ];

  const result = generator.buildGeneratorGroups?.({ rows, units: [unit303], tenants });

  assert.deepEqual(result, [{
    unitId: "unit-303",
    mergeValues: {
      name: "Alex and Sam",
      unit_number: "303",
      month_year: "June 2026, July 2026",
      amount: "160.95",
      bill_lines: "June 2026: $74.18\nJuly 2026: $86.77",
    },
    emailAddresses: "alex@example.com, sam@example.com",
    missingEmailNames: [],
  }]);
});

test("generator splits a unit into separate emails when its occupants change", () => {
  const tenants = [
    { id: "alex", name: "Alex", email: "alex@example.com", unitId: "unit-303", moveOutDate: "2026-06-30" },
    { id: "sam", name: "Sam", email: "sam@example.com", unitId: "unit-303", moveInDate: "2026-07-01" },
  ];
  const rows = [
    { unitId: "unit-303", month: "2026-06", amount: "74.18" },
    { unitId: "unit-303", month: "2026-07", amount: "86.77" },
  ];

  const result = generator.buildGeneratorGroups?.({ rows, units: [unit303], tenants });

  assert.deepEqual(result?.map(group => ({
    name: group.mergeValues.name,
    month: group.mergeValues.month_year,
    emailAddresses: group.emailAddresses,
  })), [
    { name: "Alex", month: "June 2026", emailAddresses: "alex@example.com" },
    { name: "Sam", month: "July 2026", emailAddresses: "sam@example.com" },
  ]);
});
