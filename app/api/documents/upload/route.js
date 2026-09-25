import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireLandlord, rejectMismatchedLandlord, requireTeamRecords } from '@/lib/auth/authorize'

export async function POST(request) {
  const auth = await requireLandlord()
  if (auth.response) return auth.response
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const formData = await request.formData()

  const file = formData.get('file')
  const requestedLandlordId = formData.get('landlordId')
  const tenantId = formData.get('tenantId') || null
  const propertyId = formData.get('propertyId') || null
  const unitId = formData.get('unitId') || null
  const contractId = formData.get('contractId') || null
  const documentType = formData.get('documentType') || 'other'

  if (!file) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const teamMismatch = rejectMismatchedLandlord(requestedLandlordId, auth.landlordId)
  if (teamMismatch) return teamMismatch
  const landlordId = auth.landlordId
  const relatedRecords = await Promise.all([
    requireTeamRecords(supabase, { table: 'tenant_profiles', ids: [tenantId], landlordId }),
    requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId }),
    requireTeamRecords(supabase, { table: 'contracts', ids: [contractId], landlordId }),
  ])
  const denied = relatedRecords.find(result => result.response)
  if (denied) return denied.response

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${landlordId}/${tenantId || 'unassigned'}/${timestamp}-${safeName}`

  const fileBuffer = await file.arrayBuffer()

  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, { contentType: file.type })

  if (storageError) {
    console.error('Storage upload error:', storageError)
    return NextResponse.json({ error: storageError.message, detail: storageError }, { status: 500 })
  }

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      landlord_id: landlordId,
      tenant_id: tenantId,
      property_id: propertyId,
      unit_id: unitId,
      contract_id: contractId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      document_type: documentType,
    })
    .select()
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    return NextResponse.json({ error: dbError.message, detail: dbError }, { status: 500 })
  }

  return NextResponse.json({ document: doc })
}
