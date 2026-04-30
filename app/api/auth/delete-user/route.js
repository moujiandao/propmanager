import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { userId, role } = await request.json()
  if (!userId) return Response.json({ error: 'userId is required.' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (role === 'landlord') {
    const { error: profileError } = await supabase.from('landlord_profiles').delete().eq('id', userId)
    if (profileError) return Response.json({ error: profileError.message }, { status: 400 })
  } else {
    const { data: tenant } = await supabase.from('tenant_profiles').select('unit_id, property_id').eq('id', userId).single()
    const { error: profileError } = await supabase.from('tenant_profiles').delete().eq('id', userId)
    if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

    if (tenant?.property_id) {
      const { data: propertyUnits } = await supabase.from('units').select('id').eq('property_id', tenant.property_id)
      if (propertyUnits?.length) {
        const unitIds = propertyUnits.map(u => u.id)
        const { data: remaining } = await supabase.from('tenant_profiles').select('unit_id').in('unit_id', unitIds).eq('status', 'current tenant')
        const occupiedIds = new Set((remaining || []).map(t => t.unit_id))
        for (const u of propertyUnits) {
          await supabase.from('units').update({ status: occupiedIds.has(u.id) ? 'occupied' : 'vacant' }).eq('id', u.id)
        }
      }
    }
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  return Response.json({ success: true })
}
