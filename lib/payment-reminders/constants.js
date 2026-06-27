// Payment-reminder settings (the older `email_settings` "Payment Reminders"
// feature — distinct from the lib/email automation system). One home for the
// default settings shape and the camelCase-field → snake_case-column mapping
// that was previously hardcoded as KEY_MAP inside the EmailPage component.

export const EMPTY_EMAIL_SETTINGS = {
  fiveDayReminder: false, dayOfReminder: false, oneDayOverdue: false, threeDayOverdue: false, sevenDayOverdue: false,
  templates: {
    fiveDayReminder: "Dear {tenant_name},\n\nThis is a friendly reminder that your rent payment of ${amount} is due in 5 days on {due_date}.\n\nThank you,\n{landlord_name}",
    dayOfReminder: "Dear {tenant_name},\n\nYour rent payment of ${amount} is due today, {due_date}.\n\nThank you,\n{landlord_name}",
    oneDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} was due yesterday. Please make your payment as soon as possible.\n\nThank you,\n{landlord_name}",
    threeDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} is now 3 days overdue. Please contact us immediately.\n\nThank you,\n{landlord_name}",
    sevenDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} is now 7 days overdue. This is your final reminder before additional action is taken.\n\n{landlord_name}",
  },
};

// camelCase reminder field -> snake_case DB column. The single source for this
// mapping (was duplicated as KEY_MAP in the component).
export const REMINDER_FIELD_TO_COLUMN = {
  fiveDayReminder: "five_day_reminder",
  dayOfReminder: "day_of_reminder",
  oneDayOverdue: "one_day_overdue",
  threeDayOverdue: "three_day_overdue",
  sevenDayOverdue: "seven_day_overdue",
};
