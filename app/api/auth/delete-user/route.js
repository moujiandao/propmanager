import { createClient } from '@supabase/supabase-js'
import { isCurrentRow } from '@/lib/tenant/status'
import { requireLandlord, requireTeamRecord } from '@/lib/auth/authorize'

export async function POST(request) {
  const { userId, role } = await request.json()
  if (!userId) return Response.json({ error: 'userId is required.' }, { status: 400 })

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (role === 'landlord' || role === 'admin') {
    return Response.json({ error: 'Deleting a landlord team is not supported by this endpoint.' }, { status: 403 })
  } else {
    const access = await requireTeamRecord(supabase, { table: 'tenant_profiles', id: userId, landlordId: auth.landlordId })
    if (access.response) return access.response
    const { data: tenant } = await supabase.from('tenant_profiles').select('unit_id, property_id').eq('id', userId).single()
    const { error: profileError } = await supabase.from('tenant_profiles').delete().eq('id', userId)
    if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

    if (tenant?.property_id) {
      const { data: propertyUnits } = await supabase.from('units').select('id').eq('property_id', tenant.property_id)
      if (propertyUnits?.length) {
        const unitIds = propertyUnits.map(u => u.id)
        // Derived status — filter in JS, not SQL. `t => isCurrentRow(t)` so filter's index
        // argument isn't taken as `today`.
        const { data: remaining } = await supabase.from('tenant_profiles').select('unit_id, move_in_date, move_out_date').in('unit_id', unitIds)
        const occupiedIds = new Set((remaining || []).filter(t => isCurrentRow(t)).map(t => t.unit_id))
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
