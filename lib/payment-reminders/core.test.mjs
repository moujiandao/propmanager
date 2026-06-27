import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePaymentReminderAdapter } from "./fake.js";
import { setReminderField, saveTemplates } from "./core.js";
import { mapEmailSettings } from "./mappers.js";
import { EMPTY_EMAIL_SETTINGS } from "./constants.js";

test("setReminderField maps camelCase field to snake_case column", async () => {
  const a = createFakePaymentReminderAdapter();
  await setReminderField(a, "fiveDayReminder", true);
  await setReminderField(a, "sevenDayOverdue", false);
  assert.deepEqual(a._store.patches, [{ five_day_reminder: true }, { seven_day_overdue: false }]);
});

test("setReminderField rejects an unknown field instead of writing garbage", async () => {
  const a = createFakePaymentReminderAdapter();
  await assert.rejects(() => setReminderField(a, "notAField", true), /Unknown reminder field/);
  assert.equal(a._store.patches.length, 0);
});

test("saveTemplates upserts the templates object", async () => {
  const a = createFakePaymentReminderAdapter();
  const tpl = { fiveDayReminder: "hi" };
  await saveTemplates(a, tpl);
  assert.deepEqual(a._store.patches, [{ templates: tpl }]);
});

test("mapEmailSettings returns defaults for a missing row", () => {
  assert.equal(mapEmailSettings(null), EMPTY_EMAIL_SETTINGS);
});

test("mapEmailSettings maps snake_case columns and falls back templates", () => {
  const m = mapEmailSettings({ five_day_reminder: true, seven_day_overdue: true });
  assert.equal(m.fiveDayReminder, true);
  assert.equal(m.sevenDayOverdue, true);
  assert.equal(m.dayOfReminder, false);
  assert.equal(m.templates, EMPTY_EMAIL_SETTINGS.templates); // fallback when row has no templates
});
