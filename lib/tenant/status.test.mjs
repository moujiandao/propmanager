import { test } from "node:test";
import assert from "node:assert/strict";
import { statusFor, statusForRow, isCurrentRow, FUTURE, CURRENT, PREVIOUS } from "./status.js";

// Fixed reference day so the boundary cases don't drift with the wall clock.
const TODAY = new Date("2026-07-26T12:00:00");

test("a move-in date still ahead derives FUTURE", () => {
  assert.equal(statusFor({ moveInDate: "2026-08-15" }, TODAY), FUTURE);
  assert.equal(statusFor({ moveInDate: "2026-07-27" }, TODAY), FUTURE, "tomorrow is still future");
});

test("a move-in date reached derives CURRENT, including the move-in day itself", () => {
  assert.equal(statusFor({ moveInDate: "2026-07-26" }, TODAY), CURRENT, "current on the move-in day");
  assert.equal(statusFor({ moveInDate: "2026-07-25" }, TODAY), CURRENT);
  assert.equal(statusFor({ moveInDate: "2025-01-01" }, TODAY), CURRENT);
});

test("a move-out date already past derives PREVIOUS", () => {
  assert.equal(statusFor({ moveInDate: "2025-01-01", moveOutDate: "2026-07-25" }, TODAY), PREVIOUS);
});

test("a tenant stays CURRENT through the whole of their move-out day", () => {
  assert.equal(statusFor({ moveInDate: "2025-01-01", moveOutDate: "2026-07-26" }, TODAY), CURRENT);
  assert.equal(statusFor({ moveInDate: "2025-01-01", moveOutDate: "2026-07-27" }, TODAY), CURRENT);
});

test("a null move-in date means already resident, not future", () => {
  assert.equal(statusFor({ moveInDate: null, moveOutDate: null }, TODAY), CURRENT);
  assert.equal(statusFor({}, TODAY), CURRENT);
  assert.equal(statusFor(undefined, TODAY), CURRENT);
});

test("a future move-out with no move-in is still CURRENT", () => {
  assert.equal(statusFor({ moveOutDate: "2026-12-31" }, TODAY), CURRENT);
});

test("contradictory dates resolve to PREVIOUS — move-out is checked first", () => {
  // Past move-out AND future move-in: bad data, but a departure that already
  // happened is the more consequential fact, so it wins.
  assert.equal(statusFor({ moveInDate: "2026-09-01", moveOutDate: "2026-07-01" }, TODAY), PREVIOUS);
});

test("statusForRow reads snake_case columns and ignores the stored status column", () => {
  // The whole point: a row stored as "current tenant" with a future move-in is
  // the drift this replaces. The stored value must not be consulted.
  assert.equal(statusForRow({ status: "current tenant", move_in_date: "2026-08-15" }, TODAY), FUTURE);
  assert.equal(statusForRow({ status: "previous tenant", move_in_date: "2025-01-01" }, TODAY), CURRENT);
  assert.equal(statusForRow({ status: "active", move_in_date: "2025-01-01", move_out_date: "2026-01-01" }, TODAY), PREVIOUS);
  assert.equal(statusForRow({}, TODAY), CURRENT);
});

test("isCurrentRow is the occupancy predicate the write routes filter on", () => {
  assert.equal(isCurrentRow({ move_in_date: "2025-01-01" }, TODAY), true);
  assert.equal(isCurrentRow({ move_in_date: "2026-08-15" }, TODAY), false, "not moved in yet");
  assert.equal(isCurrentRow({ move_in_date: "2025-01-01", move_out_date: "2026-07-01" }, TODAY), false, "already gone");
});

test("YYYY-MM-DD strings are read as local midnight, not UTC", () => {
  // Guards the rule lib/format's fmtDate carries: a date-only string parsed as
  // UTC would land on the previous day in negative-offset timezones and flip a
  // boundary case. Same-day move-in must be CURRENT regardless of local offset.
  const midnightish = new Date("2026-07-26T00:30:00");
  assert.equal(statusFor({ moveInDate: "2026-07-26" }, midnightish), CURRENT);
  const lateNight = new Date("2026-07-26T23:30:00");
  assert.equal(statusFor({ moveInDate: "2026-07-27" }, lateNight), FUTURE);
});
