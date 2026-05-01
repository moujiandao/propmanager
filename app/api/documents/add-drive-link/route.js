import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { contractId, driveLink, documentType, landlordId, tenantId, propertyId } = await request.json()

  if (!driveLink || !landlordId) {
    return Response.json({ error: 'driveLink and landlordId are required.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

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
