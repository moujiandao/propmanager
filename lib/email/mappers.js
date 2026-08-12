// The one home for the camelCase read-shapes of the Email Automation tables:
// `email_templates`, `email_automations` and `email_messages`.
//
// Distinct from the older "Payment Reminders" feature, whose single
// `email_settings` row is mapped by lib/payment-reminders/mappers.
export const mapEmailTemplate = (e) => ({
  id: e.id,
  name: e.name,
  subject: e.subject || '',
  bodyHtml: e.body_html || '',
  bodyText: e.body_text || '',
  updatedAt: e.updated_at,
  createdAt: e.created_at,
});

export const mapEmailAutomation = (a) => ({
  id: a.id,
  name: a.name,
  eventType: a.event_type,
  offsetDays: a.offset_days || [],
  templateId: a.template_id || null,
  scope: a.scope || null,
  enabled: a.enabled || false,
});

export const mapEmailMessage = (m) => ({
  id: m.id,
  direction: m.direction,
  automationId: m.automation_id || null,
  templateId: m.template_id || null,
  tenantId: m.tenant_id || null,
  eventType: m.event_type || null,
  eventDate: m.event_date || null,
  toEmail: m.to_email || '',
  subject: m.subject || '',
  bodyHtml: m.body_html || '',
  bodyText: m.body_text || '',
  status: m.status,
  deliveredAt: m.delivered_at || null,
  openedAt: m.opened_at || null,
  repliedAt: m.replied_at || null,
  replyToMessageId: m.reply_to_message_id || null,
  isTest: m.is_test || false,
  createdAt: m.created_at,
});
