import { EMPTY_EMAIL_SETTINGS } from "./constants.js";

// Map an email_settings row (snake_case) to the UI shape, falling back to the
// default settings when there is no row. The one home for this read-shape.
export const mapEmailSettings = (e) => !e ? EMPTY_EMAIL_SETTINGS : ({
  fiveDayReminder: e.five_day_reminder || false,
  dayOfReminder: e.day_of_reminder || false,
  oneDayOverdue: e.one_day_overdue || false,
  threeDayOverdue: e.three_day_overdue || false,
  sevenDayOverdue: e.seven_day_overdue || false,
  templates: e.templates || EMPTY_EMAIL_SETTINGS.templates,
});
