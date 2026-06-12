// Event-type metadata + date resolution shared by the test-send route and the
// cron engine. An automation's event_type maps to a date on the tenant/contract;
// reminders fire `offset_days` before that date.

import { daysBetween } from "./format.js";

export const EVENT_TYPES = [
  { value: "move_out",           label: "Move-out date" },
  { value: "move_in",            label: "Move-in date" },
  { value: "lease_end",          label: "Lease end date" },
  { value: "projected_move_out", label: "Projected move-out" },
  { value: "rent_due",           label: "Rent due" },
];

// Next rent-due date (YYYY-MM-DD) from a contract's due day, relative to `from`.
export function nextRentDue(dueDay, from = new Date()) {
  if (!dueDay) return null;
  const base = typeof from === "string" ? new Date(`${from}T00:00:00`) : new Date(from);
  base.setHours(0, 0, 0, 0);
  const y = base.getFullYear();
  const m = base.getMonth();
  const clamp = (year, month) => Math.min(dueDay, new Date(year, month + 1, 0).getDate());
  let due = new Date(y, m, clamp(y, m));
  if (due < base) {
    const ny = m === 11 ? y + 1 : y;
    const nm = m === 11 ? 0 : m + 1;
    due = new Date(ny, nm, clamp(ny, nm));
  }
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  return iso;
}

// The date a reminder of `eventType` is anchored to (YYYY-MM-DD), or null.
export function eventDateFor(eventType, { tenant, contract } = {}, today = new Date()) {
  switch (eventType) {
    case "move_out":           return tenant?.moveOutDate || null;
    case "move_in":            return tenant?.moveInDate || null;
    case "lease_end":          return contract?.endDate || null;
    case "projected_move_out": return tenant?.moveOutDate || contract?.endDate || null;
    case "rent_due":           return nextRentDue(contract?.dueDay, today);
    default:                   return null;
  }
}

// Does a reminder fire today? True when today + offset === eventDate for any offset.
export function offsetsDueToday(eventDate, offsetDays = [], today = new Date()) {
  if (!eventDate) return [];
  const diff = daysBetween(today, eventDate);
  // Only non-negative lead times; a negative offset would re-fire on past events forever.
  return (offsetDays || []).filter((off) => off >= 0 && diff === off);
}
