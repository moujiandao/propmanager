// Payment-reminder settings writes, React-free. Owns the field→column mapping so
// no caller needs to know snake_case. Adapter-injected for testability.

import { REMINDER_FIELD_TO_COLUMN } from "./constants.js";

// Set a single reminder toggle (e.g. "fiveDayReminder" -> column
// five_day_reminder), writing the COMPLETE set of flags rather than just the one
// that changed.
//
// Sending only the changed column looks tidier but is unsafe on the write that
// creates the row: the columns left out fall to their database defaults, and
// those defaults are both inconsistent and mostly `true`
// (day_of_reminder/three_day_overdue/seven_day_overdue default true,
// one_day_overdue false). So a landlord enabling one reminder silently switched
// on three more — and this feature emails tenants. Writing every flag makes the
// row fully specified and the operation idempotent, independent of defaults.
//
// `current` is the settings object as the UI holds it (camelCase); anything
// missing is treated as off.
export async function setReminderField(adapter, field, value, current = {}) {
  const column = REMINDER_FIELD_TO_COLUMN[field];
  if (!column) throw new Error(`Unknown reminder field: ${field}`);
  const patch = {};
  for (const [f, col] of Object.entries(REMINDER_FIELD_TO_COLUMN)) {
    patch[col] = f === field ? value : Boolean(current[f]);
  }
  await adapter.upsertSettings(patch);
  return value;
}

// Persist the reminder templates object.
export async function saveTemplates(adapter, templates) {
  await adapter.upsertSettings({ templates });
  return templates;
}
