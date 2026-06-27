import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, fmtDate, daysBetween } from "./index.js";

test("fmt renders whole-dollar USD and treats null/undefined as $0", () => {
  assert.equal(fmt(1500), "$1,500");
  assert.equal(fmt(0), "$0");
  assert.equal(fmt(null), "$0");
  assert.equal(fmt(undefined), "$0");
});

test("fmtDate returns em-dash for empty and a short US date otherwise", () => {
  assert.equal(fmtDate(""), "—");
  assert.equal(fmtDate(null), "—");
  assert.equal(fmtDate("2026-06-26"), "Jun 26, 2026");
});

test("fmtDate guards YYYY-MM-DD against UTC-midnight off-by-one", () => {
  // The bare `new Date("2026-06-26")` is UTC midnight; in negative-offset zones
  // that renders as the 25th. The T00:00:00 suffix pins it to local midnight.
  assert.equal(fmtDate("2026-06-26"), "Jun 26, 2026");
});

test("daysBetween counts whole days, future positive, guards missing", () => {
  assert.equal(daysBetween("2026-06-26", "2026-06-29"), 3);
  assert.equal(daysBetween("2026-06-29", "2026-06-26"), -3);
  assert.equal(daysBetween("2026-06-26", "2026-06-26"), 0);
  assert.equal(daysBetween(null, "2026-06-26"), null);
  assert.equal(daysBetween("2026-06-26", null), null);
});
