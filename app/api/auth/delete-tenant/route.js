import { createClient } from '@supabase/supabase-js'
import { isCurrentRow } from '@/lib/tenant/status'

export async function POST(request) {
  const { tenantId } = await request.json()
  if (!tenantId) return Response.json({ error: 'tenantId is required.' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Capture unit/property before deleting so we can recompute occupancy
  const { data: tenant } = await supabase
    .from('tenant_profiles')
    .select('unit_id, property_id')
    .eq('id', tenantId)
    .single()

  // Delete profile first (FK references auth.users)
  const { error: profileError } = await supabase
    .from('tenant_profiles')
    .delete()
    .eq('id', tenantId)

  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(tenantId)
  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  // Recompute occupancy for the affected property
  if (tenant?.property_id) {
    const { data: propertyUnits } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', tenant.property_id)

    if (propertyUnits?.length) {
      const unitIds = propertyUnits.map(u => u.id)
      // Status is derived, so occupancy can't be filtered in SQL — pull the dates back and
      // apply isCurrentRow here. NB: `t => isCurrentRow(t)`, not a bare reference, or filter
      // would pass the array index as the `today` argument.
      const { data: remaining } = await supabase
        .from('tenant_profiles')
        .select('unit_id, move_in_date, move_out_date')
        .in('unit_id', unitIds)

      const occupiedIds = new Set((remaining || []).filter(t => isCurrentRow(t)).map(t => t.unit_id))
      for (const u of propertyUnits) {
        await supabase.from('units').update({ status: occupiedIds.has(u.id) ? 'occupied' : 'vacant' }).eq('id', u.id)
      }
    }
  }

  return Response.json({ success: true })
}
