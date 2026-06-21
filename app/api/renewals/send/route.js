import { createClient } from '../../../../lib/supabase/server'
import { releaseSubmitter } from '../../../../lib/docuseal/client'

// POST /api/renewals/send
// Body: { landlordId, renewalId }
// Releases the DocuSeal invite emails for each order:0 (tenant) submitter on a
// prepared renewal, then advances the renewal status to 'sent'. The landlord
// (order:1 countersigner) is auto-notified by DocuSeal once all tenants finish,
// thanks to the submission's preserved order — so we never release it here.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { landlordId, renewalId } = body || {}

  if (!landlordId) {
    return Response.json({ error: 'landlordId is required.' }, { status: 400 })
  }
  if (!renewalId) {
    return Response.json({ error: 'renewalId is required.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Load the renewal, scoped to the landlord so one team can't release another's.
  const { data: renewal, error: loadError } = await supabase
    .from('lease_renewals')
    .select('id, landlord_id, status, docuseal_submission_id, signers')
    .eq('id', renewalId)
    .eq('landlord_id', landlordId)
    .single()

  if (loadError || !renewal) {
    return Response.json({ error: `No renewal found with id ${renewalId}` }, { status: 404 })
  }

  // Only a prepared-but-unsent renewal can be sent. Idempotent: if it's already
  // sent (or further along), report success without re-releasing invites.
  if (renewal.status === 'sent') {
    return Response.json({ ok: true, status: 'sent' })
  }
  if (renewal.status !== 'pending_review') {
    return Response.json(
      { error: `Renewal cannot be sent from status '${renewal.status}'.` },
      { status: 409 }
    )
  }

  const signers = Array.isArray(renewal.signers) ? renewal.signers : []
  const tenantSigners = signers.filter((s) => s && s.order === 0 && s.submitterId)

  if (tenantSigners.length === 0) {
    return Response.json(
      { error: 'Renewal has no tenant submitters to release.' },
      { status: 422 }
    )
  }

  // Release each tenant (order:0) invite. DocuSeal throws on non-2xx; surface the
  // first failure rather than half-advancing the status.
  for (const signer of tenantSigners) {
    try {
      await releaseSubmitter(signer.submitterId)
    } catch (err) {
      return Response.json(
        { error: `Failed to release submitter ${signer.submitterId}: ${err.message}` },
        { status: 502 }
      )
    }
  }

  const { error: updateError } = await supabase
    .from('lease_renewals')
    .update({ status: 'sent' })
    .eq('id', renewalId)
    .eq('landlord_id', landlordId)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 400 })
  }

  return Response.json({ ok: true, status: 'sent' })
}
