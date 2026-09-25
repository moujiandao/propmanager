import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireLandlord, requireTeamRecord } from '@/lib/auth/authorize'

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { documentId } = await request.json()

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
  }

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const access = await requireTeamRecord(supabase, { table: 'documents', id: documentId, landlordId: auth.landlordId, select: 'id, landlord_id, file_path' })
  if (access.response) return access.response
  const doc = access.row

  // Only delete from storage if there's an actual uploaded file
  if (doc.file_path) {
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path])
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }
  }

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
