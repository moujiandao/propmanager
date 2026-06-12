import { createClient } from '@supabase/supabase-js'
import { renderTemplate, buildContext, sampleContext } from '@/lib/email/merge'
import { eventDateFor } from '@/lib/email/events'
import { loadTenantContext, mapLandlordRow } from '@/lib/email/context'
import { sendEmail } from '@/lib/email/send'

// Test send: renders a template with sample data (or a real tenant's data) and
// sends it to a dummy address so the landlord can preview look + deliverability.
// Logged with is_test=true so it never counts toward automation dedup or stats.
export async function POST(request) {
  const body = await request.json()
  const { landlordId, toEmail, templateId, template: inlineTemplate, tenantId, eventType } = body || {}

  if (!landlordId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!toEmail) return Response.json({ error: 'A test recipient email is required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Resolve the template: inline (unsaved edits) takes precedence over a saved id.
  let template = inlineTemplate
  if (!template && templateId) {
    const { data } = await supabase
      .from('email_templates').select('*').eq('id', templateId).eq('landlord_id', landlordId).maybeSingle()
    if (!data) return Response.json({ error: 'Template not found' }, { status: 404 })
    template = { subject: data.subject, bodyHtml: data.body_html, bodyText: data.body_text }
  }
  if (!template) return Response.json({ error: 'A template or templateId is required' }, { status: 400 })

  // Build context: real tenant data when tenantId given, otherwise sample values.
  let ctx
  if (tenantId) {
    const { data: lRow } = await supabase.from('landlord_profiles').select('id,name').eq('id', landlordId).maybeSingle()
    const { tenant, contract, property, unit } = await loadTenantContext(supabase, { tenantId, landlordId })
    if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 })
    const eventDate = eventType ? eventDateFor(eventType, { tenant, contract }) : null
    ctx = buildContext({ tenant, contract, property, unit, landlord: mapLandlordRow(lRow), eventDate })
  } else {
    ctx = sampleContext()
  }

  const { subject, html, text } = renderTemplate(template, ctx)
  const subjectWithTag = `[TEST] ${subject}`

  const sent = await sendEmail({ to: toEmail, subject: subjectWithTag, html, text, tags: { kind: 'test' } })
  if (sent.error) return Response.json({ error: sent.error }, { status: 502 })

  await supabase.from('email_messages').insert({
    landlord_id: landlordId,
    direction: 'outbound',
    template_id: templateId || null,
    tenant_id: tenantId || null,
    event_type: eventType || null,
    to_email: toEmail,
    from_email: process.env.RESEND_FROM_EMAIL || null,
    subject: subjectWithTag,
    body_html: html,
    body_text: text,
    resend_message_id: sent.id || null,
    status: 'sent',
    is_test: true,
  })

  return Response.json({ ok: true, messageId: sent.id, preview: { subject, html, text } })
}
