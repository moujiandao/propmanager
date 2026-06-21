import { createClient } from '../../../../lib/supabase/server'
import { verifyWebhookSignature, getSignedDocuments } from '../../../../lib/docuseal/client'

export const dynamic = 'force-dynamic'

// DocuSeal webhook: advances a lease_renewals row as its submitters sign.
//
// Mirrors the Resend webhook (app/api/webhooks/resend): read the RAW body with
// request.text() (signature is over the exact bytes), verify the HMAC signature
// before parsing, then update status. DocuSeal signs with X-Docuseal-Signature
// in 'timestamp.signature' form — verifyWebhookSignature() does the constant-time
// HMAC-SHA256 compare; we just hand it the raw body + header + secret.
//
// Status machine (per spec / lease_renewals.status):
//   pending_review/sent → signed        (all order:0 tenants completed)
//                       → countersigned  (landlord order:1 completed too)
//                       → declined       (any submitter declined)
// signers jsonb shape: [{ tenantId, email, submitterId, order, status, signedAt }]

// Pull the submission id out of a form.* payload. DocuSeal nests it as either a
// scalar (data.submission_id) or an object (data.submission.id) depending on the
// event, so check both.
function submissionIdFrom(data) {
  return data?.submission_id || data?.submission?.id || null
}

// Normalize a possibly-numeric DocuSeal id to a string for stable comparison
// against the (string) submitterId we stored in signers jsonb.
const idStr = (v) => (v == null ? null : String(v))

export async function POST(request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-docuseal-signature')

  if (!verifyWebhookSignature(rawBody, signature, process.env.DOCUSEAL_WEBHOOK_SECRET)) {
    // 401, matching the Resend webhook sibling this route is modeled on.
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const type = event?.event_type || event?.type || ''
  const data = event?.data || {}

  // Only signer-lifecycle events touch renewal state; ack everything else.
  const isCompleted = type === 'form.completed'
  const isDeclined = type === 'form.declined'
  if (!isCompleted && !isDeclined) {
    return Response.json({ received: true, ignored: type })
  }

  const submissionId = submissionIdFrom(data)
  const submitterId = idStr(data?.id)
  const email = (data?.email || '').trim().toLowerCase()
  const when = data?.completed_at || data?.declined_at || event?.timestamp || new Date().toISOString()

  const supabase = await createClient()

  // Locate the renewal by submission id (indexed). Fall back is impossible —
  // without a submission id we can't safely target a row.
  if (!submissionId) {
    return Response.json({ received: true, note: 'no submission id in payload' })
  }

  const { data: renewal, error: loadError } = await supabase
    .from('lease_renewals')
    .select('id, status, signers, docuseal_submission_id')
    .eq('docuseal_submission_id', submissionId)
    .maybeSingle()

  if (loadError) return Response.json({ error: loadError.message }, { status: 400 })
  if (!renewal) {
    return Response.json({ received: true, note: 'no matching renewal' })
  }

  const signers = Array.isArray(renewal.signers) ? renewal.signers : []

  // Match the firing submitter to a stored signer entry: prefer submitterId
  // (exact, survives email edge cases), fall back to email. The spec calls for an
  // email→tenant match; the signers array already carries tenantId+email per
  // submitter, so matching here is equivalent and avoids a second lookup. We only
  // confirm against tenant_profiles when we couldn't match by id or email.
  let idx = submitterId
    ? signers.findIndex((s) => s && idStr(s.submitterId) === submitterId)
    : -1
  if (idx === -1 && email) {
    idx = signers.findIndex((s) => s && (s.email || '').trim().toLowerCase() === email)
  }
  if (idx === -1 && email) {
    // Last resort: confirm the signer is a known tenant of this landlord and map
    // by email. (Landlord/countersigner won't be in tenant_profiles.)
    const { data: tenant } = await supabase
      .from('tenant_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (tenant) {
      idx = signers.findIndex((s) => s && idStr(s.tenantId) === idStr(tenant.id))
    }
  }

  if (idx === -1) {
    return Response.json({ received: true, note: 'submitter not found on renewal' })
  }

  // Update the matched signer entry in place.
  const updatedSigners = signers.map((s, i) =>
    i === idx
      ? { ...s, status: isDeclined ? 'declined' : 'completed', signedAt: isDeclined ? (s.signedAt ?? null) : when }
      : s
  )

  // Derive the renewal status from the signer set.
  let status = renewal.status
  if (isDeclined) {
    status = 'declined'
  } else {
    const tenants = updatedSigners.filter((s) => s && s.order === 0)
    const landlords = updatedSigners.filter((s) => s && s.order === 1)
    const allTenantsDone = tenants.length > 0 && tenants.every((s) => s.status === 'completed')
    const allLandlordsDone = landlords.length > 0 && landlords.every((s) => s.status === 'completed')

    if (allTenantsDone && allLandlordsDone) {
      status = 'countersigned'
    } else if (allTenantsDone) {
      status = 'signed'
    }
    // else: still waiting on signers; keep current status (sent/pending_review).
  }

  const patch = { signers: updatedSigners }
  // Never downgrade a renewal that already reached countersigned (e.g. a late
  // duplicate tenant event re-deriving 'signed').
  if (renewal.status !== 'countersigned' || status === 'countersigned') {
    patch.status = status
  }

  // Best-effort: once fully countersigned, confirm signed docs are retrievable.
  // Pure observability — we don't persist them here (filing is Phase 4, deferred).
  // A failure must not fail the webhook (DocuSeal would retry and we'd re-process).
  if (patch.status === 'countersigned') {
    try {
      await getSignedDocuments(submissionId)
    } catch {
      // swallow: signed-doc fetch is non-critical for status advancement
    }
  }

  const { error: updateError } = await supabase
    .from('lease_renewals')
    .update(patch)
    .eq('id', renewal.id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 400 })

  return Response.json({ received: true })
}
