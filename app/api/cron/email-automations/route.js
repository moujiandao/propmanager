import { createClient } from '@supabase/supabase-js'
import { renderTemplate, buildContext } from '@/lib/email/merge'
import { eventDateFor, offsetsDueToday } from '@/lib/email/events'
import { loadLandlordDataset, contractForTenant } from '@/lib/email/context'
import { candidates, matchesScope } from '@/lib/email/audience'
import { sendEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

// Daily cron: for every enabled automation, find tenants whose event is exactly
// `offset` days away today, render the template, and send. Idempotent — a unique
// partial index on email_messages makes a duplicate insert fail (code 23505),
// so re-running the same day never double-sends.
// Recipient matching (candidates / matchesScope) lives in lib/email/audience.js
// so the cron and the manual batch route never drift.

async function handle(request) {
  const auth = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = new Date()
  const { data: automations } = await supabase.from('email_automations').select('*').eq('enabled', true)

  // Cache one dataset per landlord across that landlord's automations.
  const datasetCache = new Map()
  const result = { sent: 0, skipped: 0, failed: 0, considered: 0 }

  for (const auto of automations || []) {
    if (!auto.template_id || !(auto.offset_days || []).length) continue

    const { data: tpl } = await supabase.from('email_templates').select('*').eq('id', auto.template_id).maybeSingle()
    if (!tpl) continue

    if (!datasetCache.has(auto.landlord_id)) datasetCache.set(auto.landlord_id, await loadLandlordDataset(supabase, auto.landlord_id))
    const ds = datasetCache.get(auto.landlord_id)

    for (const tenant of candidates(auto.event_type, ds)) {
      if (!matchesScope(tenant, auto.scope)) continue
      const contract = contractForTenant(ds.contracts, tenant.id)
      const eventDate = eventDateFor(auto.event_type, { tenant, contract }, today)
      const dueOffsets = offsetsDueToday(eventDate, auto.offset_days, today)
      if (!dueOffsets.length) continue

      const property = tenant.propertyId ? ds.propsById.get(tenant.propertyId) : null
      const unit = tenant.unitId ? ds.unitsById.get(tenant.unitId) : null

      for (const offset of dueOffsets) {
        result.considered++
        if (!tenant.email) { result.skipped++; continue }

        // Claim the dedup slot first. A duplicate (already sent) hits the unique
        // index and returns 23505 → skip without sending.
        const ctx = buildContext({ tenant, contract, property, unit, landlord: ds.landlord, eventDate, today })
        const { subject, html, text } = renderTemplate({ subject: tpl.subject, bodyHtml: tpl.body_html, bodyText: tpl.body_text }, ctx)

        const { data: row, error: insErr } = await supabase.from('email_messages').insert({
          landlord_id: auto.landlord_id,
          direction: 'outbound',
          automation_id: auto.id,
          template_id: auto.template_id,
          tenant_id: tenant.id,
          event_type: auto.event_type,
          event_date: eventDate,
          offset_days: offset,
          to_email: tenant.email,
          from_email: process.env.RESEND_FROM_EMAIL || null,
          subject, body_html: html, body_text: text,
          status: 'queued',
          is_test: false,
        }).select('id').single()

        if (insErr) {
          if (insErr.code === '23505') { result.skipped++; continue }   // already sent
          result.failed++; continue
        }

        const sent = await sendEmail({ to: tenant.email, subject, html, text, replyToMessageId: row.id, tags: { kind: 'automation', event: auto.event_type } })
        await supabase.from('email_messages').update({
          resend_message_id: sent.id || null,
          status: sent.error ? 'failed' : 'sent',
        }).eq('id', row.id)
        if (sent.error) result.failed++; else result.sent++
      }
    }
  }

  return Response.json({ ok: true, ranAt: today.toISOString(), ...result })
}

// Vercel Cron issues a GET; allow POST too for manual/QStash triggers.
export const GET = handle
export const POST = handle
