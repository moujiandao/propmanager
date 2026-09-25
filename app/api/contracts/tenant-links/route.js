import { createClient } from '@supabase/supabase-js'
import { requireLandlord } from '@/lib/auth/authorize'

export async function POST(request) {
  const { contractIds } = await request.json()
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return Response.json({ links: [] })
  }

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: contracts, error: contractError } = await supabase
    .from('contracts')
    .select('id')
    .in('id', contractIds)
    .eq('landlord_id', auth.landlordId)
  if (contractError) return Response.json({ error: contractError.message }, { status: 400 })
  const ownedIds = (contracts || []).map(contract => contract.id)
  const { data: links, error } = ownedIds.length ? await supabase
    .from('contract_tenants')
    .select('contract_id, tenant_id')
    .in('contract_id', ownedIds) : { data: [], error: null }
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ links: links || [] })
}
