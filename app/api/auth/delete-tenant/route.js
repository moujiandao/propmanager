import { createClient } from '../../../../lib/supabase/server'

export async function POST(request) {
  const { tenantId } = await request.json()
  if (!tenantId) return Response.json({ error: 'tenantId is required.' }, { status: 400 })

  const supabase = await createClient()

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
      const { data: remaining } = await supabase
        .from('tenant_profiles')
        .select('unit_id')
        .in('unit_id', unitIds)
        .eq('status', 'current tenant')

      const occupiedIds = new Set((remaining || []).map(t => t.unit_id))
      for (const u of propertyUnits) {
        await supabase.from('units').update({ status: occupiedIds.has(u.id) ? 'occupied' : 'vacant' }).eq('id', u.id)
      }
    }
  }

  return Response.json({ success: true })
}
