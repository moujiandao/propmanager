import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'ids array is required.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase
    .from('payments')
    .delete()
    .in('id', ids)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ success: true, deletedCount: data?.length || 0 })
}
