import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePaymentReminderAdapter } from "./fake.js";
import { setReminderField, saveTemplates } from "./core.js";
import { mapEmailSettings } from "./mappers.js";
import { EMPTY_EMAIL_SETTINGS } from "./constants.js";

test("setReminderField maps camelCase field to snake_case column", async () => {
  const a = createFakePaymentReminderAdapter("team-1");
  await setReminderField(a, "fiveDayReminder", true);
  assert.equal(a._store.patches[0].five_day_reminder, true);
  await setReminderField(a, "sevenDayOverdue", false);
  assert.equal(a._store.patches[1].seven_day_overdue, false);
});

// Regression: every write omitted landlord_id, so the row failed
// is_team_member(null) and came back 403 — the toggle flipped and then silently
// reverted. RLS checks landlord_id, it does not supply one.
test("every write carries landlord_id, or RLS rejects the row", async () => {
  const a = createFakePaymentReminderAdapter("team-1");
  await setReminderField(a, "fiveDayReminder", true);
  await saveTemplates(a, { fiveDayReminder: "hi" });
  for (const patch of a._store.patches) {
    assert.equal(patch.landlord_id, "team-1");
  }
});

// Regression: a partial patch let the untouched columns fall to their DB
// defaults on the insert that creates the row — and those defaults are
// inconsistent and mostly `true`, so enabling one reminder switched on three
// more. This feature emails tenants, so the write must be fully specified.
test("setReminderField writes every flag, never a partial patch", async () => {
  const a = createFakePaymentReminderAdapter("team-1");
  await setReminderField(a, "fiveDayReminder", true, {});
  assert.deepEqual(a._store.patches[0], {
    landlord_id: "team-1",
    five_day_reminder: true,
    day_of_reminder: false,
    one_day_overdue: false,
    three_day_overdue: false,
    seven_day_overdue: false,
  });
});

test("setReminderField preserves the other flags' current values", async () => {
  const a = createFakePaymentReminderAdapter("team-1");
  const current = { fiveDayReminder: true, sevenDayOverdue: true, dayOfReminder: false };
  await setReminderField(a, "oneDayOverdue", true, current);
  assert.deepEqual(a._store.patches[0], {
    landlord_id: "team-1",
    five_day_reminder: true,
    day_of_reminder: false,
    one_day_overdue: true,
    three_day_overdue: false,
    seven_day_overdue: true,
  });
});

test("the adapter refuses to be built without a landlord id", async () => {
  assert.throws(() => createFakePaymentReminderAdapter(null), /landlordId is required/);
});

test("setReminderField rejects an unknown field instead of writing garbage", async () => {
  const a = createFakePaymentReminderAdapter();
  await assert.rejects(() => setReminderField(a, "notAField", true), /Unknown reminder field/);
  assert.equal(a._store.patches.length, 0);
});

test("saveTemplates upserts the templates object", async () => {
  const a = createFakePaymentReminderAdapter("team-1");
  const tpl = { fiveDayReminder: "hi" };
  await saveTemplates(a, tpl);
  assert.deepEqual(a._store.patches, [{ templates: tpl, landlord_id: "team-1" }]);
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
