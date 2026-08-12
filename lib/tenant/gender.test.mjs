import { test } from "node:test";
import assert from "node:assert/strict";
import { GENDERS, isValidGender, normalizeGender, genderMark } from "./gender.js";

test("gender is optional: blank, null and undefined are all valid and unmarked", () => {
  for (const blank of ["", null, undefined, "   "]) {
    assert.equal(isValidGender(blank), true, `${JSON.stringify(blank)} should be valid`);
    assert.equal(normalizeGender(blank), null, "blank normalizes to null, never an empty string");
    assert.equal(genderMark(blank), null, "unset draws no mark rather than a placeholder");
  }
});

test("every listed gender is valid, normalizes to itself, and has a mark", () => {
  for (const g of GENDERS) {
    assert.equal(isValidGender(g), true);
    assert.equal(normalizeGender(g), g);
    const mark = genderMark(g);
    assert.ok(mark, `${g} should have a mark`);
    assert.equal(typeof mark.symbol, "string");
    assert.match(mark.color, /^#[0-9a-f]{6}$/i, `${g}'s colour should be a hex value`);
  }
  // The pairing is the point: a value added to GENDERS without a mark would
  // render as a nameless blank next to somebody's name.
  assert.equal(GENDERS.filter((g) => !genderMark(g)).length, 0, "every gender must declare a mark");
});

test("normalizeGender trims and lowercases, so a seed script can't write a variant", () => {
  assert.equal(normalizeGender("  Male  "), "male");
  assert.equal(normalizeGender("FEMALE"), "female");
});

test("an unrecognized value is rejected rather than written through", () => {
  // This is the guard that makes the picklist real for every caller, not just
  // the dropdown -- the column has no CHECK to fall back on.
  assert.equal(isValidGender("attack helicopter"), false);
  assert.equal(normalizeGender("attack helicopter"), null);
  assert.equal(genderMark("attack helicopter"), null);
});

test("male and female are distinguishable by both symbol and colour", () => {
  // Colour alone would be invisible to a colourblind or monochrome reader, so
  // the symbol has to carry the meaning on its own.
  const m = genderMark("male");
  const f = genderMark("female");
  assert.notEqual(m.symbol, f.symbol);
  assert.notEqual(m.color, f.color);
});
