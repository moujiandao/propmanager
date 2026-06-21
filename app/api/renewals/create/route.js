import { createClient } from '@supabase/supabase-js'
import { createRenewalSubmission } from '../../../../lib/docuseal/client.js'
import { deriveRenewalTerm, pickOriginalLeaseDate } from '../../../../lib/docuseal/renewal.js'

const PLACEHOLDER_SUFFIX = '@placeholder.local'

function isUnsendableEmail(email) {
  const e = (email || '').trim().toLowerCase()
  return !e || e.endsWith(PLACEHOLDER_SUFFIX)
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { landlordId, contractId } = body || {}
  if (!landlordId) return Response.json({ error: 'landlordId is required' }, { status: 400 })
  if (!contractId) return Response.json({ error: 'contractId is required' }, { status: 400 })

  const templateId = process.env.DOCUSEAL_RENEWAL_TEMPLATE_ID
  if (!templateId) {
    return Response.json({ error: 'DOCUSEAL_RENEWAL_TEMPLATE_ID is not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Load the contract scoped to this landlord (avoids cross-team access).
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, landlord_id, property_id, start_date, end_date, rent_amount')
    .eq('id', contractId)
    .eq('landlord_id', landlordId)
    .maybeSingle()
  if (contractError) return Response.json({ error: contractError.message }, { status: 400 })
  if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 })
  if (!contract.end_date) {
    return Response.json({ error: 'Contract has no end_date; cannot derive renewal term' }, { status: 422 })
  }

  // Resolve the contract's tenants via the contract_tenants junction.
  const { data: junction, error: junctionError } = await supabase
    .from('contract_tenants')
    .select('tenant_id')
    .eq('contract_id', contractId)
  if (junctionError) return Response.json({ error: junctionError.message }, { status: 400 })

  const tenantIds = (junction || []).map(j => j.tenant_id)
  if (tenantIds.length === 0) {
    return Response.json({ error: 'Contract has no associated tenants' }, { status: 422 })
  }

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenant_profiles')
    .select('id, name, last_name, email')
    .in('id', tenantIds)
  if (tenantsError) return Response.json({ error: tenantsError.message }, { status: 400 })
  if (!tenants || tenants.length === 0) {
    return Response.json({ error: 'Contract tenants could not be loaded' }, { status: 422 })
  }

  // BLOCK before touching DocuSeal: placeholder/missing emails can neither receive a
  // signing invite nor be matched back on the webhook. Silent partial-send is the
  // failure mode we refuse to allow.
  const blockedEmails = tenants.filter(t => isUnsendableEmail(t.email)).map(t => t.email || '')
  if (blockedEmails.length > 0) {
    return Response.json(
      { error: 'One or more tenants have a missing or placeholder email and cannot be sent a renewal.', blockedEmails },
      { status: 422 }
    )
  }

  // Landlord (countersigner) email.
  const { data: landlord, error: landlordError } = await supabase
    .from('landlord_profiles')
    .select('id, email')
    .eq('id', landlordId)
    .maybeSingle()
  if (landlordError) return Response.json({ error: landlordError.message }, { status: 400 })
  if (!landlord || isUnsendableEmail(landlord.email)) {
    return Response.json(
      { error: 'Landlord countersigner email is missing or invalid.', blockedEmails: [landlord?.email || ''] },
      { status: 422 }
    )
  }

  // Property for the prefilled address (optional; addendum still references it by string).
  let property = null
  if (contract.property_id) {
    const { data: prop, error: propError } = await supabase
      .from('properties')
      .select('id, address, city, state, zip')
      .eq('id', contract.property_id)
      .maybeSingle()
    if (propError) return Response.json({ error: propError.message }, { status: 400 })
    property = prop || null
  }
  const propertyAddress = property
    ? [property.address, property.city, [property.state, property.zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : ''

  // Derive the new term (shared with the UI via lib/docuseal/renewal.js so the two
  // never diverge): starts the day after the current end_date, runs 12 months.
  const { newTermStart, newTermEnd } = deriveRenewalTerm(contract.end_date)
  const rentAmount = contract.rent_amount

  // The "X date" must never drift across a chain of renewals. Pin it to the root of
  // the existing renewal chain for this contract; if none exists yet, the original
  // lease's start_date is the root.
  const { data: chainRows, error: chainError } = await supabase
    .from('lease_renewals')
    .select('original_lease_date, created_at')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })
  if (chainError) return Response.json({ error: chainError.message }, { status: 400 })
  const originalLeaseDate = pickOriginalLeaseDate(chainRows, contract.start_date)

  // Build DocuSeal submitters. Tenants share order:0 (parallel group); the landlord is
  // order:1 (countersigns last). The `values` keys below are DocuSeal template FIELD
  // NAMES and MUST exactly match the field labels configured on the renewal template
  // (DOCUSEAL_RENEWAL_TEMPLATE_ID). Renaming a template field without updating these
  // keys silently drops the prefill.
  const tenantSubmitters = tenants.map(t => {
    const fullName = [t.name, t.last_name].filter(Boolean).join(' ').trim()
    return {
      email: t.email.trim(),
      order: 0,
      values: {
        'Tenant Name': fullName,
        'Property Address': propertyAddress,
        'Original Lease Date': originalLeaseDate || '',
        'New Term Start': newTermStart,
        'New Term End': newTermEnd,
        'Monthly Rent': rentAmount != null ? String(rentAmount) : '',
      },
      _tenantId: t.id,
    }
  })

  const landlordSubmitter = {
    email: landlord.email.trim(),
    order: 1,
    values: {},
  }

  // DocuSeal call: send_email:false suppresses invites so the landlord can review the
  // filled draft first (the review gate). Strip our internal _tenantId before sending.
  const submitters = [
    ...tenantSubmitters.map(({ _tenantId, ...s }) => s),
    landlordSubmitter,
  ]

  let submission
  try {
    submission = await createRenewalSubmission({ templateId, submitters })
  } catch (err) {
    return Response.json({ error: `DocuSeal submission failed: ${err.message}` }, { status: 502 })
  }

  // Match DocuSeal's returned submitters back to our tenants by email so each signer
  // entry carries the submitterId + embedSrc.
  const returnedByEmail = new Map(
    (submission.submitters || []).map(s => [(s.email || '').trim().toLowerCase(), s])
  )

  const signers = []
  for (const ts of tenantSubmitters) {
    const matched = returnedByEmail.get(ts.email.trim().toLowerCase())
    signers.push({
      tenantId: ts._tenantId,
      email: ts.email.trim(),
      order: 0,
      submitterId: matched?.id ?? null,
      embedSrc: matched?.embedSrc ?? null,
      status: 'pending',
      signedAt: null,
    })
  }
  const matchedLandlord = returnedByEmail.get(landlord.email.trim().toLowerCase())
  signers.push({
    tenantId: null,
    email: landlord.email.trim(),
    order: 1,
    submitterId: matchedLandlord?.id ?? null,
    embedSrc: matchedLandlord?.embedSrc ?? null,
    status: 'pending',
    signedAt: null,
  })

  const { data: inserted, error: insertError } = await supabase
    .from('lease_renewals')
    .insert({
      landlord_id: landlordId,
      contract_id: contractId,
      property_id: contract.property_id || null,
      original_lease_date: originalLeaseDate || null,
      new_term_start: newTermStart,
      new_term_end: newTermEnd,
      rent_amount: rentAmount,
      status: 'pending_review',
      docuseal_submission_id: submission.submissionId != null ? String(submission.submissionId) : null,
      signers,
    })
    .select('id')
    .single()
  if (insertError) return Response.json({ error: insertError.message }, { status: 400 })

  return Response.json({
    renewalId: inserted.id,
    submissionId: submission.submissionId,
    status: 'pending_review',
    signers: signers.map(s => ({
      tenantId: s.tenantId,
      email: s.email,
      order: s.order,
      submitterId: s.submitterId,
      embedSrc: s.embedSrc,
    })),
  })
}
