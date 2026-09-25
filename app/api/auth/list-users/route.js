import { createClient } from '@supabase/supabase-js'
import { requireLandlord } from '@/lib/auth/authorize'

export async function GET() {
  const auth = await requireLandlord()
  if (auth.response) return auth.response
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: members }, { data: tenants }] = await Promise.all([
    supabase.from('landlord_members').select('auth_user_id').eq('landlord_id', auth.landlordId),
    supabase.from('tenant_profiles').select('id, name, email').eq('landlord_id', auth.landlordId),
  ])

  const landlordIds = new Set((members || []).map(m => m.auth_user_id))
  const tenantIds   = new Set((tenants   || []).map(t => t.id))
  const visibleIds = new Set([...landlordIds, ...tenantIds])

  const users = (data.users || []).filter(u => visibleIds.has(u.id)).map(u => ({
    id:    u.id,
    email: u.email,
    name:  u.user_metadata?.name || u.email,
    role:  landlordIds.has(u.id) ? 'admin' : tenantIds.has(u.id) ? 'tenant' : 'unassigned',
    createdAt: u.created_at,
  }))

  return Response.json({ users })
}
