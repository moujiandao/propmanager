import { createClient } from '@supabase/supabase-js'
import { requireLandlord, rejectMismatchedLandlord, requireTeamRecords } from '@/lib/auth/authorize'

export async function POST(request) {
  const { contractId, driveLink, documentType, landlordId: requestedLandlordId, tenantId, propertyId } = await request.json()

  if (!driveLink) {
    return Response.json({ error: 'driveLink is required.' }, { status: 400 })
  }

  const auth = await requireLandlord()
  if (auth.response) return auth.response
  const teamMismatch = rejectMismatchedLandlord(requestedLandlordId, auth.landlordId)
  if (teamMismatch) return teamMismatch
  const landlordId = auth.landlordId

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const relatedRecords = await Promise.all([
    requireTeamRecords(supabase, { table: 'tenant_profiles', ids: [tenantId], landlordId }),
    requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId }),
    requireTeamRecords(supabase, { table: 'contracts', ids: [contractId], landlordId }),
  ])
  const denied = relatedRecords.find(result => result.response)
  if (denied) return denied.response

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      landlord_id: landlordId,
      tenant_id: tenantId || null,
      property_id: propertyId || null,
      contract_id: contractId || null,
      drive_link: driveLink.trim(),
      document_type: documentType || 'lease',
      file_name: '',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ document: doc })
}
