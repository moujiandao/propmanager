import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeWriteStatus } from '@/lib/maintenance/status'

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const formData = await request.formData()
  const tenantId = formData.get('tenantId')
  const propertyId = formData.get('propertyId') || null
  const unit = formData.get('unit') || null
  const status = normalizeWriteStatus(formData.get('status'))
  const type = formData.get('type') || null
  const description = formData.get('description')
  const descriptionZh = formData.get('descriptionZh') || null
  const landlordId = formData.get('landlordId')
  const files = formData.getAll('files').filter(f => f && f.size > 0)

  if (!tenantId || !description || !landlordId) {
    return NextResponse.json({ error: 'tenantId, description, and landlordId are required' }, { status: 400 })
  }

  // Create the maintenance request
  const { data: req, error: reqError } = await supabase
    .from('maintenance_requests')
    .insert({
      tenant_id: tenantId,
      property_id: propertyId || null,
      unit,
      status,
      type,
      description,
      description_zh: descriptionZh,
      landlord_id: landlordId,
    })
    .select()
    .single()

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 })
  }

  // Upload attachments
  const attachments = []
  for (const file of files) {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `maintenance/${landlordId}/${req.id}/${timestamp}-${safeName}`
    const buffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, { contentType: file.type })

    if (uploadError) {
      console.error('Attachment upload error:', uploadError)
      continue
    }

    const { data: att, error: attError } = await supabase
      .from('maintenance_attachments')
      .insert({
        maintenance_request_id: req.id,
        landlord_id: landlordId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single()

    if (!attError) attachments.push(att)
  }

  return NextResponse.json({ request: req, attachments })
}
