import { createClient } from '../../../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: landlords }, { data: tenants }] = await Promise.all([
    supabase.from('landlord_profiles').select('id, name, email'),
    supabase.from('tenant_profiles').select('id, name, email'),
  ])

  const landlordIds = new Set((landlords || []).map(l => l.id))
  const tenantIds   = new Set((tenants   || []).map(t => t.id))

  const users = (data.users || []).map(u => ({
    id:    u.id,
    email: u.email,
    name:  u.user_metadata?.name || u.email,
    role:  landlordIds.has(u.id) ? 'admin' : tenantIds.has(u.id) ? 'tenant' : 'unassigned',
    createdAt: u.created_at,
  }))

  return Response.json({ users })
}
