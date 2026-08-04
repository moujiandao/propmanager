import { test } from "node:test";
import assert from "node:assert/strict";
import { columnOf, isOpen, isClosedStatus, nextClosedAt, isWritableStatus, normalizeWriteStatus, COLUMNS, WRITE_STATUSES } from "./status.js";

test("columnOf maps current and legacy statuses onto the three columns", () => {
  assert.equal(columnOf("new"), "new");
  assert.equal(columnOf("in-progress"), "in-progress");
  assert.equal(columnOf("closed"), "closed");
  assert.equal(columnOf("resolved"), "closed"); // legacy lands in Closed
  assert.equal(columnOf("open"), "new");         // legacy lands in New
  assert.equal(columnOf("anything-else"), "new"); // unknown defaults to New
  assert.equal(columnOf(undefined), "new");
});

test("every column is itself a valid columnOf target (no orphan column)", () => {
  for (const c of COLUMNS) assert.equal(columnOf(c), c);
});

test("isOpen is true unless closed/resolved", () => {
  assert.equal(isOpen("new"), true);
  assert.equal(isOpen("in-progress"), true);
  assert.equal(isOpen("open"), true);
  assert.equal(isOpen("closed"), false);
  assert.equal(isOpen("resolved"), false);
});

test("isWritableStatus accepts only the write set; legacy values are not writable", () => {
  assert.deepEqual(WRITE_STATUSES, ["new", "in-progress", "closed"]);
  assert.equal(isWritableStatus("new"), true);
  assert.equal(isWritableStatus("closed"), true);
  assert.equal(isWritableStatus("resolved"), false);
  assert.equal(isWritableStatus("open"), false);
  assert.equal(isWritableStatus("garbage"), false);
});

test("normalizeWriteStatus passes valid through and defaults the rest to new", () => {
  assert.equal(normalizeWriteStatus("in-progress"), "in-progress");
  assert.equal(normalizeWriteStatus("resolved"), "new");
  assert.equal(normalizeWriteStatus(""), "new");
  assert.equal(normalizeWriteStatus(undefined), "new");
});

test("isClosedStatus is the exact complement of isOpen", () => {
  for (const s of ["new", "in-progress", "open", "closed", "resolved", "garbage"]) {
    assert.equal(isClosedStatus(s), !isOpen(s), s);
  }
});

test("nextClosedAt stamps now when a ticket moves into closed", () => {
  assert.equal(nextClosedAt("closed", null, "2026-08-03T17:00:00Z"), "2026-08-03T17:00:00Z");
  assert.equal(nextClosedAt("resolved", null, "2026-08-03T17:00:00Z"), "2026-08-03T17:00:00Z");
});

test("nextClosedAt preserves an existing close date rather than rewriting it", () => {
  assert.equal(
    nextClosedAt("closed", "2026-07-01T09:00:00Z", "2026-08-03T17:00:00Z"),
    "2026-07-01T09:00:00Z",
  );
});

test("nextClosedAt clears the date for every open status", () => {
  for (const s of ["new", "in-progress", "open"]) {
    assert.equal(nextClosedAt(s, "2026-07-01T09:00:00Z", "2026-08-03T17:00:00Z"), null, s);
  }
});
