import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { contractIds } = await request.json()
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return Response.json({ links: [] })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: links, error } = await supabase
    .from('contract_tenants')
    .select('contract_id, tenant_id')
    .in('contract_id', contractIds)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ links: links || [] })
}
