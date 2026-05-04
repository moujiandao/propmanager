import { createClient as createAdminClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp'])

export async function POST(request) {
  // Initialize inside handler so env vars are definitely resolved
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const formData = await request.formData()
  const file = formData.get('file')
  const propertyId = formData.get('propertyId')
  const landlordId = formData.get('landlordId')

  if (!file || !propertyId || !landlordId) {
    return Response.json({ error: 'file, propertyId, and landlordId are required' }, { status: 400 })
  }

  if (!UUID_RE.test(propertyId) || !UUID_RE.test(landlordId)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  const ext = file.name.split('.').pop().toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return Response.json({ error: 'Only jpg, jpeg, png, and webp files are allowed' }, { status: 400 })
  }

  // Confirm the property belongs to this landlord
  const { data: property } = await adminClient
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('landlord_id', landlordId)
    .maybeSingle()

  if (!property) {
    return Response.json({ error: 'Property not found' }, { status: 404 })
  }

  const path = `${propertyId}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await adminClient.storage
    .from('property-images')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return Response.json({ error: `Storage: ${uploadError.message}` }, { status: 400 })
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('property-images')
    .getPublicUrl(path)

  const versionedUrl = `${publicUrl}?v=${Date.now()}`

  const { error: dbError } = await adminClient
    .from('properties')
    .update({ image_url: versionedUrl })
    .eq('id', propertyId)

  if (dbError) {
    return Response.json({ error: `DB: ${dbError.message}` }, { status: 400 })
  }

  return Response.json({ url: versionedUrl })
}
