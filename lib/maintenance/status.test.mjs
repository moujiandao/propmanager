import { test } from "node:test";
import assert from "node:assert/strict";
import { columnOf, isOpen, isWritableStatus, normalizeWriteStatus, COLUMNS, WRITE_STATUSES } from "./status.js";

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
