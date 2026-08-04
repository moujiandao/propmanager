import { test } from "node:test";
import assert from "node:assert/strict";
import { statusFor, statusForRow, isCurrentRow, awaitingMoveInAck, awaitingMoveOutAck, FUTURE, CURRENT, PREVIOUS } from "./status.js";

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

test("awaitingMoveInAck: the move-in day itself counts as arrived", () => {
  assert.equal(awaitingMoveInAck({ moveInDate: "2026-07-26" }, TODAY), true, "today");
  assert.equal(awaitingMoveInAck({ moveInDate: "2026-07-20" }, TODAY), true, "past");
  assert.equal(awaitingMoveInAck({ moveInDate: "2026-07-27" }, TODAY), false, "still upcoming");
});

test("awaitingMoveInAck: a confirmed or dateless move-in is never awaiting", () => {
  assert.equal(awaitingMoveInAck({ moveInDate: "2026-07-20", moveInAckedAt: "2026-07-21T00:00:00Z" }, TODAY), false);
  assert.equal(awaitingMoveInAck({ moveInDate: null }, TODAY), false, "legacy row, already resident");
  assert.equal(awaitingMoveInAck({}, TODAY), false);
  assert.equal(awaitingMoveInAck(undefined, TODAY), false);
});

test("awaitingMoveOutAck: nothing to confirm until the move-out day is over", () => {
  // Mirrors statusFor, where a tenant stays CURRENT through their whole move-out day.
  assert.equal(awaitingMoveOutAck({ moveOutDate: "2026-07-26" }, TODAY), false, "move-out day itself");
  assert.equal(awaitingMoveOutAck({ moveOutDate: "2026-07-25" }, TODAY), true, "yesterday");
  assert.equal(awaitingMoveOutAck({ moveOutDate: "2026-08-30" }, TODAY), false, "upcoming");
});

test("awaitingMoveOutAck: a confirmed or dateless move-out is never awaiting", () => {
  assert.equal(awaitingMoveOutAck({ moveOutDate: "2026-07-01", moveOutAckedAt: "2026-07-02T00:00:00Z" }, TODAY), false);
  assert.equal(awaitingMoveOutAck({ moveOutDate: null }, TODAY), false, "no move-out planned");
});

test("the two acknowledgments are independent of each other", () => {
  const ten = { moveInDate: "2026-07-01", moveInAckedAt: "2026-07-01T00:00:00Z", moveOutDate: "2026-07-25" };
  assert.equal(awaitingMoveInAck(ten, TODAY), false);
  assert.equal(awaitingMoveOutAck(ten, TODAY), true);
});

test("awaitingMoveInAck: a tenant who has already moved out has no pending move-in", () => {
  // A historical tenancy imported with neither date acknowledged must not land
  // in the dashboard's "moving in" column.
  assert.equal(
    awaitingMoveInAck({ moveInDate: "2025-01-01", moveOutDate: "2025-12-31" }, TODAY),
    false,
  );
  // But their unconfirmed move-OUT is still pending.
  assert.equal(
    awaitingMoveOutAck({ moveInDate: "2025-01-01", moveOutDate: "2025-12-31" }, TODAY),
    true,
  );
});

test("awaitingMoveInAck: a move-out still ahead does not suppress the move-in", () => {
  assert.equal(
    awaitingMoveInAck({ moveInDate: "2026-07-01", moveOutDate: "2026-09-30" }, TODAY),
    true,
  );
});
