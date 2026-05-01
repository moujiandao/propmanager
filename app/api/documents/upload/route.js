import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const formData = await request.formData()

  const file = formData.get('file')
  const landlordId = formData.get('landlordId')
  const tenantId = formData.get('tenantId') || null
  const propertyId = formData.get('propertyId') || null
  const unitId = formData.get('unitId') || null
  const contractId = formData.get('contractId') || null
  const documentType = formData.get('documentType') || 'other'

  if (!file || !landlordId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

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
