import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

// Fire a reviewed batch. No env kill-switch by design — the Step 3 confirmation
// dialog + per-recipient review is the safety gate. For each draft row we CLAIM
// the dedup slot first (flip draft → queued, which the unique index covers): a
// 23505 conflict there means a prior batch already sent this recipient/event, so
// we skip WITHOUT sending — claiming before the irreversible send is what makes
// dedup actually prevent a duplicate email. Only after a successful claim do we
// send via Resend, then finalize the row to sent/failed with its
// resend_message_id. After the loop the batch transitions to sent.
export async function POST(request, { params }) {
  const { id } = await params
  const body = await request.json()
  const { landlordId } = body || {}

  if (!landlordId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!id) return Response.json({ error: 'A batch id is required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Load the batch — must be a draft owned by this landlord.
  const { data: batch } = await supabase
    .from('email_batches').select('*').eq('id', id).eq('landlord_id', landlordId).maybeSingle()
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.status !== 'draft') return Response.json({ error: 'Batch already sent or cancelled' }, { status: 409 })

  const { data: messages } = await supabase
    .from('email_messages').select('*')
    .eq('batch_id', id).eq('landlord_id', landlordId).eq('status', 'draft')
    .order('created_at', { ascending: true })

  const result = { ok: true, sent: 0, failed: 0, skipped: 0 }

  for (const row of messages || []) {
    if (!row.to_email) {
      await supabase.from('email_messages').update({ status: 'failed' }).eq('id', row.id).eq('landlord_id', landlordId)
      result.failed++
      continue
    }

    // Claim the dedup slot BEFORE sending. The `eq('status','draft')` guard makes
    // this an atomic compare-and-swap: only ONE concurrent send can flip a given
    // row out of draft. A zero-row update is NOT an error in supabase-js, so we
    // must inspect the returned rows — empty means another send already claimed
    // this row → skip without sending (prevents a duplicate email on double-click
    // / retry / concurrent requests). A 23505 means a prior batch already sent
    // this recipient/event slot → also skip.
    const { data: claimed, error: claimErr } = await supabase
      .from('email_messages')
      .update({ status: 'queued' })
      .eq('id', row.id).eq('landlord_id', landlordId).eq('status', 'draft')
      .select('id')

    if (claimErr) {
      if (claimErr.code === '23505') { result.skipped++; continue }
      result.failed++
      continue
    }
    if (!claimed || claimed.length === 0) { result.skipped++; continue }

    const sent = await sendEmail({
      to: row.to_email,
      subject: row.subject,
      html: row.body_html,
      text: row.body_text,
      replyToMessageId: row.id,
      tags: { kind: 'batch' },
    })

    // Finalize the claimed row.
    await supabase
      .from('email_messages')
      .update({ status: sent.error ? 'failed' : 'sent', resend_message_id: sent.id || null })
      .eq('id', row.id).eq('landlord_id', landlordId)

    if (sent.error) result.failed++; else result.sent++
  }

  await supabase
    .from('email_batches')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id).eq('landlord_id', landlordId)

  return Response.json(result)
}
