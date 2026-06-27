// Payment-reminder settings writes, React-free. Owns the field→column mapping so
// no caller needs to know snake_case. Adapter-injected for testability.

import { REMINDER_FIELD_TO_COLUMN } from "./constants.js";

// Set a single reminder toggle (e.g. "fiveDayReminder" -> column five_day_reminder).
export async function setReminderField(adapter, field, value) {
  const column = REMINDER_FIELD_TO_COLUMN[field];
  if (!column) throw new Error(`Unknown reminder field: ${field}`);
  await adapter.upsertSettings({ [column]: value });
  return value;
}

// Persist the reminder templates object.
export async function saveTemplates(adapter, templates) {
  await adapter.upsertSettings({ templates });
  return templates;
}
