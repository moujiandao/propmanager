import { createClient } from '@supabase/supabase-js'
import { renderTemplate, buildContext } from '@/lib/email/merge'
import { eventDateFor } from '@/lib/email/events'
import { loadLandlordDataset, contractForTenant } from '@/lib/email/context'
import { candidates, matchesScope } from '@/lib/email/audience'

// Run now: launch a human-review batch from an automation. Computes EVERYONE
// matching the automation's event_type + scope (ignoring offset_days), renders
// each recipient's copy, and stages draft email_messages rows under one
// email_batches row. No send happens here — the send route fires after review.
//
// Idempotent / resumable: if a 'draft' batch already exists for this automation,
// return that batch and its draft messages instead of creating a new one, so a
// reload mid-flow resumes rather than spawning duplicate drafts.
export async function POST(request) {
  const body = await request.json()
  const { landlordId, automationId } = body || {}

  if (!landlordId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!automationId) return Response.json({ error: 'An automationId is required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Load the automation, scoped to the landlord.
  const { data: auto } = await supabase
    .from('email_automations').select('*').eq('id', automationId).eq('landlord_id', landlordId).maybeSingle()
  if (!auto) return Response.json({ error: 'Automation not found' }, { status: 404 })

  const { data: tpl } = await supabase
    .from('email_templates').select('*').eq('id', auto.template_id).eq('landlord_id', landlordId).maybeSingle()
  if (!tpl) return Response.json({ error: 'Template not found for this automation' }, { status: 404 })

  // Resume an existing draft batch for this automation rather than re-creating.
  const { data: existing } = await supabase
    .from('email_batches').select('*')
    .eq('landlord_id', landlordId).eq('automation_id', automationId).eq('status', 'draft')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) {
    const { data: messages } = await supabase
      .from('email_messages').select('*')
      .eq('batch_id', existing.id).eq('landlord_id', landlordId).eq('status', 'draft')
      .order('created_at', { ascending: true })
    return Response.json({ batch: existing, messages: messages || [] })
  }

  const ds = await loadLandlordDataset(supabase, landlordId)
  const template = { subject: tpl.subject, bodyHtml: tpl.body_html, bodyText: tpl.body_text }

  // First offset is the dedup slot the draft will claim when it flips to sent.
  const offset = (auto.offset_days || [])[0] ?? null

  // Everyone matching the event + scope, ignoring offset_days.
  const recipients = candidates(auto.event_type, ds).filter(t => matchesScope(t, auto.scope))

  const { data: batch, error: batchErr } = await supabase
    .from('email_batches').insert({
      landlord_id: landlordId,
      automation_id: automationId,
      status: 'draft',
    }).select('*').single()
  if (batchErr) return Response.json({ error: batchErr.message }, { status: 500 })

  const rows = recipients.map((tenant) => {
    const contract = contractForTenant(ds.contracts, tenant.id)
    const property = tenant.propertyId ? ds.propsById.get(tenant.propertyId) : null
    const unit = tenant.unitId ? ds.unitsById.get(tenant.unitId) : null
    const eventDate = eventDateFor(auto.event_type, { tenant, contract })
    const ctx = buildContext({ tenant, contract, property, unit, landlord: ds.landlord, eventDate })
    const { subject, html, text } = renderTemplate(template, ctx)
    return {
      landlord_id: landlordId,
      batch_id: batch.id,
      direction: 'outbound',
      automation_id: automationId,
      template_id: auto.template_id,
      tenant_id: tenant.id,
      event_type: auto.event_type,
      event_date: eventDate,
      offset_days: offset,
      to_email: tenant.email || null,
      from_email: process.env.RESEND_FROM_EMAIL || null,
      subject, body_html: html, body_text: text,
      status: 'draft',
      is_test: false,
    }
  })

  let messages = []
  if (rows.length) {
    const { data: inserted, error: msgErr } = await supabase
      .from('email_messages').insert(rows).select('*')
    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 })
    messages = inserted || []
  }

  return Response.json({ batch, messages })
}
