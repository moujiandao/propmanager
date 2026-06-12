import { createClient } from '@supabase/supabase-js'
import { renderTemplate, buildContext } from '@/lib/email/merge'
import { eventDateFor } from '@/lib/email/events'
import { loadTenantContext, mapLandlordRow } from '@/lib/email/context'
import { sendEmail, replyToAddress } from '@/lib/email/send'

// Manual send: render a template for a real tenant and send immediately. Logs a
// real outbound row (is_test=false, automation_id=null) so it shows in the inbox
// and can receive a tracked reply.
export async function POST(request) {
  const { landlordId, templateId, tenantId, eventType } = (await request.json()) || {}

  if (!landlordId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!templateId || !tenantId) return Response.json({ error: 'templateId and tenantId are required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: tpl } = await supabase
    .from('email_templates').select('*').eq('id', templateId).eq('landlord_id', landlordId).maybeSingle()
  if (!tpl) return Response.json({ error: 'Template not found' }, { status: 404 })

  const { data: lRow } = await supabase.from('landlord_profiles').select('id,name').eq('id', landlordId).maybeSingle()
  const { tenant, contract, property, unit } = await loadTenantContext(supabase, { tenantId, landlordId })
  if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.email) return Response.json({ error: 'Tenant has no email on file' }, { status: 400 })

  const eventDate = eventType ? eventDateFor(eventType, { tenant, contract }) : null
  const ctx = buildContext({ tenant, contract, property, unit, landlord: mapLandlordRow(lRow), eventDate })
  const { subject, html, text } = renderTemplate(
    { subject: tpl.subject, bodyHtml: tpl.body_html, bodyText: tpl.body_text }, ctx
  )

  // Insert first to mint the message id, then send with a reply-correlated Reply-To.
  const { data: row, error: insErr } = await supabase.from('email_messages').insert({
    landlord_id: landlordId,
    direction: 'outbound',
    template_id: templateId,
    tenant_id: tenantId,
    event_type: eventType || null,
    to_email: tenant.email,
    from_email: process.env.RESEND_FROM_EMAIL || null,
    subject, body_html: html, body_text: text,
    status: 'queued',
    is_test: false,
  }).select('id').single()
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 })

  const sent = await sendEmail({ to: tenant.email, subject, html, text, replyToMessageId: row.id, tags: { kind: 'manual' } })

  await supabase.from('email_messages').update({
    resend_message_id: sent.id || null,
    status: sent.error ? 'failed' : 'sent',
  }).eq('id', row.id)

  if (sent.error) return Response.json({ error: sent.error, messageId: row.id }, { status: 502 })
  return Response.json({ ok: true, messageId: row.id, replyTo: replyToAddress(row.id) })
}
