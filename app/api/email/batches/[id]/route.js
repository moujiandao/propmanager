import { createClient } from '@supabase/supabase-js'
import { renderTemplate, buildContext } from '@/lib/email/merge'
import { eventDateFor } from '@/lib/email/events'
import { loadTenantContext, mapLandlordRow } from '@/lib/email/context'

// Persist per-recipient edits to a draft batch:
//   - upserts with an id   → update that draft row's to_email/subject/body
//   - upserts without an id → add a new recipient (render their copy fresh)
//   - deleteIds            → remove draft rows (removed recipients)
// Everything is scoped to landlordId + this batch and only touches draft rows,
// so a confirmed/sent batch can't be mutated. Returns the updated batch + rows.
export async function PATCH(request, { params }) {
  const { id } = await params
  const body = await request.json()
  const { landlordId, upserts = [], deleteIds = [] } = body || {}

  if (!landlordId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!id) return Response.json({ error: 'A batch id is required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Load the batch (must be a draft owned by this landlord).
  const { data: batch } = await supabase
    .from('email_batches').select('*').eq('id', id).eq('landlord_id', landlordId).maybeSingle()
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.status !== 'draft') return Response.json({ error: 'Batch is not editable' }, { status: 409 })

  // Delete removed draft recipients.
  const ids = (deleteIds || []).filter(Boolean)
  if (ids.length) {
    const { error } = await supabase
      .from('email_messages').delete()
      .in('id', ids).eq('batch_id', id).eq('landlord_id', landlordId).eq('status', 'draft')
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // Edits to existing draft rows.
  for (const u of (upserts || []).filter(u => u && u.id)) {
    const patch = {}
    if (u.toEmail !== undefined) patch.to_email = u.toEmail
    if (u.subject !== undefined) patch.subject = u.subject
    if (u.bodyHtml !== undefined) patch.body_html = u.bodyHtml
    if (u.bodyText !== undefined) patch.body_text = u.bodyText
    if (!Object.keys(patch).length) continue
    const { error } = await supabase
      .from('email_messages').update(patch)
      .eq('id', u.id).eq('batch_id', id).eq('landlord_id', landlordId).eq('status', 'draft')
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // New recipients (no id): render their copy from the automation's template.
  const additions = (upserts || []).filter(u => u && !u.id)
  if (additions.length) {
    const { data: lRow } = await supabase
      .from('landlord_profiles').select('id,name').eq('id', landlordId).maybeSingle()
    const landlord = mapLandlordRow(lRow)

    let template = null
    if (batch.automation_id) {
      const { data: auto } = await supabase
        .from('email_automations').select('*').eq('id', batch.automation_id).eq('landlord_id', landlordId).maybeSingle()
      if (auto) {
        const { data: tpl } = await supabase
          .from('email_templates').select('*').eq('id', auto.template_id).eq('landlord_id', landlordId).maybeSingle()
        if (tpl) template = { auto, template: { subject: tpl.subject, bodyHtml: tpl.body_html, bodyText: tpl.body_text } }
      }
    }

    const rows = []
    for (const u of additions) {
      let subject = u.subject
      let html = u.bodyHtml
      let text = u.bodyText
      let eventDate = null
      let eventType = template?.auto?.event_type || null
      const offset = (template?.auto?.offset_days || [])[0] ?? null

      // If caller didn't supply rendered copy, render it from the template.
      if (template && (subject === undefined || html === undefined)) {
        const { tenant, contract, property, unit } = u.tenantId
          ? await loadTenantContext(supabase, { tenantId: u.tenantId, landlordId })
          : { tenant: null, contract: null, property: null, unit: null }
        eventDate = eventType ? eventDateFor(eventType, { tenant, contract }) : null
        const ctx = buildContext({ tenant, contract, property, unit, landlord, eventDate })
        const rendered = renderTemplate(template.template, ctx)
        if (subject === undefined) subject = rendered.subject
        if (html === undefined) html = rendered.html
        if (text === undefined) text = rendered.text
      }

      rows.push({
        landlord_id: landlordId,
        batch_id: id,
        direction: 'outbound',
        automation_id: batch.automation_id || null,
        template_id: template ? (template.auto.template_id || null) : null,
        tenant_id: u.tenantId || null,
        event_type: eventType,
        event_date: eventDate,
        offset_days: offset,
        to_email: u.toEmail || null,
        from_email: process.env.RESEND_FROM_EMAIL || null,
        subject: subject || '', body_html: html || '', body_text: text || '',
        status: 'draft',
        is_test: false,
      })
    }

    const { error } = await supabase.from('email_messages').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('email_batches').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('landlord_id', landlordId)

  const { data: updatedBatch } = await supabase
    .from('email_batches').select('*').eq('id', id).eq('landlord_id', landlordId).maybeSingle()
  const { data: messages } = await supabase
    .from('email_messages').select('*')
    .eq('batch_id', id).eq('landlord_id', landlordId).eq('status', 'draft')
    .order('created_at', { ascending: true })

  return Response.json({ batch: updatedBatch, messages: messages || [] })
}
